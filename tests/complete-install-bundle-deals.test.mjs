import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../client/src/lib/shopifyCatalog.ts", import.meta.url),
  "utf8",
);

const expectedDeals = [
  {
    handle: "body-wave-human-hair-bundle-deal",
    title: "Body Wave Human Hair Bundle Deal",
    image: "hdhinu3imttx4gqjx4hv.jpg?v=1786555760",
  },
  {
    handle: "straight-human-hair-bundle-deal",
    title: "Straight Human Hair Bundle Deal",
    image: "cv6iro07ou5o4wstvj91.jpg?v=1786555798",
  },
  {
    handle: "deep-wave-human-hair-bundle-deal",
    title: "Deep Wave Human Hair Bundle Deal",
    image: "gdmztdhzyjylaoy3kx4d.jpg?v=1786555804",
  },
  {
    handle: "loose-wave-human-hair-bundle-deal",
    title: "Loose Wave Human Hair Bundle Deal",
    image: "m7sc7hbayb05s1tjgn5u.jpg?v=1786555791",
  },
];

const graduatedOptions = [
  '10"/12"/14"',
  '12"/14"/16"',
  '14"/16"/18"',
  '16"/18"/20"',
  '18"/20"/22"',
  '20"/22"/24"',
  '22"/24"/26"',
  '24"/26"/28"',
  '26"/28"/30"',
  '28"/30"/32"',
];

test("complete-install bundle deals are approved in the headless presentation allowlist", () => {
  for (const { handle, title, image } of expectedDeals) {
    const start = source.indexOf(`"${handle}": {`);
    assert.notEqual(start, -1, `${handle} must be present in the JBH presentation allowlist`);

    const nextEntry = source.indexOf("\n    \"", start + handle.length + 5);
    const block = source.slice(start, nextEntry === -1 ? source.length : nextEntry);

    assert.match(block, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(block, new RegExp(image.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(block, /image:\s*""/);

    for (const option of graduatedOptions) {
      assert.ok(block.includes(option), `${handle} must allow ${option}`);
    }
  }
});

test("complete-install deal images remain on the approved JBH Shopify CDN", () => {
  for (const { handle } of expectedDeals) {
    const start = source.indexOf(`"${handle}": {`);
    const nextEntry = source.indexOf("\n    \"", start + handle.length + 5);
    const block = source.slice(start, nextEntry === -1 ? source.length : nextEntry);
    assert.match(block, /https:\/\/cdn\.shopify\.com\/s\/files\/1\/0845\/7604\/3251\/files\//);
  }
});
