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

test("tokenless Shopify cart permalink owns the bridge-offer checkout", () => {
  assert.match(storefront, /\/cart\/\$\{variantId\}:\$\{quantity\}/);
  assert.ok(
    storefront.includes(
      "merchandiseId.match(/^gid:\\/\\/shopify\\/ProductVariant\\/(\\d+)$/)",
    ),
    "Shopify variant GID must be reduced to a numeric permalink variant ID.",
  );
  assert.match(storefront, /checkout\.searchParams\.set\(`attributes\[\$\{key\}\]`/);
  assert.match(storefront, /checkoutUrl/);
  assert.doesNotMatch(storefront, /X-Shopify-Storefront-Access-Token/);
  assert.doesNotMatch(storefront, /VITE_SHOPIFY_STOREFRONT_(?:ACCESS|TOKEN)/);
  assert.doesNotMatch(storefront, /STRIPE_SECRET_KEY/);
});

test("Hair Match route preserves truthful non-physical-product disclosure", () => {
  assert.match(app, /path="\/hair-match"/);
  assert.match(hairMatch, /not an order\s+for physical hair/s);
  assert.match(hairMatch, /no hair product ships from this purchase/);
  assert.match(hairMatch, /Secure checkout powered by Shopify/);
});

test("Hair Match preferences are bounded non-sensitive cart attributes", () => {
  for (const key of ["hair_goal", "preferred_length", "budget", "maintenance"]) {
    assert.match(storefront, new RegExp(key));
    assert.match(hairMatch, new RegExp(`key: "${key}"`));
  }
  assert.match(storefront, /offer", value: "jbh-hair-match-v1/);
  assert.match(storefront, /value\.trim\(\)\.slice\(0, 120\)/);
  assert.match(storefront, /ref", "jbh-hair-match-v1/);
  assert.doesNotMatch(hairMatch, /race|ethnicity|medical|health|income|address/i);
});

test("Shopify configuration requires only public store and variant identifiers", () => {
  assert.match(storefront, /VITE_SHOPIFY_STORE_DOMAIN/);
  assert.match(storefront, /\.myshopify\\\.com/);
  assert.match(hairMatch, /VITE_SHOPIFY_HAIR_MATCH_VARIANT_ID/);
  assert.doesNotMatch(storefront, /API_VERSION|STOREFRONT_ACCESS|access_token/);
});

test("shared storefront chrome does not overstate launch or fulfillment status", () => {
  assert.match(layout, /href: "\/hair-match", label: "Hair Match"/);
  assert.match(layout, /Founding-client Hair Match/);
  assert.doesNotMatch(layout, /Now Open/i);
  assert.doesNotMatch(layout, /shipped from the US/i);
  assert.doesNotMatch(layout, /shipping nationwide/i);
});
