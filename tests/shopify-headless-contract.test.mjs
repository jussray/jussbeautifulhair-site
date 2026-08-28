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
const catalogClient = await readFile(
  new URL("../client/src/lib/shopifyCatalog.ts", import.meta.url),
  "utf8",
);
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
const layout = await readFile(
  new URL("../client/src/components/Layout.tsx", import.meta.url),
  "utf8",
);
const app = await readFile(new URL("../client/src/App.tsx", import.meta.url), "utf8");

test("approved Hair Match checkout reuses the guarded Shopify cart bridge", () => {
  for (const required of [
    'shopDomain: "8qp1z2-az.myshopify.com"',
    'variantGid: "gid://shopify/ProductVariant/50196622344435"',
    'offerCode: "jbh-hair-match-v1"',
    'source: "jussbeautifulhair.com"',
    'quantity: 1',
    'priceUsd: "25.00"',
    "createHairMatchCheckout",
    'fetch("/api/shopify/cart"',
    "merchandiseId: HAIR_MATCH_SHOPIFY_CONTRACT.variantGid",
    "hairMatch:",
    "attributes: normalizeAttributes(attributes)",
    "assertApprovedShopifyCheckoutRedirect(payload.checkoutUrl)",
  ]) {
    assert.ok(storefront.includes(required), `missing Shopify contract: ${required}`);
  }

  assert.doesNotMatch(storefront, /\/cart\/\$\{variantId\}/);
  assert.doesNotMatch(storefront, /X-Shopify-Storefront-Access-Token/);
  assert.doesNotMatch(storefront, /VITE_SHOPIFY|import\.meta\.env/);
  assert.doesNotMatch(storefront, /STRIPE_SECRET_KEY|access_token/);
  assert.match(catalogClient, /checkoutHost === "jussbeautifulhair\.com"/);
  assert.match(catalogClient, /checkout\.hostname = SHOPIFY_PUBLIC_CONTRACT\.shopDomain/);
});

test("Worker binds Hair Match metadata to the one approved variant", () => {
  for (const required of [
    'const HAIR_MATCH_VARIANT_GID = "gid://shopify/ProductVariant/50196622344435"',
    'const HAIR_MATCH_OFFER_CODE = "jbh-hair-match-v1"',
    'z.enum(["hair_goal", "preferred_length", "budget", "maintenance"])',
    "offer: z.literal(HAIR_MATCH_OFFER_CODE)",
    "attributes.length === 4",
    "new Set(attributes.map(({ key }) => key)).size === 4",
    "containsHairMatch !== Boolean(parsed.data.hairMatch)",
    "parsed.data.hairMatch?.attributes ?? []",
    '{ key: "offer", value: parsed.data.hairMatch.offer }',
  ]) {
    assert.ok(worker.includes(required), `missing Hair Match Worker guard: ${required}`);
  }
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
  assert.match(hairMatch, /await createHairMatchCheckout\(preferences\)/);
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
