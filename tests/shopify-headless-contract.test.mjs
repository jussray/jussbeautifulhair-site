import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const storefront = await readFile(
  new URL("../client/src/lib/shopifyStorefront.ts", import.meta.url),
  "utf8",
);
const hairMatch = await readFile(
  new URL("../client/src/pages/HairMatch.tsx", import.meta.url),
  "utf8",
);
const layout = await readFile(
  new URL("../client/src/components/Layout.tsx", import.meta.url),
  "utf8",
);
const app = await readFile(new URL("../client/src/App.tsx", import.meta.url), "utf8");

test("approved tokenless Shopify contract owns the Hair Match checkout", () => {
  for (const required of [
    'shopDomain: "8qp1z2-az.myshopify.com"',
    'variantGid: "gid://shopify/ProductVariant/50196622344435"',
    'offerCode: "jbh-hair-match-v1"',
    'source: "jussbeautifulhair.com"',
    'quantity: 1',
    'priceUsd: "25.00"',
    "createHairMatchCheckout",
    "/cart/${variantId}:${HAIR_MATCH_SHOPIFY_CONTRACT.quantity}",
    "checkout.searchParams.set(`attributes[${key}]`, value)",
  ]) {
    assert.ok(storefront.includes(required), `missing Shopify contract: ${required}`);
  }

  assert.doesNotMatch(storefront, /X-Shopify-Storefront-Access-Token/);
  assert.doesNotMatch(storefront, /VITE_SHOPIFY|import\.meta\.env/);
  assert.doesNotMatch(storefront, /STRIPE_SECRET_KEY|access_token/);
});

test("Hair Match route preserves truthful non-physical-product disclosure", () => {
  assert.match(app, /path="\/hair-match"/);
  assert.match(hairMatch, /not an order\s+for physical hair/s);
  assert.match(hairMatch, /no hair product ships from this purchase/);
  assert.match(hairMatch, /Secure checkout powered by Shopify/);
});

test("Hair Match preferences are complete, unique, bounded, and non-sensitive", () => {
  for (const key of ["hair_goal", "preferred_length", "budget", "maintenance"]) {
    assert.match(storefront, new RegExp(key));
    assert.match(hairMatch, new RegExp(`key: "${key}"`));
  }
  assert.match(storefront, /seen\.has\(key\)/);
  assert.match(storefront, /normalized\.length !== expectedKeys\.size/);
  assert.match(storefront, /value\.trim\(\)\.slice\(0, 120\)/);
  assert.doesNotMatch(hairMatch, /race|ethnicity|medical|health|income|address/i);
});

test("approved checkout is deploy-ready without unproven build variables", () => {
  assert.match(hairMatch, /createHairMatchCheckout\(preferences\)/);
  assert.match(hairMatch, /disabled=\{submitting\}/);
  assert.doesNotMatch(hairMatch, /VITE_SHOPIFY|import\.meta\.env/);
  assert.doesNotMatch(hairMatch, /Checkout opens after the Shopify storefront connection/);
});

test("shared storefront chrome does not overstate launch or fulfillment status", () => {
  assert.match(layout, /href: "\/hair-match", label: "Hair Match"/);
  assert.match(layout, /Founding-client Hair Match/);
  assert.doesNotMatch(layout, /Now Open/i);
  assert.doesNotMatch(layout, /shipped from the US/i);
  assert.doesNotMatch(layout, /shipping nationwide/i);
});
