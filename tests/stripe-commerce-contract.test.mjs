import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getStripeCommerceState } from "../worker/stripeCommerce.mjs";
const products=[{id:"bundle-bodywave",name:"Body Wave",category:"Bundles",tagline:"Wavy",description:"Hair",image:"/products/bundle-bodywave.jpg",variants:[{option:'14"',price:75},{option:'16"',price:85}]}];
const merchant="acct_1TfbELRp7J40bCrl";
const approve=[{id:"bundle-bodywave",variant:'14"',priceCents:7500}];
function env(overrides={}) {return { ENABLE_LEGACY_STRIPE_CHECKOUT:"true",JBH_STRIPE_COMMERCE_MODE:"test",STRIPE_SECRET_KEY:"sk_test_example-not-a-key",JBH_STRIPE_ACCOUNT_ID:merchant,JBH_STRIPE_APPROVED_OFFERS:JSON.stringify(approve),...overrides};}
test("First-party catalog remains disabled without explicit authority",()=>{
 for(const e of [{},env({ENABLE_LEGACY_STRIPE_CHECKOUT:"false"}),env({JBH_STRIPE_COMMERCE_MODE:"shopify"}),env({STRIPE_SECRET_KEY:"sk_live_example"}),env({JBH_STRIPE_ACCOUNT_ID:""}),env({JBH_STRIPE_APPROVED_OFFERS:"[]"}),env({JBH_STRIPE_APPROVED_OFFERS:"invalid"})]) assert.equal(getStripeCommerceState(e,products),null);
});
test("Test payments cannot appear on either public branded hostname",()=>{
 assert.equal(getStripeCommerceState(env(),products,"https://jussbeautifulhair.com/shop"),null);
 assert.equal(getStripeCommerceState(env(),products,"https://www.jussbeautifulhair.com/shop"),null);
 assert.equal(getStripeCommerceState(env(),products,"https://preview.jussb.pages.dev/shop")?.mode,"test");
});
test("Only server-approved product variants and matching prices are made purchasable",()=>{
 const state=getStripeCommerceState(env(),products);
 assert.equal(state?.mode,"test");assert.equal(state?.catalog.length,1);
 assert.equal(state?.catalog[0].shopifyProductId,"jbh:catalog");
 assert.deepEqual(state?.catalog[0].variants.map(x=>x.id),["jbh:bundle-bodywave:0"]);
 assert.equal(state?.catalog[0].variants[0].price,75);
 assert.ok(state?.approved.has("bundle-bodywave:0"));assert.ok(!state?.approved.has("bundle-bodywave:1"));
});
test("Stale, tampered, malformed or duplicate offers fail closed",()=>{
 for(const approvals of [
 [{id:"bundle-bodywave",variant:'16"',priceCents:7500}],
 [{id:"unknown",variant:'14"',priceCents:7500}],
 [{id:"bundle-bodywave",variant:'14"',priceCents:7499}],
 [{id:"bundle-bodywave",variant:'14"',priceCents:7500,extra:true}],
 [...approve,...approve]
 ]) assert.equal(getStripeCommerceState(env({JBH_STRIPE_APPROVED_OFFERS:JSON.stringify(approvals)}),products),null);
});
test("Live mode requires Beauty Co merchant identity and explicit charging and fulfillment gates",()=>{
 const base={JBH_STRIPE_COMMERCE_MODE:"live",STRIPE_SECRET_KEY:"sk_live_example"};
 for(const changes of [{},{JBH_STRIPE_LIVE_ENABLED:"true"},{JBH_STRIPE_FULFILLMENT_READY:"true"},{JBH_STRIPE_LIVE_ENABLED:"true",JBH_STRIPE_FULFILLMENT_READY:"true",JBH_STRIPE_ACCOUNT_ID:"acct_1U4xNyRs4gw4sfJH"}]) assert.equal(getStripeCommerceState(env({...base,...changes}),products),null);
 assert.equal(getStripeCommerceState(env({...base,JBH_STRIPE_LIVE_ENABLED:"true",JBH_STRIPE_FULFILLMENT_READY:"true"}),products)?.mode,"live");
});
test("Checkout requires server-side approved offer and merchant checks, never client prices",()=>{
 const worker=readFileSync(new URL("../worker/index.ts",import.meta.url),"utf8");
 const checkout=readFileSync(new URL("../client/src/pages/Checkout.tsx",import.meta.url),"utf8");
 const cart=readFileSync(new URL("../client/src/lib/cart.tsx",import.meta.url),"utf8");
 assert.match(worker,/getStripeCommerceState\(env, PRODUCTS, request\.url\)/);
 assert.match(worker,/commerce\.approved\.has/);
 assert.match(worker,/stripe\.accounts\.retrieve\(\)/);
 assert.match(worker,/merchant\.id !== env\.JBH_STRIPE_ACCOUNT_ID/);
 assert.match(checkout,/stripeCart \? "\/api\/checkout"/);
 assert.match(checkout,/checkoutAttemptId: checkoutAttempt\.current\.requestId/);
 assert.match(checkout,/mixedCart/);
 assert.ok(cart.includes("jbh:"));
});
