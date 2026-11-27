import test from 'node:test';
import assert from 'node:assert/strict';
import {parseJussPayCart,handleJussPaySandbox,proxyJussPayWebhook,readJussPayOrderState} from '../worker/jusspaySandbox.mjs';
const variant='gid://shopify/ProductVariant/12345';
const requestId='b7f332cd-7930-42a9-8f9d-3f1c777a5f4b';
const body={requestId,shipping:'standard',lines:[{merchandiseId:variant,quantity:2}]};
const mapping={[variant]:'JBH-APPROVED-1'};
const makeRequest=(payload=body,origin='https://jussbeautifulhair.com')=>new Request('https://jussbeautifulhair.com/api/jusspay/sandbox/checkout',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(payload)});
test('server maps Shopify variants to approved SKU without trusting client prices',()=>{
 assert.deepEqual(parseJussPayCart(body,mapping),{requestId,shipping:'standard',items:[{sku:'JBH-APPROVED-1',quantity:2}]});
 assert.throws(()=>parseJussPayCart({...body,price:1},mapping),/invalid_cart/);
 assert.throws(()=>parseJussPayCart({...body,lines:[{merchandiseId:'gid://shopify/ProductVariant/999',quantity:1}]},mapping),/variant_not_approved/);
 assert.throws(()=>parseJussPayCart({...body,lines:[{merchandiseId:variant,quantity:11}]},mapping),/invalid_cart/);
});
test('first-party Juss Beautiful Hair variants map only to approved ledger SKUs',()=>{
 const id='jbh:bundle-bodywave:0';
 const payload={requestId,shipping:'standard',lines:[{merchandiseId:id,quantity:1}]};
 const approved={[id]:'JBH-BW-14'};
 assert.deepEqual(parseJussPayCart(payload,approved),{requestId,shipping:'standard',items:[{sku:'JBH-BW-14',quantity:1}]});
 assert.throws(()=>parseJussPayCart({...payload,lines:[{merchandiseId:'jbh:bundle-bodywave:1',quantity:1}]},approved),/variant_not_approved/);
 assert.throws(()=>parseJussPayCart({...payload,lines:[{merchandiseId:id,quantity:1,price:1}]},approved),/invalid_cart/);
 assert.throws(()=>parseJussPayCart({...payload,lines:[{merchandiseId:'jbh:../secret:0',quantity:1}]},approved),/invalid_cart/);
});

test('disabled lane does not contact payment provider',async()=>{
 let called=false;const response=await handleJussPaySandbox(makeRequest(),{JBH_JUSSPAY:{fetch(){called=true;throw Error('must not call');}}});
 assert.equal(response.status,404);assert.equal(called,false);
});
test('sandbox service binding receives only SKU quantities and idempotency ID',async()=>{
 let forwarded;
 const env={JBH_JUSSPAY_SANDBOX_ENABLED:'true',JBH_JUSSPAY_VARIANT_SKUS:JSON.stringify(mapping),JBH_JUSSPAY_STOREFRONT_KEY:'x'.repeat(32),JBH_JUSSPAY:{async fetch(url,init){forwarded={url,init};return Response.json({url:'https://checkout.stripe.com/c/pay/cs_test_123',orderId:'jbho_test'});}}};
 const response=await handleJussPaySandbox(makeRequest(),env);
 assert.equal(response.status,200);assert.equal((await response.json()).mode,'sandbox');
 assert.equal(forwarded.url,'https://jusspay.internal/jbh/checkout');
 assert.deepEqual(JSON.parse(forwarded.init.body),{requestId,shipping:'standard',items:[{sku:'JBH-APPROVED-1',quantity:2}]});
 assert.equal(forwarded.init.headers['x-jbh-storefront-key'],'x'.repeat(32));
});
test('origin mismatch, missing mapping and unsafe provider redirect fail closed',async()=>{
 const env={JBH_JUSSPAY_SANDBOX_ENABLED:'true',JBH_JUSSPAY_VARIANT_SKUS:JSON.stringify(mapping),JBH_JUSSPAY_STOREFRONT_KEY:'x'.repeat(32),JBH_JUSSPAY:{async fetch(){return Response.json({url:'https://evil.example/c/pay/123'});}}};
 assert.equal((await handleJussPaySandbox(makeRequest(body,'https://evil.example'),env)).status,403);
 assert.equal((await handleJussPaySandbox(makeRequest(),{...env,JBH_JUSSPAY_VARIANT_SKUS:'{}'})).status,400);
 assert.equal((await handleJussPaySandbox(makeRequest(),env)).status,502);
});

