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
const app = await readFile(new URL("../client/src/App.tsx", import.meta.url), "utf8");

test("Shopify Storefront Cart API owns the bridge-offer checkout", () => {
  assert.match(storefront, /mutation CreateCart/);
  assert.match(storefront, /cartCreate\(input: \$input\)/);
  assert.match(storefront, /checkoutUrl/);
  assert.match(storefront, /X-Shopify-Storefront-Access-Token/);
  assert.doesNotMatch(storefront, /STRIPE_SECRET_KEY/);
});

test("Hair Match route preserves truthful non-physical-product disclosure", () => {
  assert.match(app, /path="\/hair-match"/);
  assert.match(hairMatch, /not an order\s+for physical hair/s);
  assert.match(hairMatch, /no hair product ships from this purchase/);
  assert.match(hairMatch, /Secure checkout powered by Shopify/);
});

test("Shopify configuration remains environment-bound", () => {
  assert.match(storefront, /VITE_SHOPIFY_STORE_DOMAIN/);
  assert.match(storefront, /VITE_SHOPIFY_STOREFRONT_TOKEN/);
  assert.match(hairMatch, /VITE_SHOPIFY_HAIR_MATCH_VARIANT_ID/);
});
