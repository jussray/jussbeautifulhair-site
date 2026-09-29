import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [indexHtml, faq, catalog] = await Promise.all([
  readFile(new URL("../client/index.html", import.meta.url), "utf8"),
  readFile(new URL("../client/src/pages/FAQ.tsx", import.meta.url), "utf8"),
  readFile(new URL("../client/src/lib/shopifyCatalog.ts", import.meta.url), "utf8"),
]);

// Hair claims Juss Beautiful Hair cannot currently prove for the live catalog.
// Any of these may come back only with supplier documentation for the exact product.
// Draft (non-live) catalog entries are out of scope until they go live.
const UNPROVEN_CLAIMS = /\b(raw|virgin|temple|hd\s*lace|single[-\s]donor|cuticle[-\s]aligned)\b|100\s*%/i;

function metaContent(attribute, key) {
  const match = indexHtml.match(new RegExp(`<meta ${attribute}="${key}" content="([^"]*)"`));
  assert.ok(match, `missing <meta ${attribute}="${key}">`);
  return match[1];
}

test("search and share snippets make no unproven hair claims and no unlisted products", () => {
  for (const [attribute, key] of [
    ["name", "description"],
    ["property", "og:description"],
  ]) {
    const content = metaContent(attribute, key);
    assert.doesNotMatch(content, UNPROVEN_CLAIMS, `${key} makes an unproven claim: ${content}`);
    assert.doesNotMatch(content, /\bwigs?\b/i, `${key} advertises wigs, which are not in the live catalog`);
  }
  const description = metaContent("name", "description");
  assert.ok(description.length <= 160, `meta description is ${description.length} chars; search results cut near 160`);
});

test("FAQ answers make no unproven hair claims", () => {
  const answers = [...faq.matchAll(/\ba:\s*"([^"]*)"/g)].map((match) => match[1]);
  const answerKeys = (faq.match(/\ba:\s*/g) ?? []).length;
  assert.ok(answers.length > 0, "no FAQ answers found");
  assert.equal(answers.length, answerKeys, "every FAQ answer must be a plain string this contract can read");
  for (const answer of answers) {
    assert.doesNotMatch(answer, UNPROVEN_CLAIMS, `FAQ answer makes an unproven claim: ${answer}`);
  }
});

test("live product presentation copy makes no unproven hair claims", () => {
  const start = catalog.indexOf("export const JBH_PRESENTATION_BY_HANDLE");
  const end = catalog.indexOf("function isStoreVariant", start);
  assert.ok(start >= 0 && end > start, "JBH presentation map bounds are missing.");
  const liveEntries = catalog
    .slice(start, end)
    .split(/\n(?= {4}"[^"]+": )/)
    .filter((entry) => /^ {4}"[^"]+": approvedLiveShopifyProduct\(/.test(entry));
  assert.equal(liveEntries.length, 20, "Expected exactly 20 live product entries.");
  for (const entry of liveEntries) {
    const handle = entry.match(/^ {4}"([^"]+)"/)[1];
    const copy = [...entry.matchAll(/"([^"]*)"/g)].map((match) => match[1]).filter((text) => text !== handle);
    for (const text of copy) {
      assert.doesNotMatch(text, UNPROVEN_CLAIMS, `${handle}: "${text}"`);
    }
  }
});
