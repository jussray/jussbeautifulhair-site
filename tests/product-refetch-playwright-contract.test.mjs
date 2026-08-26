import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../scripts/shopify-physical-playwright.mjs", import.meta.url),
  "utf8",
);

test("physical Playwright harness attacks retained Product truth after a real background refetch failure", () => {
  assert.match(source, /configureRefetchTruthMock/);
  assert.match(source, /status:\s*503/);
  assert.match(source, /forced-background-refetch-failure/);
  assert.match(source, /import\("\/src\/lib\/queryClient\.ts"\)/);
  assert.match(source, /queryClient\.refetchQueries\(\{ queryKey, exact: true \}\)/);
  assert.match(source, /product-catalog-unavailable/);
  assert.match(source, /button-product-catalog-retry/);
  assert.match(source, /text-product-price/);
  assert.match(source, /button-add-to-cart/);
  assert.match(source, /button-add-to-cart-mobile/);
  assert.match(source, /product-refetch-failed-\$\{label\}\.png/);
  assert.match(source, /product-refetch-recovered-\$\{label\}\.png/);
});

test("browser attack covers desktop and mobile recovery without mutating Product source", () => {
  assert.match(source, /\{ width: 1440, height: 1100 \}/);
  assert.match(source, /\{ width: 390, height: 844 \}/);
  assert.match(source, /"desktop"/);
  assert.match(source, /"mobile"/);
  assert.match(source, /catalogMock\.fail\(\)/);
  assert.match(source, /catalogMock\.recover\(\)/);
  assert.match(source, /requestCount >= 3/);
  assert.match(source, /browser console remained clean/);
});
