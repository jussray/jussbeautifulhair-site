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
  // Deals come from the live allowlist so retiring one never turns the gate red,
  // and publishing one makes the gate require it to be live.
  assert.match(script, /BUNDLE_DEAL_HANDLES = Object\.keys\(APPROVED_IMAGE_BY_HANDLE\)\.filter\(\(handle\) => handle\.endsWith\("-bundle-deal"\)\)/);
  assert.match(script, /bundle deal \$\{handle\} is not live/);
});

test("live catalog image proof walks card to PDP to cart on desktop and mobile without payment", () => {
  assert.match(script, /img-product/);
  assert.match(script, /row-cart-\$\{journeyHandle\}/);
  assert.match(script, /JOURNEY_PREFERENCE = \["body-wave-human-hair-bundles", "loose-wave-human-hair-bundles"\]/);
  assert.match(script, /no allowlisted product with an approved image is sellable live/);
  assert.match(script, /PINNED_ASSETS/);
  assert.match(script, /cart thumbnail/);
  assert.match(script, /\{ width: 1440, height: 1100 \}/);
  assert.match(script, /\{ width: 390, height: 844 \}/);
  assert.match(script, /x-jbh-traffic-class": "proof"/);
  assert.doesNotMatch(script, /button-checkout|button-place-order|api\/shopify\/cart/);
});

test("live catalog image proof binds every card to its allowlisted image and fails fast on broken images", () => {
  assert.match(script, /APPROVED_IMAGE_BY_HANDLE/);
  assert.match(script, /renders \$\{src\}, not its approved \$\{approved\}/);
  assert.match(script, /held on the placeholder but rendered an image/);
  assert.match(script, /addEventListener\("error"/);
  assert.match(script, /IMAGE_TIMEOUT_MS/);
});

test("live catalog image proof requires the displayed price to equal the selected live Shopify variant", () => {
  assert.match(script, /\/api\/shopify\/catalog/);
  assert.match(script, /variant\.option === chosenOption/);
  assert.match(script, /assert\.equal\(price, expectedPrice/);
  assert.match(script, /cart row lost the live price/);
});

test("read-only image ledger compares Shopify media to JBH images visually, including fine detail", () => {
  const ledger = readFileSync(new URL("../scripts/shopify-image-ledger.mjs", import.meta.url), "utf8");
  assert.match(ledger, /dhash/);
  assert.match(ledger, /detailDifference/);
  assert.match(ledger, /DETAIL_MATCH_SHARE = 0\.0003/);
  assert.match(ledger, /stale image: same photo but/);
  const graphql = ledger.match(/const query = `([\s\S]*?)`;/)?.[1] ?? "";
  assert.match(graphql, /query JbhImageLedger/);
  assert.doesNotMatch(graphql, /\btags\b|\bmutation\b/i, "ledger must stay read-only and never read supplier tags");
  assert.match(workflow, /if: github\.event_name == 'workflow_dispatch'\n[\s\S]*?run: node scripts\/shopify-image-ledger\.mjs/);
});

test("exact-head gate runs the live image proof after push and on dispatch, and keeps its evidence", () => {
  assert.match(workflow, /run: node scripts\/catalog-images-live-playwright\.mjs/);
  assert.match(workflow, /if: github\.event_name != 'pull_request'\n[\s\S]*?REQUIRE_EXACT_HEAD: \$\{\{ github\.event_name == 'push' \}\}/);
  assert.match(workflow, /artifacts\/catalog-images-live\//);
});
