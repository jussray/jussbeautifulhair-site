import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const config = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
const workerEntry = await readFile(new URL("../worker/entry.ts", import.meta.url), "utf8");
const funnelClient = await readFile(new URL("../client/src/lib/funnel.ts", import.meta.url), "utf8");
const productPage = await readFile(new URL("../client/src/pages/Product.tsx", import.meta.url), "utf8");
const checkoutPage = await readFile(new URL("../client/src/pages/Checkout.tsx", import.meta.url), "utf8");

test("Founder Funnel uses a first-party Analytics Engine binding", () => {
  assert.match(config, /\[\[analytics_engine_datasets\]\]/);
  assert.match(config, /binding\s*=\s*"FUNNEL_ANALYTICS"/);
  assert.match(config, /dataset\s*=\s*"jbh_funnel_v1"/);
  assert.match(workerEntry, /FUNNEL_PATH\s*=\s*"\/api\/funnel"/);
  assert.match(workerEntry, /FUNNEL_ANALYTICS\?\.writeDataPoint/);
});

test("Founder Funnel rejects undeclared fields instead of storing arbitrary customer data", () => {
  assert.match(workerEntry, /Object\.keys\(value\)\.some\(\(key\) => !FUNNEL_KEYS\.has\(key\)\)/);
  assert.match(workerEntry, /"product_view"/);
  assert.match(workerEntry, /"add_to_cart"/);
  assert.match(workerEntry, /"checkout_start"/);
  assert.match(workerEntry, /"shopify_handoff"/);
  assert.match(workerEntry, /"checkout_error"/);
  assert.doesNotMatch(workerEntry, /"email"\s*,|"phone"\s*,|"address"\s*,|"customerId"\s*,/);
});

test("Founder Funnel accepts only same-origin POST JSON and separates proof traffic", () => {
  assert.match(workerEntry, /request\.method !== "POST"/);
  assert.match(workerEntry, /request\.headers\.get\("Origin"\) !== requestUrl\.origin/);
  assert.match(workerEntry, /startsWith\("application\/json"\)/);
  assert.match(workerEntry, /X-JBH-Traffic-Class/);
  assert.match(workerEntry, /\? "proof"\s*:\s*"human"/);
});

test("analytics client is best-effort and cannot throw into commerce", () => {
  assert.match(funnelClient, /fetch\("\/api\/funnel"/);
  assert.match(funnelClient, /keepalive:\s*true/);
  assert.match(funnelClient, /\.catch\(\(\) => undefined\)/);
  assert.match(funnelClient, /catch\s*\{/);
});

test("product events bind to rendered live product and successful cart mutation", () => {
  const productView = productPage.indexOf('event: "product_view"');
  const addItem = productPage.indexOf("addItem(");
  const addToCart = productPage.indexOf('event: "add_to_cart"');

  assert.ok(productView >= 0, "product_view hook is missing");
  assert.ok(addItem >= 0, "cart mutation is missing");
  assert.ok(addToCart > addItem, "add_to_cart must follow the cart mutation");
});

test("Shopify handoff is observed only after checkout URL approval", () => {
  const approval = checkoutPage.indexOf(
    "const approvedCheckoutUrl = assertApprovedShopifyCheckoutRedirect(data.checkoutUrl);",
  );
  const handoff = checkoutPage.indexOf('event: "shopify_handoff"');
  const redirect = checkoutPage.indexOf("window.location.assign(approvedCheckoutUrl)");

  assert.ok(checkoutPage.includes('event: "checkout_start"'));
  assert.ok(checkoutPage.includes('event: "checkout_error"'));
  assert.ok(approval >= 0, "approved Shopify URL boundary is missing");
  assert.ok(handoff > approval, "handoff event must follow URL approval");
  assert.ok(redirect > handoff, "browser redirect must follow handoff observation");
});
