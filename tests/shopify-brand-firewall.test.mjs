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

test("approved live supplier-backed handles render JBH product names and assets", () => {
  const expected = [
    ["body-wave-human-hair-bundles", "Lawless Body Wave Bundles", "bundle-bodywave.jpg"],
    ["deep-wave-human-hair-bundles", "Lawless Deep Wave Bundles", "bundle-deepwave.jpg"],
    ["loose-wave-human-hair-bundles", "Lawless Loose Wave Bundles", "bundle-loosewave.jpg"],
    ["kinky-straight-human-hair-bundles", "Flawless Kinky Straight Bundles", "bundle-kinkystraight.jpg"],
  ];

  for (const [handle, name, image] of expected) {
    assert.match(source, new RegExp(handle));
    assert.match(source, new RegExp(name));
    assert.match(source, new RegExp(image.replace(".", "\\.")));
  }
});

test("public presentation contract does not contain private supplier identities", () => {
  assert.doesNotMatch(
    source,
    /Dropship Beauty|Dropship Bundles|DSers|Faire|AZ Hair|APOHAIR|Indique|Jaipur|5S Hair/i,
  );
});
