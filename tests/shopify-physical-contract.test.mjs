import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [worker, catalogClient, cart, checkout, shop, product, home, liveSmoke] = await Promise.all([
  read("worker/index.ts"),
  read("client/src/lib/shopifyCatalog.ts"),
  read("client/src/lib/cart.tsx"),
  read("client/src/pages/Checkout.tsx"),
  read("client/src/pages/Shop.tsx"),
  read("client/src/pages/Product.tsx"),
  read("client/src/pages/Home.tsx"),
  read("scripts/shopify-physical-live-smoke.mjs"),
]);

const saleCatalog = await read("client/src/lib/saleCatalog.ts");

test("Cloudflare owns the public Shopify catalog and cart bridge", () => {
  for (const required of [
    'shopDomain: "8qp1z2-az.myshopify.com"',
    'apiVersion: "2026-07"',
    'vendor: "JBH"',
    'checkoutHosts: ["jussbeautifulhair.com", "www.jussbeautifulhair.com", "8qp1z2-az.myshopify.com"]',
    '"/api/shopify/catalog"',
    '"/api/shopify/cart"',
    "SHOPIFY_CATALOG_QUERY",
    "SHOPIFY_VARIANT_PREFLIGHT_QUERY",
    "SHOPIFY_CART_CREATE_MUTATION",
    "CF-Connecting-IP",
    "Shopify-Storefront-Buyer-IP",
    "node.product.vendor === SHOPIFY_STOREFRONT.vendor",
    "node.availableForSale",
    "node.product.availableForSale",
  ]) {
    assert.ok(worker.includes(required), `missing Shopify Worker contract: ${required}`);
  }

  assert.match(worker, /shopifyStorefrontRequest<ShopifyCatalogData>\(\s*request,/);
  assert.match(worker, /shopifyStorefrontRequest<ShopifyVariantPreflightData>\(\s*request,/);
  assert.match(worker, /shopifyStorefrontRequest<ShopifyCartCreateData>\(\s*request,/);
  assert.doesNotMatch(worker, /X-Shopify-Storefront-Access-Token/);
  assert.doesNotMatch(worker, /SHOPIFY_ADMIN|admin[_-]?token/i);
  assert.match(worker, /merchandiseId:[\s\S]*ProductVariant/);
  assert.match(worker, /SHOPIFY_STOREFRONT\.checkoutHosts\.some/);
  assert.doesNotMatch(worker.slice(worker.indexOf("const shopifyCartSchema"), worker.indexOf("const checkoutSessionIdSchema")), /\bprice\b|\bcurrency\b|\btotal\b/);
});

test("Shopify vendor catalog uses bounded cursor pagination instead of a fixed one-page ceiling", () => {
  assert.match(worker, /catalogPageSize:\s*25/);
  assert.match(worker, /catalogMaxPages:\s*20/);
  assert.match(worker, /query JbhVendorCatalog\(\$first: Int!, \$after: String, \$query: String!\)/);
  assert.match(worker, /products\(first: \$first, after: \$after, query: \$query/);
  assert.match(worker, /for \(let page = 0; page < SHOPIFY_STOREFRONT\.catalogMaxPages; page \+= 1\)/);
  assert.match(worker, /after:\s*after/);
  assert.match(worker, /!nextCursor \|\| nextCursor === after/);
  assert.match(worker, /SHOPIFY_CATALOG_CURSOR_INVALID/);
  assert.match(worker, /after = nextCursor/);
  assert.match(worker, /SHOPIFY_CATALOG_PAGE_LIMIT/);

  assert.match(liveSmoke, /const catalogPageSize = 25/);
  assert.match(liveSmoke, /const catalogMaxPages = 20/);
  assert.match(liveSmoke, /\bafter(?:\s*:\s*after)?\s*,/);
  assert.match(liveSmoke, /products\.push\(\.\.\.catalog\.products\.nodes\)/);
  assert.match(liveSmoke, /pagesFetched/);
});

test("selected physical checkout sends first-party IDs to Stripe, without trusting browser totals", () => {
  assert.match(checkout, /fetch\("\/api\/checkout"/);
  assert.match(checkout, /checkoutAttemptId:\s*attemptRef\.current\.id/);
  assert.match(checkout, /id:\s*item\.id/);
  assert.match(checkout, /variant:\s*item\.variant/);
  assert.match(checkout, /quantity:\s*item\.qty/);
  assert.match(checkout, /assertApprovedCheckoutRedirect\(data\.url\)/);
  assert.doesNotMatch(checkout, /fetch\("\/api\/shopify\/cart"/);
  assert.match(cart, /variantId:\s*string/);
  assert.match(cart, /jbh_stripe_cart_v1/);
  assert.match(cart, /\^jbh:/);
  assert.doesNotMatch(cart, /FREE_SHIP_THRESHOLD|FLAT_SHIPPING/);
});

test("branded Shopify checkout URLs escape the Cloudflare storefront without changing cart identity", () => {
  assert.match(catalogClient, /const checkoutHost = checkout\.hostname\.toLowerCase\(\)/);
  assert.match(catalogClient, /checkoutHost === "jussbeautifulhair\.com"/);
  assert.match(catalogClient, /checkout\.hostname = SHOPIFY_PUBLIC_CONTRACT\.shopDomain/);
});

test("customer-facing products come only from the server-approved Stripe catalog", () => {
  for (const [name, source] of [
    ["shop", shop],
    ["product", product],
    ["home", home],
  ]) {
    assert.match(source, /useSaleCatalog/);
    assert.doesNotMatch(source, /\bPRODUCTS\b/, name + " must not trust a client-only sellable catalog");
  }
  assert.match(saleCatalog, /fetch\("\/api\/stripe\/catalog"/);
  assert.match(saleCatalog, /data\.source !== "jbh-approved-stripe-catalog"/);
  assert.match(saleCatalog, /retry:\s*false/);
  assert.match(worker, /STRIPE_APPROVED_VARIANTS/);
  assert.match(worker, /Catalog is not available for orders/);
  assert.match(worker, /approved\.get\(product\.id\)\?\.has\(variant\.option\)/);
  assert.doesNotMatch(saleCatalog, /SHOPIFY_ADMIN|STRIPE_SECRET_KEY/);
});

test("Stripe checkout and catalog both remain gated while the Shopify bridge is retained for rollback", () => {
  assert.match(worker, /if \(url\.pathname === "\/api\/checkout"\)/);
  assert.match(worker, /if \(url\.pathname === "\/api\/stripe\/catalog"\)/);
  assert.match(worker, /createStripeClient/);
  assert.match(worker, /idempotencyKey:\s*`jbh-checkout-\$\{reference\}`/);
  assert.match(worker, /STRIPE_CATALOG_NOT_APPROVED/);
  assert.match(worker, /STRIPE_CATALOG_INVALID/);
  assert.match(catalogClient, /fetch\("\/api\/shopify\/catalog"/);
});