test('sandbox discovery is disabled by default and explicitly marked test-only',async()=>{
 const url='https://jussbeautifulhair.com/api/jusspay/sandbox/checkout';
 const off=await handleJussPaySandbox(new Request(url),{});
 assert.equal(off.status,404);
 const unconfigured=await handleJussPaySandbox(new Request(url),{JBH_JUSSPAY_SANDBOX_ENABLED:'true'});
 assert.equal(unconfigured.status,503);
 const upstreams=[];
 const on=await handleJussPaySandbox(new Request(url),{JBH_JUSSPAY_SANDBOX_ENABLED:'true',JBH_JUSSPAY_VARIANT_SKUS:JSON.stringify(mapping),JBH_JUSSPAY_STOREFRONT_KEY:'x'.repeat(32),JBH_JUSSPAY:{fetch:async(input,init)=>{upstreams.push({input,init});return Response.json({ready:true,mode:'sandbox',chargesEnabled:true});}}});
 assert.deepEqual(await on.json(),{enabled:true,mode:'sandbox'});
 assert.equal(upstreams[0].input,'https://jusspay.internal/jbh/health');
 assert.equal(upstreams[0].init.headers['x-jbh-storefront-key'],'x'.repeat(32));
});
test('provider response without an order receipt is rejected',async()=>{
 const env={JBH_JUSSPAY_SANDBOX_ENABLED:'true',JBH_JUSSPAY_VARIANT_SKUS:JSON.stringify(mapping),JBH_JUSSPAY_STOREFRONT_KEY:'x'.repeat(32),JBH_JUSSPAY:{async fetch(){return Response.json({url:'https://checkout.stripe.com/c/pay/cs_test_123'});}}};
 const response=await handleJussPaySandbox(makeRequest(),env);
 assert.equal(response.status,502);
});

