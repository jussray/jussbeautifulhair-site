// Disabled-by-default, sandbox-only storefront-to-JussPay boundary.
// SKU mappings are server-owned; client prices and vendor identifiers are never trusted.
const VARIANT=/^(?:gid:\/\/shopify\/ProductVariant\/\d+|jbh:[a-z0-9][a-z0-9-]{0,99}:[0-9]+)$/;
const SKU=/^[A-Z0-9][A-Z0-9-]{1,63}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
export function parseJussPayCart(input, mapping) {
  if(!input || typeof input!=='object' || Array.isArray(input) || !UUID.test(input.requestId||'') || !Array.isArray(input.lines) || !input.lines.length || input.lines.length>20) throw new Error('invalid_cart');
  if(input.shipping!=='standard' && input.shipping!=='express') throw new Error('invalid_shipping');
  if(Object.keys(input).some(k=>!['requestId','lines','shipping'].includes(k))) throw new Error('invalid_cart');
  if(!mapping || typeof mapping!=='object' || Array.isArray(mapping)) throw new Error('mapping_unavailable');
  const quantities=new Map();
  for(const line of input.lines) {
    if(!line || typeof line!=='object' || Array.isArray(line) || Object.keys(line).some(k=>!['merchandiseId','quantity'].includes(k)) || !VARIANT.test(line.merchandiseId||'') || !Number.isInteger(line.quantity) || line.quantity<1 || line.quantity>10) throw new Error('invalid_cart');
    const sku=mapping[line.merchandiseId];
    if(typeof sku!=='string' || !SKU.test(sku)) throw new Error('variant_not_approved');
    const quantity=(quantities.get(sku)||0)+line.quantity;
    if(quantity>10) throw new Error('invalid_cart');
    quantities.set(sku,quantity);
  }
  return {requestId:input.requestId,items:[...quantities].map(([sku,quantity])=>({sku,quantity})),shipping:input.shipping};
}
export async function handleJussPaySandbox(request,env) {
  const path=new URL(request.url).pathname;
  const live=path==='/api/jusspay/live/checkout';
  // The live route is not an alternate way around catalog approval.
  if(live && env.JBH_STRIPE_COMMERCE_MODE!=='live') return json({error:'not_found'},404);
  if(live ? env.JBH_JUSSPAY_LIVE_ENABLED!=='true' : env.JBH_JUSSPAY_SANDBOX_ENABLED!=='true') return json({error:'not_found'},404);
  if(request.method==='GET') {
    const unavailable=live?'live_unavailable':'sandbox_unavailable';
    if(!env.JBH_JUSSPAY || typeof env.JBH_JUSSPAY.fetch!=='function' || !env.JBH_JUSSPAY_STOREFRONT_KEY || env.JBH_JUSSPAY_STOREFRONT_KEY.length<32) return json({error:unavailable},503);
    let mapping;
    try { mapping=JSON.parse(env.JBH_JUSSPAY_VARIANT_SKUS||'null'); } catch { return json({error:'mapping_unavailable'},503); }
    if(!mapping || typeof mapping!=='object' || Array.isArray(mapping) || !Object.keys(mapping).length || Object.entries(mapping).some(([variant,sku])=>!VARIANT.test(variant) || typeof sku!=='string' || !SKU.test(sku))) return json({error:'mapping_unavailable'},503);
    try {
      const upstream=await env.JBH_JUSSPAY.fetch('https://jusspay.internal/jbh/health',{
        method:'GET',
        headers:{'x-jbh-storefront-key':env.JBH_JUSSPAY_STOREFRONT_KEY}
      });
      if(!upstream.ok) return json({error:unavailable},503);
      const readiness=await upstream.json();
      if(!readiness || readiness.ready!==true || readiness.mode!==(live?'live':'sandbox') || readiness.chargesEnabled!==true) return json({error:unavailable},503);
      return json({enabled:true,mode:live?'live':'sandbox'});
    } catch {
      return json({error:unavailable},503);
    }
  }
  if(request.method!=='POST') return json({error:'method_not_allowed'},405);
  const url=new URL(request.url);
  if(request.headers.get('origin')!==url.origin) return json({error:'forbidden'},403);
  if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json')) return json({error:'unsupported_media_type'},415);
  if(Number(request.headers.get('content-length')||0)>4096) return json({error:'request_too_large'},413);
  if(!env.JBH_JUSSPAY || typeof env.JBH_JUSSPAY.fetch!=='function' || !env.JBH_JUSSPAY_STOREFRONT_KEY || env.JBH_JUSSPAY_STOREFRONT_KEY.length<32) return json({error:'sandbox_unavailable'},503);
  let mapping;
  try {mapping=JSON.parse(env.JBH_JUSSPAY_VARIANT_SKUS||'null');}catch{return json({error:'mapping_unavailable'},503);}
  let raw;
  try {raw=await request.text();}catch{return json({error:'invalid_cart'},400);}
  if(new TextEncoder().encode(raw).byteLength>4096) return json({error:'request_too_large'},413);
  let payload;
  try {payload=parseJussPayCart(JSON.parse(raw),mapping);}catch(error){
    const code=error instanceof Error?error.message:'invalid_cart';
    return json({error:code},code==='mapping_unavailable'?503:400);
  }
  try {
    const upstream=await env.JBH_JUSSPAY.fetch('https://jusspay.internal/jbh/checkout',{
      method:'POST',headers:{'content-type':'application/json','x-jbh-storefront-key':env.JBH_JUSSPAY_STOREFRONT_KEY},
      body:JSON.stringify(payload)
    });
    if(!upstream.ok) return json({error:live?'live_checkout_unavailable':'sandbox_checkout_unavailable'},502);
    const result=await upstream.json();
    if(!result || typeof result.orderId!=='string' || !/^jbho_[A-Za-z0-9_-]+$/.test(result.orderId) || typeof result.url!=='string' || !/^https:\/\/checkout\.stripe\.com\//.test(result.url)) return json({error:'invalid_provider_response'},502);
    if(!result.url.includes(`/cs_${live?'live':'test'}_`)) return json({error:'wrong_checkout_mode'},502);
    const checkout=new URL(result.url);
    if(checkout.origin!=='https://checkout.stripe.com' || checkout.username || checkout.password || checkout.port || checkout.hash || !/^\/c\//.test(checkout.pathname)) return json({error:'invalid_provider_response'},502);
    return json({url:checkout.href,mode:live?'live':'sandbox'});
  } catch {return json({error:live?'live_checkout_unavailable':'sandbox_checkout_unavailable'},502);}
}
