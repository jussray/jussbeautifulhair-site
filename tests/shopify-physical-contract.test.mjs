import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [worker, catalogClient, cart, checkout, shop, product, home] = await Promise.all([
  read("worker/index.ts"),
  read("client/src/lib/shopifyCatalog.ts"),
  read("client/src/lib/cart.tsx"),
  read("client/src/pages/Checkout.tsx"),
  read("client/src/pages/Shop.tsx"),
  read("client/src/pages/Product.tsx"),
  read("client/src/pages/Home.tsx"),
]);

test("Cloudflare owns the public Shopify catalog and cart bridge", () => {
  for (const required of [
    'shopDomain: "8qp1z2-az.myshopify.com"',
    'apiVersion: "2026-07"',
    'vendor: "JBH"',
    '"/api/shopify/catalog"',
    '"/api/shopify/cart"',
    "SHOPIFY_CATALOG_QUERY",
    "SHOPIFY_VARIANT_PREFLIGHT_QUERY",
    "SHOPIFY_CART_CREATE_MUTATION",
    "node.product.vendor === SHOPIFY_STOREFRONT.vendor",
    "node.availableForSale",
    "node.product.availableForSale",
  ]) {
    assert.ok(worker.includes(required), `missing Shopify Worker contract: ${required}`);
  }

  assert.doesNotMatch(worker, /X-Shopify-Storefront-Access-Token/);
  assert.doesNotMatch(worker, /SHOPIFY_ADMIN|admin[_-]?token/i);
  assert.match(worker, /merchandiseId:[\s\S]*ProductVariant/);
  assert.doesNotMatch(worker.slice(worker.indexOf("const shopifyCartSchema"), worker.indexOf("const checkoutSessionIdSchema")), /\bprice\b|\bcurrency\b|\btotal\b/);
});

test("physical checkout sends only Shopify variant IDs and quantities", () => {
  assert.match(checkout, /fetch\("\/api\/shopify\/cart"/);
  assert.match(checkout, /merchandiseId:\s*item\.variantId/);
  assert.match(checkout, /quantity:\s*item\.qty/);
  assert.match(checkout, /assertApprovedShopifyCheckoutRedirect/);
  assert.doesNotMatch(checkout, /\/api\/checkout|Pay with Stripe|checkout\.stripe\.com/);

  assert.match(cart, /variantId:\s*string/);
  assert.match(cart, /jbh_cart_v2/);
  assert.match(cart, /ProductVariant\\\/\\d\+/);
  assert.doesNotMatch(cart, /FREE_SHIP_THRESHOLD|FLAT_SHIPPING/);
});

test("customer-facing product surfaces read live Shopify data instead of static PRODUCTS", () => {
  for (const [name, source] of [
    ["shop", shop],
    ["product", product],
    ["home", home],
  ]) {
    assert.match(source, /useShopifyCatalog/);
    assert.doesNotMatch(source, /\bPRODUCTS\b/, `${name} must not render the static sellable catalog`);
  }

  assert.match(catalogClient, /fetch\("\/api\/shopify\/catalog"/);
  assert.match(catalogClient, /staleTime:\s*30_000/);
  assert.match(catalogClient, /No live products are available right now/);
  assert.doesNotMatch(catalogClient, /X-Shopify-Storefront-Access-Token|access_token|STRIPE_SECRET_KEY/);
});

test("legacy Stripe checkout remains isolated as rollback-only server code", () => {
  assert.match(worker, /if \(url\.pathname === "\/api\/checkout"\)/);
  assert.match(worker, /createStripeClient/);
  assert.doesNotMatch(checkout, /createCheckoutAttemptId|assertApprovedCheckoutRedirect/);
});
