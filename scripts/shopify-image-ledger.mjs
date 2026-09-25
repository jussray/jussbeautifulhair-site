import { mkdir, readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { chromium } from "playwright";

// Read-only product image audit ledger. For every JBH-vendor Shopify product it
// compares Shopify media (featured + gallery) with the approved JBH presentation
// image and with what the live storefront actually renders on card and PDP.
// Comparison is visual (64-bit perceptual dHash on decoded pixels), not by name.
// No Shopify writes, no cart, no checkout. Supplier tags are never queried.
const shopDomain = "8qp1z2-az.myshopify.com";
const endpoint = `https://${shopDomain}/api/2026-07/graphql.json`;
const liveBase = process.env.LIVE_STOREFRONT_URL || "https://jussbeautifulhair.com";
const outputDir = "artifacts/shopify-image-ledger";
const MATCH_DISTANCE = 10; // dHash bits; <= this is the same picture after re-encode/resize

const query = `
  query JbhImageLedger($first: Int!, $after: String) {
    products(first: $first, after: $after, query: "vendor:JBH", sortKey: TITLE) {
      nodes {
        id
        handle
        title
        vendor
        productType
        featuredImage { url altText width height }
        images(first: 20) { nodes { url altText width height } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

async function shopifyProducts() {
  const products = [];
  let after = null;
  for (let page = 0; page < 20; page += 1) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { first: 50, after } }),
    });
    const payload = await response.json();
    if (!response.ok || payload.errors) throw new Error(`Storefront API error: ${JSON.stringify(payload).slice(0, 500)}`);
    const connection = payload.data.products;
    products.push(...connection.nodes.filter((node) => node.vendor === "JBH"));
    if (!connection.pageInfo.hasNextPage) return products;
    after = connection.pageInfo.endCursor;
  }
  throw new Error("Storefront catalog exceeded the ledger page limit.");
}

async function presentationMap() {
  const source = await readFile(new URL("../client/src/lib/shopifyCatalog.ts", import.meta.url), "utf8");
  const entries = {};
  const pattern = /"([a-z0-9-]+)": \{\s*name: "([^"]+)",\s*category: "([^"]+)",[\s\S]*?image:\s*"([^"]*)",/g;
  for (const match of source.matchAll(pattern)) {
    entries[match[1]] = { name: match[2], category: match[3], image: match[4] };
  }
  return entries;
}

const absolute = (src) => (src ? new URL(src, liveBase).toString() : "");
const imageKey = (url) => {
  if (!url) return "";
  const parsed = new URL(url);
  return `${parsed.hostname}${parsed.pathname}`;
};

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { type: response.headers.get("content-type") || "image/jpeg", base64: Buffer.from(await response.arrayBuffer()).toString("base64") };
}

async function fingerprint(page, url, cache) {
  if (!url) return null;
  const key = imageKey(url);
  if (cache.has(key)) return cache.get(key);
  let result;
  try {
    const { type, base64 } = await download(url);
    result = await page.evaluate(async ({ type, base64 }) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type }));
      const canvas = new OffscreenCanvas(9, 8);
      const context = canvas.getContext("2d");
      context.drawImage(bitmap, 0, 0, 9, 8);
      const data = context.getImageData(0, 0, 9, 8).data;
      const gray = [];
      for (let i = 0; i < data.length; i += 4) gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      let hash = "";
      for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 8; col += 1) hash += gray[row * 9 + col] > gray[row * 9 + col + 1] ? "1" : "0";
      }
      return { width: bitmap.width, height: bitmap.height, dhash: hash };
    }, { type, base64 });
  } catch (error) {
    result = { error: String(error.message || error) };
  }
  cache.set(key, result);
  return result;
}

const distance = (a, b) => (a?.dhash && b?.dhash ? [...a.dhash].filter((bit, i) => bit !== b.dhash[i]).length : null);

// Fine detail check. A 64-bit dHash cannot see small edits such as ribbon
// lettering, so when two images look alike overall, compare them pixel by
// pixel at 400x600 and report the share of pixels that differ strongly (any
// channel > 48 levels). JPEG re-encoding stays far below DETAIL_MATCH_SHARE.
const DETAIL_MATCH_SHARE = 0.0003; // measured: re-encode q40 ~0, LUXE->LAWLESS relabel 0.0011-0.0012
async function detailDifference(page, urlA, urlB) {
  try {
    const [a, b] = await Promise.all([download(urlA), download(urlB)]);
    return await page.evaluate(async ({ a, b }) => {
      const pixels = async ({ type, base64 }) => {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type }));
        const canvas = new OffscreenCanvas(400, 600);
        const context = canvas.getContext("2d");
        context.drawImage(bitmap, 0, 0, 400, 600);
        return context.getImageData(0, 0, 400, 600).data;
      };
      const [pa, pb] = await Promise.all([pixels(a), pixels(b)]);
      let changed = 0;
      for (let i = 0; i < pa.length; i += 4) {
        if (Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2])) > 48) changed += 1;
      }
      return changed / (pa.length / 4);
    }, { a, b });
  } catch {
    return null;
  }
}

async function liveRender(page, handles) {
  const cards = {};
  await page.goto(`${liveBase}/shop`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.locator('[data-testid^="card-product-"]').first().waitFor({ state: "visible", timeout: 30_000 });
  for (const card of await page.locator('[data-testid^="card-product-"]').all()) {
    const handle = (await card.getAttribute("data-testid")).replace("card-product-", "");
    const img = card.locator("img");
    cards[handle] = (await img.count()) ? await img.getAttribute("src") : "";
  }
  const pdps = {};
  for (const handle of handles) {
    await page.goto(`${liveBase}/product/${handle}`, { waitUntil: "networkidle", timeout: 60_000 });
    const name = page.getByTestId("text-product-name");
    if (!(await name.count())) {
      pdps[handle] = null;
      continue;
    }
    const img = page.getByTestId("img-product");
    pdps[handle] = (await img.count()) ? await img.getAttribute("src") : "";
  }
  return { cards, pdps };
}

function classify(row) {
  const issues = [];
  if (!row.jbh) {
    return { status: "NOT PUBLIC ON JBH", issues: ["not in JBH presentation allowlist"], action: "none on jussbeautifulhair.com; Shopify media only reaches Shopify-hosted surfaces" };
  }
  if (!row.live.card && row.live.card !== "") issues.push("not rendered on live /shop");
  if (row.jbh.image === "") {
    if (row.shopify.featured) issues.push("Shopify featured image is unapproved (JBH withholds it)");
    return {
      status: row.shopify.featured ? "MISMATCH" : "MATCH",
      issues: issues.length ? issues : ["held on JBH placeholder"],
      action: row.shopify.featured ? "HOLD: no approved exact image; Shopify media still shows at Shopify checkout" : "HOLD: supply approved exact image",
    };
  }
  if (!row.shopify.featured) {
    issues.push("Shopify has no featured image");
    return { status: "MISMATCH", issues, action: "upload approved JBH image to Shopify as featured" };
  }
  const d = row.compare.featuredVsJbh;
  if (d === null) return { status: "UNKNOWN", issues: [...issues, "image could not be decoded"], action: "re-run" };
  if (d <= MATCH_DISTANCE && row.compare.featuredDetailVsJbh !== null && row.compare.featuredDetailVsJbh > DETAIL_MATCH_SHARE) {
    issues.push(`stale image: same photo but ${(row.compare.featuredDetailVsJbh * 100).toFixed(2)}% of pixels differ from the approved JBH asset`);
    return { status: "MISMATCH", issues, action: "replace Shopify featured image with the approved JBH asset bytes" };
  }
  if (d > MATCH_DISTANCE) {
    issues.push("wrong featured image");
    const inGallery = row.compare.galleryVsJbh.some((value) => value !== null && value <= MATCH_DISTANCE);
    return { status: "MISMATCH", issues: inGallery ? [...issues, "approved image is in gallery but not featured"] : issues, action: inGallery ? "reorder: make approved image featured" : "upload approved JBH image and make it featured" };
  }
  if (row.shopify.featuredAlt !== row.jbh.name) issues.push(`alt text "${row.shopify.featuredAlt ?? ""}" is not the JBH name`);
  return { status: issues.length ? "MATCH (alt text)" : "MATCH", issues, action: issues.length ? "set alt text to JBH name" : "none" };
}

await mkdir(outputDir, { recursive: true });
const [products, jbh] = await Promise.all([shopifyProducts(), presentationMap()]);
const browser = await chromium.launch({ headless: true });
const cache = new Map();
const ledger = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.route(`${new URL(liveBase).origin}/api/funnel`, (route) =>
    route.continue({ headers: { ...route.request().headers(), "x-jbh-traffic-class": "proof" } }),
  );
  const live = await liveRender(page, products.map((product) => product.handle).filter((handle) => jbh[handle]));
  const hashPage = await browser.newPage();
  for (const product of products) {
    const presentation = jbh[product.handle] || null;
    const jbhUrl = presentation?.image ? absolute(presentation.image) : "";
    const featured = product.featuredImage?.url || "";
    const gallery = product.images.nodes.map((image) => image.url);
    const jbhPrint = await fingerprint(hashPage, jbhUrl, cache);
    const featuredPrint = await fingerprint(hashPage, featured, cache);
    const galleryPrints = [];
    for (const url of gallery) galleryPrints.push(await fingerprint(hashPage, url, cache));
    const row = {
      handle: product.handle,
      title: product.title,
      productId: product.id,
      productType: product.productType,
      jbh: presentation && { name: presentation.name, category: presentation.category, image: presentation.image },
      shopify: {
        featured,
        featuredAlt: product.featuredImage?.altText ?? null,
        featuredSize: featuredPrint?.width ? `${featuredPrint.width}x${featuredPrint.height}` : null,
        galleryCount: gallery.length,
        gallery,
      },
      live: { card: live.cards[product.handle] ?? null, pdp: live.pdps[product.handle] ?? null },
      compare: {
        featuredVsJbh: distance(featuredPrint, jbhPrint),
        featuredDetailVsJbh: jbhUrl && featured ? await detailDifference(hashPage, featured, jbhUrl) : null,
        galleryVsJbh: galleryPrints.map((print) => distance(print, jbhPrint)),
        liveCardIsJbh: presentation ? (live.cards[product.handle] ?? null) === (presentation.image || "") : null,
      },
      decodeErrors: [jbhPrint, featuredPrint, ...galleryPrints].filter((print) => print?.error).map((print) => print.error),
    };
    ledger.push({ ...row, ...classify(row) });
  }
} finally {
  await browser.close();
}

const summary = ledger.reduce((counts, row) => ({ ...counts, [row.status]: (counts[row.status] || 0) + 1 }), {});
await writeFile(`${outputDir}/ledger.json`, `${JSON.stringify({ recordedAt: new Date().toISOString(), shopDomain, liveBase, summary, ledger }, null, 2)}\n`);
console.log(`LEDGER SUMMARY ${JSON.stringify(summary)}`);
for (const row of ledger) {
  console.log(
    `LEDGER ${JSON.stringify({
      handle: row.handle,
      status: row.status,
      issues: row.issues,
      action: row.action,
      jbhImage: row.jbh?.image ?? null,
      liveCard: row.live.card,
      livePdp: row.live.pdp,
      shopifyFeatured: row.shopify.featured,
      featuredAlt: row.shopify.featuredAlt,
      featuredSize: row.shopify.featuredSize,
      gallery: row.shopify.galleryCount,
      dFeatured: row.compare.featuredVsJbh,
      detailShare: row.compare.featuredDetailVsJbh,
      dGallery: row.compare.galleryVsJbh,
    })}`,
  );
}