test('live discovery is explicit and never inherits sandbox enablement',async()=>{
 const url='https://jussbeautifulhair.com/api/jusspay/live/checkout';
 const base={JBH_JUSSPAY_VARIANT_SKUS:JSON.stringify(mapping),JBH_JUSSPAY_STOREFRONT_KEY:'x'.repeat(32),JBH_JUSSPAY:{fetch:async()=>Response.json({ready:true,mode:'live',chargesEnabled:true})}};
 const sandboxOnly=await handleJussPaySandbox(new Request(url),{...base,JBH_JUSSPAY_SANDBOX_ENABLED:'true'});
 assert.equal(sandboxOnly.status,404);
 const missingCatalogApproval=await handleJussPaySandbox(new Request(url),{...base,JBH_JUSSPAY_LIVE_ENABLED:'true'});
 assert.equal(missingCatalogApproval.status,404);
 const enabled={...base,JBH_JUSSPAY_LIVE_ENABLED:'true',JBH_STRIPE_COMMERCE_MODE:'live'};
 const preview=await handleJussPaySandbox(new Request('https://preview.jussb.pages.dev/api/jusspay/live/checkout'),enabled);
 assert.equal(preview.status,404);
 const insecure=await handleJussPaySandbox(new Request('http://jussbeautifulhair.com/api/jusspay/live/checkout'),enabled);
 assert.equal(insecure.status,404);
 const live=await handleJussPaySandbox(new Request(url),enabled);
 assert.deepEqual(await live.json(),{enabled:true,mode:'live'});
 const wrongMode=await handleJussPaySandbox(new Request(url),{...base,JBH_JUSSPAY_LIVE_ENABLED:'true',JBH_STRIPE_COMMERCE_MODE:'live',JBH_JUSSPAY:{fetch:async()=>Response.json({ready:true,mode:'sandbox',chargesEnabled:true})}});
 assert.equal(wrongMode.status,503);
 assert.deepEqual(await wrongMode.json(),{error:'live_unavailable'});
});
test('live checkout remains off unless independently enabled',async()=>{
 let called=false;
 const req=new Request('https://jussbeautifulhair.com/api/jusspay/live/checkout',{method:'POST',headers:{origin:'https://jussbeautifulhair.com','content-type':'application/json'},body:JSON.stringify(body)});
 const env={JBH_JUSSPAY_SANDBOX_ENABLED:'true',JBH_JUSSPAY:{fetch(){called=true;throw Error('must not call');}}};
 assert.equal((await handleJussPaySandbox(req,env)).status,404);
 assert.equal(called,false);
});
test('live route requires a live checkout URL and does not accept sandbox session',async()=>{
 const req=new Request('https://jussbeautifulhair.com/api/jusspay/live/checkout',{method:'POST',headers:{origin:'https://jussbeautifulhair.com','content-type':'application/json'},body:JSON.stringify(body)});
 const env={JBH_JUSSPAY_LIVE_ENABLED:'true',JBH_STRIPE_COMMERCE_MODE:'live',JBH_JUSSPAY_VARIANT_SKUS:JSON.stringify(mapping),JBH_JUSSPAY_STOREFRONT_KEY:'x'.repeat(32),JBH_JUSSPAY:{async fetch(){return Response.json({url:'https://checkout.stripe.com/c/pay/cs_test_123',orderId:'jbho_test'});}}};
 const response=await handleJussPaySandbox(req.clone(),env);
 assert.equal(response.status,502);
 assert.equal((await response.json()).error,'wrong_checkout_mode');
 const ok=await handleJussPaySandbox(req.clone(),{...env,JBH_JUSSPAY:{async fetch(){return Response.json({url:'https://checkout.stripe.com/c/pay/cs_live_123',orderId:'jbho_test'});}}});
 assert.equal(ok.status,200);assert.equal((await ok.json()).mode,'live');
});


test('public webhook proxy preserves Stripe signature and raw body',async()=>{
 const raw='{"id":"evt_live_123","type":"checkout.session.completed"}';
 let forwarded;
 const env={JBH_JUSSPAY:{async fetch(request){forwarded=request;return new Response('ok',{status:200,headers:{'cache-control':'no-store'}});}}};
 const request=new Request('https://jussbeautifulhair.com/api/jusspay/webhook',{method:'POST',headers:{'stripe-signature':'t=123,v1=abc','content-type':'application/json'},body:raw});
 const response=await proxyJussPayWebhook(request,env);
 assert.equal(response.status,200);
 assert.equal(new URL(forwarded.url).pathname,'/jbh/webhook');
 assert.equal(forwarded.headers.get('stripe-signature'),'t=123,v1=abc');
 assert.equal(forwarded.headers.get('content-type'),'application/json');
 assert.equal(await forwarded.text(),raw);
});

test('public webhook proxy is POST-only and fails closed without the private service binding',async()=>{
 assert.equal((await proxyJussPayWebhook(new Request('https://jussbeautifulhair.com/api/jusspay/webhook'),{})).status,405);
 const post=new Request('https://jussbeautifulhair.com/api/jusspay/webhook',{method:'POST',body:'{}'});
 const response=await proxyJussPayWebhook(post,{});
 assert.equal(response.status,503);
 assert.deepEqual(await response.json(),{error:'webhook_unavailable'});
});

