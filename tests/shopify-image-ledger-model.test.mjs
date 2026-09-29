import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { altMatchesJbhName, classify, jbhRowFields, parsePresentationMap } from "../scripts/shopify-image-ledger.mjs";

const source = await readFile(new URL("../client/src/lib/shopifyCatalog.ts", import.meta.url), "utf8");
const allowlist = source.slice(source.indexOf("JBH_PRESENTATION_BY_HANDLE"));
const allowlistHandles = [...allowlist.matchAll(/^    "([a-z0-9-]+)": /gm)].map((match) => match[1]);

const row = (jbh, { featured = "", alt = null, card = null } = {}) => ({
  jbh,
  shopify: { featured, featuredAlt: alt },
  live: { card, pdp: card },
  compare: { featuredVsJbh: null, featuredDetailVsJbh: null, galleryVsJbh: [] },
});

test("ledger reads every allowlisted handle, including approved live Shopify products", () => {
  const parsed = parsePresentationMap(source);
  assert.ok(allowlistHandles.length > 0);
  assert.deepEqual(Object.keys(parsed).sort(), [...allowlistHandles].sort());
  assert.equal(parsed["body-wave-human-hair-bundles"].shopifyMedia, true);
  assert.equal(parsed["body-wave-human-hair-bundles"].name, "Lawless Body Wave Bundles");
  assert.equal(parsed["lawless-edge-control-4-oz"].shopifyMedia, false);
});

test("approved live Shopify products are classified against Shopify media, not a JBH asset", () => {
  const jbh = { name: "Lawless Body Wave Bundles", category: "Bundles", image: "", shopifyMedia: true };
  const featured = "https://cdn.shopify.com/s/files/1/x/files/bw.jpg?v=1";

  assert.equal(classify(row(jbh)).status, "HIDDEN (no Shopify image)");
  assert.equal(
    classify(row(jbh, { featured, alt: jbh.name, card: "https://cdn.shopify.com/s/files/1/x/files/bw.jpg?v=2" })).status,
    "MATCH",
  );
  assert.equal(classify(row(jbh, { featured, alt: "Raw title", card: featured })).status, "MATCH (alt text)");
  assert.equal(
    classify(row(jbh, { featured, alt: jbh.name, card: "https://cdn.shopify.com/s/files/1/x/files/other.jpg" })).status,
    "MISMATCH",
  );
  assert.equal(classify(row(jbh, { featured, alt: jbh.name, card: null })).status, "CHECK");
});

test("unlisted handles stay NOT PUBLIC and static withheld images stay HOLD", () => {
  assert.equal(classify(row(null)).status, "NOT PUBLIC ON JBH");
  const withheld = { name: "Lawless Edge Control — 4 oz", category: "Beauty Essentials", image: "", shopifyMedia: false };
  assert.match(classify(row(withheld, { featured: "https://cdn.shopify.com/e.jpg" })).action, /^HOLD/);
});

test("ledger rows built from the real allowlist keep Shopify-media classification", () => {
  const parsed = parsePresentationMap(source);
  const featured = "https://cdn.shopify.com/s/files/1/x/files/bw.jpg";
  const liveRow = row(jbhRowFields(parsed["body-wave-human-hair-bundles"]), {
    featured,
    alt: "Lawless Body Wave Bundles",
    card: featured,
  });
  assert.equal(liveRow.jbh.shopifyMedia, true);
  assert.equal(classify(liveRow).status, "MATCH");
  assert.equal(jbhRowFields(undefined), null);
});

test("the ledger run builds its rows through jbhRowFields", async () => {
  const ledger = await readFile(new URL("../scripts/shopify-image-ledger.mjs", import.meta.url), "utf8");
  assert.match(ledger, /jbh: jbhRowFields\(presentation\),/);
});

test("approved alt text is the JBH name, optionally brand-prefixed", () => {
  const name = "Straight 4×4 Transparent Lace Closure";
  assert.equal(altMatchesJbhName(name, name), true);
  assert.equal(altMatchesJbhName(`Juss Beautiful Hair — ${name}`, name), true);
  assert.equal(
    altMatchesJbhName("Juss Beautiful Hair — Juss Blonde, Blonde Body Wave Human Hair Bundles", "Juss Blonde"),
    true,
  );
  assert.equal(altMatchesJbhName(`Juss Beautiful Hair ${name}`, name), false);
  assert.equal(altMatchesJbhName("Juss Beautiful Hair — Straight 4x4 Transparent Lace Closure", name), false);
  assert.equal(altMatchesJbhName(`Juss Beautiful Hair — ${name} Extra`, name), false);
  assert.equal(altMatchesJbhName(null, name), false);

  const jbh = { name: "Juss Blonde", category: "Bundles", image: "", shopifyMedia: true };
  const featured = "https://cdn.shopify.com/s/files/1/x/files/blonde.jpg";
  const brandRow = row(jbh, {
    featured,
    alt: "Juss Beautiful Hair — Juss Blonde, Blonde Body Wave Human Hair Bundles",
    card: featured,
  });
  assert.equal(classify(brandRow).status, "MATCH");
});
