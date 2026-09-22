import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [indexHtml, robots, sitemap, app, main, wrangler, shopifyCatalog] = await Promise.all([
  readFile(new URL("../client/index.html", import.meta.url), "utf8"),
  readFile(new URL("../client/public/robots.txt", import.meta.url), "utf8"),
  readFile(new URL("../client/public/sitemap.xml", import.meta.url), "utf8"),
  readFile(new URL("../client/src/App.tsx", import.meta.url), "utf8"),
  readFile(new URL("../client/src/main.tsx", import.meta.url), "utf8"),
  readFile(new URL("../wrangler.toml", import.meta.url), "utf8"),
  readFile(new URL("../client/src/lib/shopifyCatalog.ts", import.meta.url), "utf8"),
]);

const canonicalOrigin = "https://jussbeautifulhair.com";
const publicRoutes = [
  "/",
  "/shop",
  "/hair-match",
  "/about",
  "/faq",
  "/contact",
  "/shipping",
  "/returns",
  "/privacy",
  "/terms",
];

const presentationStart = shopifyCatalog.indexOf("export const JBH_PRESENTATION_BY_HANDLE");
const presentationEnd = shopifyCatalog.indexOf("function isStoreVariant", presentationStart);
assert.ok(presentationStart >= 0 && presentationEnd > presentationStart, "JBH presentation map bounds are missing.");
const presentationSection = shopifyCatalog.slice(presentationStart, presentationEnd);
const productHandles = [...presentationSection.matchAll(/^    "([^"]+)": \{$/gm)].map((match) => match[1]);
assert.ok(productHandles.length > 0, "No approved JBH product handles were found.");

test("static shell keeps a branded root fallback while app rewrites discovery metadata per route", () => {
  assert.match(indexHtml, /<link rel="canonical" href="https:\/\/jussbeautifulhair\.com\/" \/>/);
  assert.match(indexHtml, /<meta property="og:url" content="https:\/\/jussbeautifulhair\.com\/" \/>/);
  assert.match(indexHtml, /<meta property="og:image" content="https:\/\/jussbeautifulhair\.com\/jbh_cover\.jpg" \/>/);
  assert.match(app, /const CANONICAL_ORIGIN = "https:\/\/jussbeautifulhair\.com";/);
  assert.match(app, /link\[rel="canonical"\]/);
  assert.match(app, /meta\[property="og:url"\]/);
  assert.match(app, /canonical\.href = canonicalHref/);
  assert.match(app, /ogUrl\.content = canonicalHref/);
});

test("browser history is authoritative while legacy entry routes migrate forward", () => {
  assert.doesNotMatch(app, /useHashLocation/);
  assert.match(app, /useLocation/);
  assert.match(app, /NON_INDEXABLE_ROUTES = new Set\(\["\/cart", "\/checkout", "\/success"\]\)/);
  assert.match(main, /window\.location\.hash\.startsWith\("#\/"\)/);
  assert.match(main, /window\.history\.replaceState\(null, "", legacyHashRoute\)/);
  assert.match(main, /legacyShopifyProductRoute/);
  assert.match(main, /\^\\\/products\\\/\(\[\^\/\]\+\)\\\/?\$/);
  assert.match(main, /`\/product\/\$\{handle\}\$\{window\.location\.search\}\$\{window\.location\.hash\}`/);
  assert.match(wrangler, /not_found_handling\s*=\s*"single-page-application"/);
});

test("robots allows public discovery and keeps transactional or API routes out", () => {
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, /^Disallow: \/api\/$/m);
  assert.match(robots, /^Disallow: \/cart$/m);
  assert.match(robots, /^Disallow: \/checkout$/m);
  assert.match(robots, /^Disallow: \/success$/m);
  assert.match(robots, /^Sitemap: https:\/\/jussbeautifulhair\.com\/sitemap\.xml$/m);
});

test("sitemap advertises real public paths and every approved JBH product handle", () => {
  assert.doesNotMatch(sitemap, /#/);
  assert.doesNotMatch(sitemap, /\/cart|\/checkout|\/success|\/api\//);

  for (const route of publicRoutes) {
    const url = route === "/" ? `${canonicalOrigin}/` : `${canonicalOrigin}${route}`;
    assert.ok(sitemap.includes(`<loc>${url}</loc>`), `sitemap is missing ${url}`);
  }

  for (const handle of productHandles) {
    const url = `${canonicalOrigin}/product/${handle}`;
    assert.ok(sitemap.includes(`<loc>${url}</loc>`), `sitemap is missing approved product ${handle}`);
  }

  const productUrls = [...sitemap.matchAll(/<loc>https:\/\/jussbeautifulhair\.com\/product\/([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(new Set(productUrls), new Set(productHandles));
});
