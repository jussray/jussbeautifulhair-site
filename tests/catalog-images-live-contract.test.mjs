import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const script = readFileSync(new URL("../scripts/catalog-images-live-playwright.mjs", import.meta.url), "utf8");
const workflow = readFileSync(
  new URL("../.github/workflows/shopify-headless-exact-head.yml", import.meta.url),
  "utf8",
);

test("live catalog image proof binds served bytes to the approved LAWLESS assets", () => {
  assert.match(script, /bundle-bodywave\.jpg": "ba102cb7190b8b56aaddd9e3a2c457861513b00ccfe8943e5932abf7221f67ba"/);
  assert.match(script, /bundle-loosewave\.jpg": "59fc1f81a8fd46c45e0f608625fb6de641d315868d5f2b5eb8bc520154cd0424"/);
  assert.match(script, /createHash\("sha256"\)/);
  assert.match(script, /expectedOrigin = "https:\/\/jussbeautifulhair\.com"/);
});

test("live catalog image proof checks loading, shell parity, supplier privacy, and deals", () => {
  assert.match(script, /naturalWidth > 0/);
  assert.match(script, /media is not square/);
  assert.match(script, /card widths differ/);
  assert.match(script, /SUPPLIER_IDENTITY = \/Dropship Beauty\|/);
  for (const handle of ["body-wave", "straight", "deep-wave", "loose-wave"]) {
    assert.match(script, new RegExp(`"${handle}-human-hair-bundle-deal"`));
  }
});

test("live catalog image proof walks card to PDP to cart on desktop and mobile without payment", () => {
  assert.match(script, /img-product/);
  assert.match(script, /row-cart-\$\{JOURNEY_HANDLE\}/);
  assert.match(script, /cart thumbnail/);
  assert.match(script, /\{ width: 1440, height: 1100 \}/);
  assert.match(script, /\{ width: 390, height: 844 \}/);
  assert.match(script, /x-jbh-traffic-class": "proof"/);
  assert.doesNotMatch(script, /button-checkout|button-place-order|api\/shopify\/cart/);
});

test("exact-head gate runs the live image proof after push and on dispatch, and keeps its evidence", () => {
  assert.match(workflow, /run: node scripts\/catalog-images-live-playwright\.mjs/);
  assert.match(workflow, /if: github\.event_name != 'pull_request'\n[\s\S]*?REQUIRE_EXACT_HEAD: \$\{\{ github\.event_name == 'push' \}\}/);
  assert.match(workflow, /artifacts\/catalog-images-live\//);
});
