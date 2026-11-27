// Disabled-by-default, explicitly mode-gated storefront-to-JussPay boundary.
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
export async function proxyJussPayWebhook(request,env) {
  if(request.method!=='POST') return json({error:'method_not_allowed'},405);
  if(!env.JBH_JUSSPAY || typeof env.JBH_JUSSPAY.fetch!=='function') return json({error:'webhook_unavailable'},503);
  try {
    return await env.JBH_JUSSPAY.fetch(new Request('https://jusspay.internal/jbh/webhook',request));
  } catch {
    return json({error:'webhook_unavailable'},503);
  }
}
async function upstreamReady(env,live) {
  try {
    const response=await env.JBH_JUSSPAY.fetch('https://jusspay.internal/jbh/health',{
      method:'GET',headers:{'x-jbh-storefront-key':env.JBH_JUSSPAY_STOREFRONT_KEY},
      signal:AbortSignal.timeout(8000)
    });
    if(!response.ok)return false;
    const state=await response.json();
    return state?.ready===true&&state.mode===(live?'live':'sandbox')&&state.chargesEnabled===true;
  }catch{return false;}
}
export async function handleJussPaySandbox(request,env) {
  const path=new URL(request.url).pathname;
  const live=path==='/api/jusspay/live/checkout';
  const publicOrigin=new URL(request.url).origin;
  if(live && publicOrigin!=='https://jussbeautifulhair.com' &&
      publicOrigin!=='https://www.jussbeautifulhair.com') return json({error:'not_found'},404);
  // The live route is not an alternate way around catalog approval.
  if(live && env.JBH_STRIPE_COMMERCE_MODE!=='live') return json({error:'not_found'},404);
  if(live ? env.JBH_JUSSPAY_LIVE_ENABLED!=='true' : env.JBH_JUSSPAY_SANDBOX_ENABLED!=='true') return json({error:'not_found'},404);
  if(request.method==='GET') {
    const unavailable=live?'live_unavailable':'sandbox_unavailable';
    if(!env.JBH_JUSSPAY || typeof env.JBH_JUSSPAY.fetch!=='function' || !env.JBH_JUSSPAY_STOREFRONT_KEY || env.JBH_JUSSPAY_STOREFRONT_KEY.length<32) return json({error:unavailable},503);
    let mapping;
    try { mapping=JSON.parse(env.JBH_JUSSPAY_VARIANT_SKUS||'null'); } catch { return json({error:'mapping_unavailable'},503); }
    if(!mapping || typeof mapping!=='object' || Array.isArray(mapping) || !Object.keys(mapping).length || Object.entries(mapping).some(([variant,sku])=>!VARIANT.test(variant) || typeof sku!=='string' || !SKU.test(sku))) return json({error:'mapping_unavailable'},503);
    if(!await upstreamReady(env,live))return json({error:unavailable},503);
    return json({enabled:true,mode:live?'live':'sandbox'});
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
  // Validate the upstream lane before any session-creation request.
  if(!await upstreamReady(env,live))return json({error:live?'live_unavailable':'sandbox_unavailable'},503);
  try {
    const upstream=await env.JBH_JUSSPAY.fetch('https://jusspay.internal/jbh/checkout',{
      method:'POST',headers:{'content-type':'application/json','x-jbh-storefront-key':env.JBH_JUSSPAY_STOREFRONT_KEY,'x-jbh-checkout-mode':live?'live':'sandbox'},
      body:JSON.stringify(payload)
    });
    if(!upstream.ok) return json({error:live?'live_checkout_unavailable':'sandbox_checkout_unavailable'},502);
    const result=await upstream.json();
    if(!result || typeof result.orderId!=='string' || !/^jbho_[A-Za-z0-9_-]+$/.test(result.orderId) || typeof result.url!=='string' || !/^https:\/\/checkout\.stripe\.com\//.test(result.url)) return json({error:'invalid_provider_response'},502);
    let checkout;
    try { checkout=new URL(result.url); } catch { return json({error:'invalid_provider_response'},502); }
    const session=/^\/c\/pay\/cs_(live|test)_[A-Za-z0-9]{1,200}$/.exec(checkout.pathname);
    // Stripe returns an opaque page-initialization fragment. Preserve it on
    // Stripe's exact session route rather than treating it as a redirect.
    const fragment=checkout.hash;
    if(checkout.origin!=='https://checkout.stripe.com' || checkout.username || checkout.password || checkout.port ||
       checkout.search || !session || fragment.length>8192 ||
       (fragment && !/^#[A-Za-z0-9._~%+=\/-]+$/.test(fragment))) return json({error:'invalid_provider_response'},502);
    if(session[1] !== (live?'live':'test')) return json({error:'wrong_checkout_mode'},502);
    return json({url:checkout.href,mode:live?'live':'sandbox'});
  } catch {return json({error:live?'live_checkout_unavailable':'sandbox_checkout_unavailable'},502);}
}

export async function readJussPayOrderState(request,env) {
  const url=new URL(request.url);
  const reply=(state,status=200)=>new Response(JSON.stringify({state}),{status,headers:{
    'content-type':'application/json; charset=utf-8','cache-control':'no-store',
    'x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-robots-tag':'noindex, nofollow'
  }});
  if(request.method!=='GET')return reply('unavailable',405);
  if(!['https://jussbeautifulhair.com','https://www.jussbeautifulhair.com'].includes(url.origin) ||
     env.JBH_STRIPE_COMMERCE_MODE!=='live')return reply('unavailable',404);
  const id=url.pathname.slice('/api/jusspay/orders/'.length);
  if(!id.startsWith('jbho_')||!UUID.test(id.slice(5)))return reply('unavailable',404);
  if(typeof env.JBH_JUSSPAY?.fetch!=='function'||!(env.JBH_JUSSPAY_STOREFRONT_KEY?.length>=32))return reply('unavailable',503);
  try {
    const result=await env.JBH_JUSSPAY.fetch('https://jusspay.internal/jbh/orders/'+id,{
      method:'GET',headers:{'x-jbh-storefront-key':env.JBH_JUSSPAY_STOREFRONT_KEY}
    });
    if(!result.ok)return reply('unavailable',result.status===404?404:503);
    const order=await result.json();
    if(order?.id!==id)return reply('unavailable',503);
    // Only send a coarse order state. Never forward upstream order or contact fields.
    if(order.status==='paid')return reply('paid');
    if(order.status==='pending')return reply('pending');
    if(['refunded','partially_refunded','disputed','expired','payment_failed','failed'].includes(order.status))
      return reply('review');
    return reply('unavailable',503);
  } catch { return reply('unavailable',503); }
}
