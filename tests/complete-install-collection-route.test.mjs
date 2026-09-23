import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
const page = readFileSync(
  new URL("../client/src/pages/CompleteInstallDeals.tsx", import.meta.url),
  "utf8",
);
const sitemap = readFileSync(new URL("../client/public/sitemap.xml", import.meta.url), "utf8");

const route = "/collections/complete-install-bundle-deals";
const handles = [
  "body-wave-human-hair-bundle-deal",
  "straight-human-hair-bundle-deal",
  "deep-wave-human-hair-bundle-deal",
  "loose-wave-human-hair-bundle-deal",
];

test("branded storefront owns the Complete Install collection route", () => {
  assert.match(app, /CompleteInstallDeals/);
  assert.ok(app.includes(`path="${route}"`));
  assert.ok(sitemap.includes(`https://jussbeautifulhair.com${route}`));
});

test("Complete Install route derives only the four approved live deal handles", () => {
  assert.match(page, /useShopifyCatalog/);
  assert.match(page, /ProductCard/);
  assert.doesNotMatch(page, /fetch\([^)]*shopify|price:\s*["'`]\d/i);

  for (const handle of handles) {
    assert.ok(page.includes(`"${handle}"`), `${handle} must be included in the collection page`);
  }
});

test("Complete Install route preserves the Hair Match fallback", () => {
  assert.ok(page.includes('href="/hair-match"'));
  assert.match(page, /Start Hair Match/);
});
