import test from 'node:test';
import assert from 'node:assert/strict';
import {parseJussPayCart,handleJussPaySandbox} from '../worker/jusspaySandbox.mjs';
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
