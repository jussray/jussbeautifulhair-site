import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const entry = readFileSync(new URL("../worker/entry.ts", import.meta.url), "utf8");
const checkout = readFileSync(new URL("../client/src/pages/Checkout.tsx", import.meta.url), "utf8");
const worker = readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8");
const config = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
const frontdoor = readFileSync(new URL("../wrangler.frontdoor.toml", import.meta.url), "utf8");

test("Stripe routes stay disabled by default at the outer Worker boundary", () => {
  assert.match(entry, /isLegacyStripeCheckout\(pathname\)\s*&&\s*!legacyStripeEnabled\(env\)/);
  assert.match(entry, /env\.ENABLE_LEGACY_STRIPE_CHECKOUT\?\.trim\(\)\.toLowerCase\(\)\s*===\s*"true"/);
  for (const deploymentConfig of [config, frontdoor]) {
    assert.match(deploymentConfig, /ENABLE_LEGACY_STRIPE_CHECKOUT\s*=\s*"false"/);
  }
});

test("Shopify remains the customer checkout and Stripe is not advertised prematurely", () => {
  assert.match(checkout, /fetch\("\/api\/shopify\/cart"/);
  assert.match(checkout, /assertApprovedShopifyCheckoutRedirect\(data\.checkoutUrl\)/);
  assert.doesNotMatch(checkout, /fetch\("\/api\/checkout"/);
});

test("Stripe checkout requires server credentials and uses idempotent sessions", () => {
  assert.match(worker, /if \(!storeOrigin \|\| !env\.STRIPE_SECRET_KEY\)/);
  assert.match(worker, /idempotencyKey:\s*`jbh-checkout-\$\{reference\}`/);
});
