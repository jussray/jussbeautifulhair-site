import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../client/src/lib/shopifyCatalog.ts", import.meta.url),
  "utf8",
);

test("Shopify catalog fails closed through the JBH presentation allowlist", () => {
  assert.match(source, /JBH_PRESENTATION_BY_HANDLE/);
  assert.match(source, /applyJbhPresentation/);
  assert.match(source, /if \(!presentation\) return null/);
  assert.match(source, /No approved JBH products are available right now/);
});

test("approved live physical Shopify handles render JBH product names and assets", () => {
  const expected = [
    ["body-wave-human-hair-bundles", "Lawless Body Wave Bundles", "bundle-bodywave.jpg"],
    ["deep-wave-human-hair-bundles", "Lawless Deep Wave Bundles", "bundle-deepwave.jpg"],
    ["loose-wave-human-hair-bundles", "Lawless Loose Wave Bundles", "bundle-loosewave.jpg"],
    ["kinky-straight-human-hair-bundles", "Flawless Kinky Straight Bundles", "bundle-kinkystraight.jpg"],
    ["lawless-bone-straight-bundle-raw-vietnamese", "Lawless Bone Straight Bundle — Raw Vietnamese", "bundle-bonestraight"],
    ["royal-raw-indian-temple-bundle", "Royal Raw Indian Temple Bundle", "bundle-royal-indian"],
    ["lawless-4-4-hd-lace-closure", "Lawless 4×4 HD Lace Closure", "closure-4x4"],
    ["lawless-5-5-hd-lace-closure", "Lawless 5×5 HD Lace Closure", "closure-5x5"],
    ["lawless-13-4-hd-lace-frontal", "Lawless 13×4 HD Lace Frontal", "frontal-13x4"],
    ["flawless-13-6-body-wave-bob-wig", "Flawless 13×6 Body Wave Bob Wig", "wig-13x6-bob"],
    ["flawless-deep-wave-u-part-wig", "Flawless Deep Wave U-Part Wig", "wig-upart-deepwave"],
    ["flawless-13-4-lace-frontal-wig-straight", "Flawless 13×4 Lace Frontal Wig — Straight", "wig-13x4-straight"],
    ["flawless-glueless-4-4-closure-wig-body-wave", "Flawless Glueless 4×4 Closure Wig — Body Wave", "wig-glueless-bodywave"],
    ["lawless-edge-control-4-oz", "Lawless Edge Control — 4 oz", "edge-control"],
    ["lawless-lace-melt-spray", "Lawless Lace Melt Spray", "lace-melt-spray"],
    ["lawless-hair-oil-rosemary-mint", "Lawless Hair Oil — Rosemary Mint", "hair-oil"],
  ];

  for (const [handle, name, image] of expected) {
    assert.match(source, new RegExp(handle));
    assert.match(source, new RegExp(name));
    assert.match(source, new RegExp(image.replace(".", "\\.")));
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
