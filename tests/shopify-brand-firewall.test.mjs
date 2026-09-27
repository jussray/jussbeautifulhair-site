import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../client/src/lib/shopifyCatalog.ts", import.meta.url),
  "utf8",
);

const activeSupplierHandles = [
  "afro-kinky-human-hair-bundle-deal",
  "afro-kinky-human-hair-bundles",
  "body-wave-4x4-transparent-lace-closure",
  "body-wave-human-hair-bundle-deal",
  "deep-wave-4x4-transparent-lace-closure",
  "deep-wave-human-hair-bundle-deal",
  "kinky-straight-human-hair-bundles",
  "blonde-body-wave-human-hair-bundles",
  "kinky-curly-human-hair-bundles",
  "body-wave-human-hair-bundles",
  "deep-wave-human-hair-bundles",
  "loose-wave-human-hair-bundles",
  "loose-wave-13x4-transparent-lace-frontal",
  "loose-wave-4x4-transparent-lace-closure",
  "loose-wave-human-hair-bundle-deal",
  "spanish-wave-human-hair-bundles",
  "straight-13x4-transparent-lace-frontal",
  "straight-4x4-transparent-lace-closure",
  "straight-human-hair-bundle-deal",
  "straight-human-hair-bundles",
];

test("Shopify catalog fails closed through the JBH presentation allowlist", () => {
  assert.match(source, /JBH_PRESENTATION_BY_HANDLE/);
  assert.match(source, /applyJbhPresentation/);
  assert.match(source, /if \(!presentation\) return null/);
  assert.match(source, /No approved JBH products are available right now/);
});

test("all current live supplier-backed handles are explicitly approved", () => {
  assert.equal(activeSupplierHandles.length, 20);
  for (const handle of activeSupplierHandles) {
    assert.match(
      source,
      new RegExp(`"${handle}": approvedLiveShopifyProduct\\(`),
      `${handle} must remain an explicit approved live Shopify presentation`,
    );
  }
});

test("approved live catalog uses Shopify media and live options only behind the handle firewall", () => {
  assert.match(source, /useShopifyImage: true/);
  assert.match(source, /allowLiveOptions: true/);
  assert.match(source, /presentation\.allowLiveOptions\s*\?\s*product\.variants/);
  assert.match(source, /presentation\.useShopifyImage \? product\.image : presentation\.image/);
  assert.match(source, /if \(presentation\.useShopifyImage && !image\) return null/);
});

test("separately bounded products retain static media and exact option sets", () => {
  for (const [handle, imageNeedle] of [
    ["lawless-bone-straight-bundle-raw-vietnamese", "bundle-bonestraight"],
    ["royal-raw-indian-temple-bundle", "bundle-royal-indian"],
    ["lawless-4-4-hd-lace-closure", "closure-4x4"],
    ["lawless-5-5-hd-lace-closure", "closure-5x5"],
    ["lawless-13-4-hd-lace-frontal", "frontal-13x4"],
    ["flawless-13-6-body-wave-bob-wig", "wig-13x6-bob"],
    ["flawless-deep-wave-u-part-wig", "wig-upart-deepwave"],
    ["flawless-13-4-lace-frontal-wig-straight", "wig-13x4-straight"],
    ["flawless-glueless-4-4-closure-wig-body-wave", "wig-glueless-bodywave"],
  ]) {
    assert.match(source, new RegExp(handle));
    assert.match(source, new RegExp(imageNeedle));
  }
});

test("beauty essentials still fail closed on mismatched label imagery", () => {
  for (const [handle, name] of [
    ["lawless-edge-control-4-oz", "Lawless Edge Control — 4 oz"],
    ["lawless-lace-melt-spray", "Lawless Lace Melt Spray"],
    ["lawless-hair-oil-rosemary-mint", "Lawless Hair Oil — Rosemary Mint"],
  ]) {
    const block = source.match(
      new RegExp(`"${handle}": \\{[\\s\\S]*?allowedOptions: \\[[^\\]]*\\],\\n    \\},`),
    );
    assert.ok(block, `${handle} must remain an explicit JBH presentation entry`);
    assert.match(block[0], new RegExp(name));
    assert.match(block[0], /image:\s*""/);
    assert.doesNotMatch(block[0], /useShopifyImage:\s*true/);
  }
});

test("Hair Match remains outside the physical-product presentation allowlist", () => {
  assert.doesNotMatch(source, /juss-hair-match-session-25-purchase-credit/);
});

test("public presentation contract does not contain private supplier identities", () => {
  assert.doesNotMatch(
    source,
    /Dropship Beauty|Dropship Bundles|DSers|Faire|AZ Hair|APOHAIR|Indique|Jaipur|5S Hair/i,
  );
});
