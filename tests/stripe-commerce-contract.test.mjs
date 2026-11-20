import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getStripeCommerceState } from "../worker/stripeCommerce.mjs";
import { handleJussPaySandbox } from "../worker/jusspaySandbox.mjs";
const edge = readFileSync(new URL("../worker/entry.ts", import.meta.url), "utf8");

const products=[{id:"bundle-bodywave",name:"Body Wave",category:"Bundles",tagline:"Wavy",description:"Hair",image:"/products/bundle-bodywave.jpg",variants:[{option:'14"',price:75},{option:'16"',price:85}]}];
const approve=[{id:"bundle-bodywave",variant:'14"',priceCents:7500}];
const variantId="jbh:bundle-bodywave:0";
const testOrigin="https://preview.jussb.pages.dev/shop";
const catalogClient = readFileSync(new URL("../client/src/lib/shopifyCatalog.ts",import.meta.url),"utf8");
const storefrontConfig = readFileSync(new URL("../wrangler.toml",import.meta.url),"utf8");
const frontdoorConfig = readFileSync(new URL("../wrangler.frontdoor.toml",import.meta.url),"utf8");
const storefrontShop = readFileSync(new URL("../client/src/pages/Shop.tsx",import.meta.url),"utf8");

function env(overrides={}) {
  return {
    JBH_STRIPE_COMMERCE_MODE:"test",
    JBH_STRIPE_APPROVED_OFFERS:JSON.stringify(approve),
    JBH_JUSSPAY_SANDBOX_ENABLED:"true",
    JBH_JUSSPAY_VARIANT_SKUS:JSON.stringify({[variantId]:"JBH-BW-14"}),
    JBH_JUSSPAY_STOREFRONT_KEY:"x".repeat(40),
    JBH_JUSSPAY:{fetch:async()=>Response.json({ready:true,mode:"sandbox",chargesEnabled:true})},
    ...overrides
  };
}
const commerce=(x)=>getStripeCommerceState(x,products,testOrigin);
test("JussPay-first commerce never silently falls back to frozen Shopify",()=>{
 for(const cfg of [storefrontConfig,frontdoorConfig]) {
   assert.match(cfg,/JBH_COMMERCE_PROVIDER = "jusspay"/);
   assert.match(cfg,/JBH_JUSSPAY_LIVE_ENABLED = "false"/);
   assert.match(cfg,/ENABLE_LEGACY_STRIPE_CHECKOUT = "false"/);
 }
 const worker=readFileSync(new URL("../worker/index.ts",import.meta.url),"utf8");
 assert.match(worker,/env\.JBH_COMMERCE_PROVIDER === "shopify"/);
 assert.match(worker,/jusspay_unavailable/);
 assert.match(worker,/shopify_checkout_disabled/);
 assert.match(catalogClient,/commerce\.mode === "jusspay_unavailable"/);
 assert.match(catalogClient,/throw new Error\("JussPay is preparing the approved catalog for checkout."\)/);
 assert.match(catalogClient,/if \(!commerceResponse\.ok\)/);
 assert.doesNotMatch(storefrontShop,/secure checkout powered by Shopify/);
});

test("Catalog is off without JussPay ledger authority, approvals, and exact SKU mapping",()=>{
  for(const unsafe of [
    {},
    env({JBH_JUSSPAY_SANDBOX_ENABLED:"false"}),
    env({JBH_JUSSPAY_STOREFRONT_KEY:""}),
    env({JBH_JUSSPAY:null}),
    env({JBH_STRIPE_COMMERCE_MODE:"shopify"}),
    env({JBH_STRIPE_APPROVED_OFFERS:"[]"}),
    env({JBH_STRIPE_APPROVED_OFFERS:"invalid"}),
    env({JBH_JUSSPAY_VARIANT_SKUS:"{}"}),
    env({JBH_JUSSPAY_VARIANT_SKUS:JSON.stringify({[variantId]:"JBH-BW-14", "jbh:bundle-bodywave:1":"JBH-BW-16"})}),
    env({JBH_JUSSPAY_VARIANT_SKUS:JSON.stringify({[variantId]:"not-approved"})}),
  ]) assert.equal(commerce(unsafe),null);
});
test("Test-mode sale catalog cannot appear on either public branded hostname",()=>{
 assert.equal(getStripeCommerceState(env(),products,"https://jussbeautifulhair.com/shop"),null);
 assert.equal(getStripeCommerceState(env(),products,"https://www.jussbeautifulhair.com/shop"),null);
 assert.equal(getStripeCommerceState(env(),products),null);
 assert.equal(commerce(env())?.mode,"test");
});
test("Direct live checkout is blocked by the Worker before JussPay unless the exact offer catalog is approved",()=>{
 assert.match(edge,/getStripeCommerceState\(env, PRODUCTS, request\.url\)\?\.mode !== "live"/);
 assert.match(edge,/pathname === "\/api\/jusspay\/live\/checkout"/);
 assert.match(edge,/status: 404, headers: \{ "Cache-Control": "no-store" \}/);
});

