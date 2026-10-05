import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../client/src/App.tsx", import.meta.url), "utf8");
const handoffPage = await readFile(
  new URL("../client/src/pages/ShopifyCartHandoff.tsx", import.meta.url),
  "utf8",
);

test("branded Shopify cart URLs are mounted before the generic cart and 404 routes", () => {
  const handoffRoute = '<Route path="/cart/c/:cartId" component={ShopifyCartHandoff} />';
  const cartRoute = '<Route path="/cart" component={Cart} />';
  const fallbackRoute = '<Route component={NotFound} />';

  const handoffIndex = app.indexOf(handoffRoute);
  const cartIndex = app.indexOf(cartRoute);
  const fallbackIndex = app.indexOf(fallbackRoute);

  assert.notEqual(handoffIndex, -1, "Shopify cart handoff route is missing from the public router");
  assert.ok(handoffIndex < cartIndex, "Shopify cart handoff must resolve before the generic cart route");
  assert.ok(handoffIndex < fallbackIndex, "Shopify cart handoff must resolve before the 404 fallback");
});

test("handoff preserves Shopify cart identity while pinning the destination host", () => {
  assert.match(handoffPage, /SHOPIFY_PUBLIC_CONTRACT\.shopDomain/);
  assert.match(handoffPage, /pathname\.startsWith\("\/cart\/c\/"\)/);
  assert.match(handoffPage, /target\.pathname = safePath/);
  assert.match(handoffPage, /target\.search = search/);
  assert.match(handoffPage, /window\.location\.replace\(checkoutUrl\)/);
  assert.doesNotMatch(handoffPage, /jussbeautifulhair\.com\/cart\/c\//);
});

test("cart handoff is non-indexable and provides a manual recovery link", () => {
  assert.match(app, /pathname\.startsWith\("\/cart\/c\/"\)/);
  assert.match(app, /noindex, nofollow/);
  assert.match(handoffPage, /data-testid="link-shopify-cart-handoff"/);
  assert.match(handoffPage, /Continue to secure checkout/);
});