test('live multi-item cart keeps Stripe opaque checkout fragment and rejects mode spoofing',async()=>{
 const first='jbh:wig-13x6-bob:0',second='jbh:wig-upart-deepwave:0';
 const payload={requestId,shipping:'standard',lines:[{merchandiseId:first,quantity:1},{merchandiseId:second,quantity:2}]};
 const req=()=>new Request('https://jussbeautifulhair.com/api/jusspay/live/checkout',{method:'POST',
  headers:{origin:'https://jussbeautifulhair.com','content-type':'application/json'},body:JSON.stringify(payload)});
 let url='https://checkout.stripe.com/c/pay/cs_live_example123#opaque%2Fcheckout%3D';
 let forwarded;
 const env={JBH_JUSSPAY_LIVE_ENABLED:'true',JBH_STRIPE_COMMERCE_MODE:'live',
  JBH_JUSSPAY_VARIANT_SKUS:JSON.stringify({[first]:'JBH-BOB-10',[second]:'JBH-UPART-20'}),
  JBH_JUSSPAY_STOREFRONT_KEY:'x'.repeat(32),
  JBH_JUSSPAY:{async fetch(_path,init){forwarded=JSON.parse(init.body);return Response.json({url,orderId:'jbho_fixture'});}}};
 const ok=await handleJussPaySandbox(req(),env);
 assert.equal(ok.status,200);
 assert.deepEqual(await ok.json(),{url,mode:'live'});
 assert.deepEqual(forwarded,{requestId,shipping:'standard',items:[{sku:'JBH-BOB-10',quantity:1},{sku:'JBH-UPART-20',quantity:2}]});
 url='https://checkout.stripe.com/c/pay/cs_test_example123#/cs_live_fake';
 assert.equal((await (await handleJussPaySandbox(req(),env)).json()).error,'wrong_checkout_mode');
 for(const value of ['https://checkout.stripe.com/c/redirect/cs_live_fake',
  'https://checkout.stripe.com.evil.example/c/pay/cs_live_fake',
  'https://checkout.stripe.com/c/pay/cs_live_fake?redirect=https://evil.example']){
  url=value;
  assert.equal((await handleJussPaySandbox(req(),env)).status,502);
 }
});

test('checkout return reads only the exact live order and never exposes order details',async()=>{
 const id='jbho_'+requestId;
 const make=(host='https://jussbeautifulhair.com', order=id, method='GET')=>new Request(host+'/api/jusspay/orders/'+order,{method});
 let state='pending',reportedId=id,calls=0;
 const config={JBH_STRIPE_COMMERCE_MODE:'live',JBH_JUSSPAY_STOREFRONT_KEY:'x'.repeat(32),JBH_JUSSPAY:{async fetch(path,options){
  assert.equal(path,'https://jusspay.internal/jbh/orders/'+id);
  assert.equal(options.method,'GET');
  calls++;
  return Response.json({id:reportedId,status:state,items:[{name:'private fixture'}],total:13500});
 }}};
 const invalid=await readJussPayOrderState(make(undefined,'jbho_not-valid'),config);
 assert.equal(invalid.status,404);
 assert.equal((await readJussPayOrderState(make('https://preview.example'),config)).status,404);
 assert.equal((await readJussPayOrderState(make(),{...config,JBH_STRIPE_COMMERCE_MODE:'test'})).status,404);
 assert.equal((await readJussPayOrderState(make(undefined,id,'POST'),config)).status,405);
 assert.equal(calls,0);
 assert.deepEqual(await (await readJussPayOrderState(make(),config)).json(),{state:'pending'});
 state='paid'; const paid=await readJussPayOrderState(make(),config);
 assert.equal(paid.headers.get('cache-control'),'no-store');
 assert.deepEqual(await paid.json(),{state:'paid'});
 reportedId='a-different-order';
 assert.equal((await readJussPayOrderState(make(),config)).status,503);
 reportedId=id;state='refunded';
 assert.deepEqual(await (await readJussPayOrderState(make(),config)).json(),{state:'review'});
});
