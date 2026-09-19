import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [indexHtml, robots, sitemap] = await Promise.all([
  readFile(new URL("../client/index.html", import.meta.url), "utf8"),
  readFile(new URL("../client/public/robots.txt", import.meta.url), "utf8"),
  readFile(new URL("../client/public/sitemap.xml", import.meta.url), "utf8"),
]);

test("public shell binds canonical discovery metadata to the branded origin", () => {
  assert.match(indexHtml, /<link rel="canonical" href="https:\/\/jussbeautifulhair\.com\/" \/>/);
  assert.match(indexHtml, /<meta property="og:url" content="https:\/\/jussbeautifulhair\.com\/" \/>/);
  assert.match(indexHtml, /<meta property="og:image" content="https:\/\/jussbeautifulhair\.com\/jbh_cover\.jpg" \/>/);
});

test("robots allows the public storefront, keeps API routes out, and advertises the sitemap", () => {
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, /^Disallow: \/api\/$/m);
  assert.match(robots, /^Sitemap: https:\/\/jussbeautifulhair\.com\/sitemap\.xml$/m);
});

test("sitemap advertises only the crawlable canonical root while hash routing remains authoritative", () => {
  assert.match(sitemap, /<loc>https:\/\/jussbeautifulhair\.com\/<\/loc>/);
  assert.doesNotMatch(sitemap, /#/);
  assert.doesNotMatch(sitemap, /\/cart|\/checkout|\/success|\/api\//);
});
