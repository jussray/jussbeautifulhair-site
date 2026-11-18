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

test("Stripe is the selected customer checkout but remains default-off until approved", () => {
  assert.match(checkout, /fetch\("\/api\/checkout"/);
  assert.match(checkout, /assertApprovedCheckoutRedirect\(data\.url\)/);
  assert.doesNotMatch(checkout, /fetch\("\/api\/shopify\/cart"/);
  assert.match(entry, /pathname === "\/api\/stripe\/catalog"/);
  assert.match(worker, /approvedStripeOffers\(env\)/);
  assert.match(worker, /\/api\/stripe\/catalog/);
});

test("Stripe checkout requires server credentials and uses idempotent sessions", () => {
  assert.match(worker, /if \(!storeOrigin \|\| !env\.STRIPE_SECRET_KEY\)/);
  assert.match(worker, /idempotencyKey:\s*`jbh-checkout-\$\{reference\}`/);
});
