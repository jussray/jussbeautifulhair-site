import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const app = readFileSync("client/src/App.tsx", "utf8");
const layout = readFileSync("client/src/components/Layout.tsx", "utf8");
const sitemap = readFileSync("client/public/sitemap.xml", "utf8");

for (const [route, moduleName, file] of [
  ["/hair-care", "HairCare", "HairCare.tsx"],
  ["/length-guide", "LengthGuide", "LengthGuide.tsx"],
  ["/order-help", "OrderHelp", "OrderHelp.tsx"],
]) {
  test(`customer help route ${route} is linked and indexed`, () => {
    assert.ok(app.includes(`path="${route}" component={${moduleName}}`));
    assert.ok(layout.includes(`href="${route}"`));
    assert.ok(sitemap.includes(`https://jussbeautifulhair.com${route}`));
    assert.ok(readFileSync(`client/src/pages/${file}`, "utf8").includes("export default function"));
  });
}

test("order assistance never exposes a public order lookup endpoint", () => {
  const help = readFileSync("client/src/pages/OrderHelp.tsx", "utf8");
  assert.match(help, /shopify\.com\/84576043251\/account\/orders/);
  assert.doesNotMatch(help, /fetch\s*\(|\/api\/orders/);
});

test("privacy choices link resolves to a bounded informational route", () => {
  const page = readFileSync("client/src/pages/PrivacyChoices.tsx", "utf8");
  assert.ok(app.includes('path="/pages/data-sharing-opt-out" component={PrivacyChoices}'));
  assert.ok(layout.includes('href="/pages/data-sharing-opt-out"'));
  assert.ok(sitemap.includes("/pages/data-sharing-opt-out"));
  assert.match(page, /privacy\.shopify\.com\/en/);
  assert.match(page, /does not itself submit or complete an opt-out request/);
});

test("storefront policies do not contradict Shopify checkout facts", () => {
  const faq = readFileSync("client/src/pages/FAQ.tsx", "utf8");
  const returns = readFileSync("client/src/pages/Returns.tsx", "utf8");
  const shipping = readFileSync("client/src/pages/Shipping.tsx", "utf8");
  const terms = readFileSync("client/src/pages/Terms.tsx", "utf8");
  const privacy = readFileSync("client/src/pages/Privacy.tsx", "utf8");
  assert.doesNotMatch(faq + returns, /within 14 days of delivery/i);
  assert.match(returns, /checkout\.shopify\.com\/84576043251\/policies\/47609413875/);
  assert.doesNotMatch(shipping, /\$9\.99|\$24\.99|Free shipping on orders over \$150/);
  assert.match(shipping, /Shopify checkout/);
  assert.doesNotMatch(terms, /processed by Stripe|Stripe's chargeback process/i);
  assert.match(terms, /Shopify-hosted checkout/);
  assert.match(privacy, /checkout\.shopify\.com\/84576043251\/policies\/46398865651/);
});
