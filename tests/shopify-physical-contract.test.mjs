import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [worker, catalogClient, cart, checkout, shop, product, home, liveSmoke, checkoutWorkflow] = await Promise.all([
  read("worker/index.ts"),
  read("client/src/lib/shopifyCatalog.ts"),
  read("client/src/lib/cart.tsx"),
  read("client/src/pages/Checkout.tsx"),
  read("client/src/pages/Shop.tsx"),
  read("client/src/pages/Product.tsx"),
  read("client/src/pages/Home.tsx"),
  read("scripts/shopify-physical-live-smoke.mjs"),
  read(".github/workflows/shopify-headless-exact-head.yml"),
]);

test("Cloudflare owns the public Shopify catalog and cart bridge", () => {
  for (const required of [
    'shopDomain: "8qp1z2-az.myshopify.com"',
    'apiVersion: "2026-07"',
    'vendor: "JBH"',
    'checkoutHosts: ["jussbeautifulhair.com", "8qp1z2-az.myshopify.com"]',
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
  assert.match(worker, /SHOPIFY_STOREFRONT\.checkoutHosts\.some/);
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

test("branded Shopify checkout URLs escape the Cloudflare storefront without changing cart identity", () => {
  assert.match(catalogClient, /const checkoutHost = checkout\.hostname\.toLowerCase\(\)/);
  assert.match(catalogClient, /checkoutHost === "jussbeautifulhair\.com"/);
  assert.match(catalogClient, /checkout\.hostname = SHOPIFY_PUBLIC_CONTRACT\.shopDomain/);
});

test("customer-facing product surfaces read live Shopify commerce through the JBH presentation firewall", () => {
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
  assert.match(catalogClient, /JBH_PRESENTATION_BY_HANDLE/);
  assert.match(catalogClient, /applyJbhPresentation/);
  assert.match(catalogClient, /allowedOptions/);
  assert.match(catalogClient, /if \(!presentation\) return null/);
  assert.match(catalogClient, /No approved JBH products are available right now/);
  assert.match(catalogClient, /checkoutHosts:\s*\["jussbeautifulhair\.com",\s*"8qp1z2-az\.myshopify\.com"\]/);
  assert.doesNotMatch(
    catalogClient,
    /Dropship Beauty|Dropship Bundles|DSers|Faire|AZ Hair|APOHAIR|Indique|Jaipur|5S Hair/i,
  );
  assert.doesNotMatch(catalogClient, /X-Shopify-Storefront-Access-Token|access_token|STRIPE_SECRET_KEY/);
});

test("live Shopify verification supports Web Bot Auth without committing credentials", () => {
  for (const envName of [
    "SHOPIFY_WEB_BOT_SIGNATURE_AGENT",
    "SHOPIFY_WEB_BOT_SIGNATURE_INPUT",
    "SHOPIFY_WEB_BOT_SIGNATURE",
  ]) {
    assert.match(liveSmoke, new RegExp(envName));
    assert.match(checkoutWorkflow, new RegExp(`secrets\\.${envName}`));
  }

  assert.match(liveSmoke, /"Signature-Agent"/);
  assert.match(liveSmoke, /"Signature-Input"/);
  assert.match(liveSmoke, /Signature:\s*webBotAuth\.signature/);
  assert.match(liveSmoke, /configuredWebBotAuthValues === 0 \|\| configuredWebBotAuthValues === 3/);
  assert.match(liveSmoke, /webBotAuthMode/);
  assert.doesNotMatch(liveSmoke, /sig1=/);
  assert.doesNotMatch(checkoutWorkflow, /sig1=/);
});

test("legacy Stripe checkout remains isolated as rollback-only server code", () => {
  assert.match(worker, /if \(url\.pathname === "\/api\/checkout"\)/);
  assert.match(worker, /createStripeClient/);
  assert.doesNotMatch(checkout, /createCheckoutAttemptId|assertApprovedCheckoutRedirect/);
});