test("Live catalog is branded-only and requires independent JussPay live approval",()=>{
 const approved=env({JBH_STRIPE_COMMERCE_MODE:"live",JBH_JUSSPAY_LIVE_ENABLED:"true",JBH_JUSSPAY_SANDBOX_ENABLED:"false"});
 const branded="https://jussbeautifulhair.com/shop";
 assert.equal(getStripeCommerceState(approved,products,branded)?.mode,"live");
 assert.equal(getStripeCommerceState(approved,products,"https://www.jussbeautifulhair.com/shop")?.mode,"live");
 assert.equal(getStripeCommerceState(approved,products,testOrigin),null);
 assert.equal(getStripeCommerceState(approved,products,"http://jussbeautifulhair.com/shop"),null);
 assert.equal(getStripeCommerceState(env({JBH_STRIPE_COMMERCE_MODE:"live"}),products,branded),null);
 assert.equal(getStripeCommerceState(env({JBH_STRIPE_COMMERCE_MODE:"live",JBH_JUSSPAY_LIVE_ENABLED:"false"}),products,branded),null);
 assert.equal(getStripeCommerceState(approved,products),null);
 assert.equal(getStripeCommerceState(approved,products,branded)?.catalog[0]?.variants[0]?.price,75);
});

test("Only explicitly approved server-priced variants can become purchasable through JussPay",()=>{
 const state=commerce(env());
 assert.equal(state?.mode,"test");
 assert.equal(state?.catalog.length,1);
 assert.equal(state?.catalog[0].shopifyProductId,"jbh:catalog");
 assert.deepEqual(state?.catalog[0].variants.map(x=>x.id),[variantId]);
 assert.equal(state?.catalog[0].variants[0].price,75);
 assert.ok(state?.approved.has("bundle-bodywave:0"));
 assert.ok(!state?.approved.has("bundle-bodywave:1"));
});
test("Unapproved, stale, duplicated, or tampered offers remain unavailable",()=>{
 for(const approvals of [
 [{id:"bundle-bodywave",variant:'16"',priceCents:7500}],
 [{id:"unknown",variant:'14"',priceCents:7500}],
 [{id:"bundle-bodywave",variant:'14"',priceCents:7499}],
 [{id:"bundle-bodywave",variant:'14"',priceCents:7500,extra:true}],
 [...approve,...approve]
 ]) assert.equal(commerce(env({JBH_STRIPE_APPROVED_OFFERS:JSON.stringify(approvals)})),null);
});
test("Direct live Stripe catalog is held even with both legacy live flags asserted",()=>{
 for(const values of [
  {},
  {ENABLE_LEGACY_STRIPE_CHECKOUT:"true",STRIPE_SECRET_KEY:"sk_live_example",JBH_STRIPE_LIVE_ENABLED:"true",JBH_STRIPE_FULFILLMENT_READY:"true",JBH_STRIPE_ACCOUNT_ID:"acct_1TfbELRp7J40bCrl"},
 ]) assert.equal(commerce(env({...values,JBH_STRIPE_COMMERCE_MODE:"live"})),null);
});
test("First-party checkout uses JussPay's order ledger, never direct legacy Stripe sessions",()=>{
 const worker=readFileSync(new URL("../worker/index.ts",import.meta.url),"utf8");
 const checkout=readFileSync(new URL("../client/src/pages/Checkout.tsx",import.meta.url),"utf8");
 const cart=readFileSync(new URL("../client/src/lib/cart.tsx",import.meta.url),"utf8");
 assert.match(worker,/getStripeCommerceState\(env, PRODUCTS, request\.url\)/);
 assert.match(worker,/handleJussPaySandbox\(/);
 assert.match(worker,/Use the JussPay order-ledger checkout/);
 assert.match(checkout,/stripeCart \? \(checkoutMode === "live" \? "\/api\/jusspay\/live\/checkout" : "\/api\/jusspay\/sandbox\/checkout"\)/);
 assert.match(checkout,/readiness\.mode !== paymentMode/);
 assert.match(worker,/readiness\.mode !== expectedMode/);
 assert.match(checkout,/const paymentMode = result\.mode === "live" \? "live" : "sandbox"/);
 assert.match(checkout,/requestId: checkoutAttempt\.current\.requestId/);
 assert.match(checkout,/merchandiseId: item\.variantId/);
 assert.doesNotMatch(checkout,/stripeCart \? "\/api\/checkout"/);
 assert.match(checkout,/mixedCart/);
 assert.ok(cart.includes("jbh:"));
});

test("First-party test catalog routes through JussPay health, exact SKU map, and receipt-bearing checkout",async()=>{
 const calls=[];
 const configured=env({JBH_JUSSPAY:{async fetch(url,opts){
   calls.push({url,opts});
   if (url.endsWith("/jbh/health")) return Response.json({ready:true,mode:"sandbox",chargesEnabled:true});
   if (url.endsWith("/jbh/checkout")) return Response.json({
     orderId:"jbho_synthetic_receipt",
     url:"https://checkout.stripe.com/c/pay/cs_test_synthetic",
   });
   return new Response("not found",{status:404});
 }}});
 const firstParty=getStripeCommerceState(configured,products,testOrigin);
 assert.equal(firstParty?.catalog[0]?.variants[0]?.id,variantId);
 const endpoint="https://preview.jussb.pages.dev/api/jusspay/sandbox/checkout";
 const health=await handleJussPaySandbox(new Request(endpoint),configured);
 assert.deepEqual(await health.json(),{enabled:true,mode:"sandbox"});
 const attempt="b7f332cd-7930-42a9-8f9d-3f1c777a5f4b";
 const request=new Request(endpoint,{method:"POST",headers:{origin:"https://preview.jussb.pages.dev","content-type":"application/json"},
  body:JSON.stringify({requestId:attempt,shipping:"standard",lines:[{merchandiseId:variantId,quantity:1}]})});
 const payment=await handleJussPaySandbox(request,configured);
 assert.equal(payment.status,200);
 assert.equal((await payment.json()).mode,"sandbox");
 assert.deepEqual(JSON.parse(calls[1].opts.body),{
   requestId:attempt,shipping:"standard",items:[{sku:"JBH-BW-14",quantity:1}]
 });
 assert.equal(calls.length,2);
 const worker=readFileSync(new URL("../worker/index.ts",import.meta.url),"utf8");
 assert.match(worker,/if \(!health\.ok \|\| readiness\?\.enabled !== true \|\| readiness\.mode !== expectedMode\)/);
});

test("Shopify browser harness mocks the default-off commerce route without muting console errors",()=>{
 const script=readFileSync(new URL("../scripts/shopify-headless-playwright.mjs",import.meta.url),"utf8");
 assert.match(script,/page\.route\("\*\*\/api\/commerce\/catalog"/);
 assert.match(script,/body: JSON\.stringify\(\{ mode: "shopify", products: \[\] \}\)/);
 assert.match(script,/assert\(consoleErrors\.length === 0/);
});

test("Physical browser proof models first-party commerce as default-off without muting console errors",()=>{
 const script=readFileSync(new URL("../scripts/shopify-physical-playwright.mjs",import.meta.url),"utf8");
 assert.match(script,/configureCommerceDefaultOffMock\(page\)/);
 assert.match(script,/page\.route\("\*\*\/api\/commerce\/catalog"/);
 assert.match(script,/body: JSON\.stringify\(\{ mode: "shopify", products: \[\] \}\)/);
 assert.match(script,/assert\(consoleErrors\.length === 0/);
});
