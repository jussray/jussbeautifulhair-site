import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import process from "node:process";
import { chromium } from "playwright";

// Live proof of the JBH catalog image authority on the production storefront:
// approved relabelled assets are the bytes actually served, every card image
// loads inside the shared JBH card shell, supplier identity never renders, the
// three-bundle deals are live, and one bundle keeps its exact image from card
// to PDP to cart. No checkout or payment is submitted.
const baseURL = process.env.LIVE_STOREFRONT_URL || "https://jussbeautifulhair.com";
const expectedOrigin = "https://jussbeautifulhair.com";
const requireExactHead = process.env.REQUIRE_EXACT_HEAD === "true";
const expectedHead = process.env.EXPECTED_HEAD_SHA || "";
const outputDir = "artifacts/catalog-images-live";

// sha256 of the founder-approved LAWLESS ribbon assets (scripts/assets/relabel-bundle-ribbons.py).
const APPROVED_ASSETS = {
  "/products/bundle-bodywave.jpg": "ba102cb7190b8b56aaddd9e3a2c457861513b00ccfe8943e5932abf7221f67ba",
  "/products/bundle-loosewave.jpg": "59fc1f81a8fd46c45e0f608625fb6de641d315868d5f2b5eb8bc520154cd0424",
};
const BUNDLE_DEAL_HANDLES = [
  "body-wave-human-hair-bundle-deal",
  "straight-human-hair-bundle-deal",
  "deep-wave-human-hair-bundle-deal",
  "loose-wave-human-hair-bundle-deal",
];
const JOURNEY_HANDLE = "body-wave-human-hair-bundles";
const JOURNEY_IMAGE = "/products/bundle-bodywave.jpg";
const SUPPLIER_IDENTITY = /Dropship Beauty|Dropship Bundles|DSers|Faire|AZ Hair|APOHAIR|Indique|Jaipur|5S Hair|LUXE CROWNS/i;
const IMAGE_HOSTS = new Set(["jussbeautifulhair.com", "cdn.shopify.com"]);

assert.equal(new URL(baseURL).origin, expectedOrigin, `LIVE_STOREFRONT_URL must be exactly ${expectedOrigin}.`);
await mkdir(outputDir, { recursive: true });

const version = await (await fetch(`${baseURL}/version`, { headers: { accept: "application/json" } })).json();
if (requireExactHead) {
  assert.equal(version?.sha, expectedHead, `live SHA ${version?.sha} is not the exact head ${expectedHead}.`);
}

const servedAssets = {};
for (const [path, expected] of Object.entries(APPROVED_ASSETS)) {
  const response = await fetch(`${baseURL}${path}`, { cache: "no-store" });
  assert.equal(response.ok, true, `${path} returned HTTP ${response.status}.`);
  const digest = createHash("sha256").update(Buffer.from(await response.arrayBuffer())).digest("hex");
  servedAssets[path] = digest;
  assert.equal(digest, expected, `${path} served ${digest}, not the approved asset ${expected}.`);
}

async function proofPage(browser, viewport) {
  const page = await browser.newPage({ viewport });
  await page.route(`${expectedOrigin}/api/funnel`, async (route) => {
    await route.continue({ headers: { ...route.request().headers(), "x-jbh-traffic-class": "proof" } });
  });
  return page;
}

async function cardInventory(page, label) {
  await page.goto(`${baseURL}/shop`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.locator('[data-testid^="card-product-"]').first().waitFor({ state: "visible", timeout: 30_000 });
  const bodyText = await page.locator("body").innerText();
  assert.doesNotMatch(bodyText, SUPPLIER_IDENTITY, `${label}: supplier identity rendered on /shop.`);

  const handles = await page
    .locator('[data-testid^="card-product-"]')
    .evaluateAll((cards) => cards.map((card) => card.dataset.testid.replace("card-product-", "")));
  const cards = [];
  for (const handle of handles) {
    const card = page.getByTestId(`card-product-${handle}`);
    await card.scrollIntoViewIfNeeded();
    const image = card.locator("img");
    let src = null;
    let naturalWidth = null;
    if ((await image.count()) > 0) {
      await image.evaluate((img) =>
        img.complete ? null : new Promise((resolve) => img.addEventListener("load", resolve, { once: true })),
      );
      ({ src, naturalWidth } = await image.evaluate((img) => ({ src: img.currentSrc || img.src, naturalWidth: img.naturalWidth })));
      assert.ok(naturalWidth > 0, `${label}: ${handle} card image failed to load (${src}).`);
      assert.ok(IMAGE_HOSTS.has(new URL(src).hostname), `${label}: ${handle} image served from ${new URL(src).hostname}.`);
    } else {
      assert.equal(await card.getByText("Product image updating").count(), 1, `${label}: ${handle} has neither image nor placeholder.`);
    }
    const geometry = await card.evaluate((element) => {
      const media = element.firstElementChild.getBoundingClientRect();
      return { cardWidth: Math.round(element.getBoundingClientRect().width), mediaWidth: Math.round(media.width), mediaHeight: Math.round(media.height) };
    });
    assert.equal(geometry.mediaWidth, geometry.mediaHeight, `${label}: ${handle} media is not square.`);
    cards.push({ handle, name: await card.locator("h3").innerText(), src: src && new URL(src).pathname, naturalWidth, ...geometry });
  }

  const widths = new Set(cards.map((card) => card.cardWidth));
  assert.equal(widths.size, 1, `${label}: card widths differ across the grid: ${[...widths].join(", ")}.`);
  for (const handle of BUNDLE_DEAL_HANDLES) {
    const deal = cards.find((card) => card.handle === handle);
    assert.ok(deal, `${label}: bundle deal ${handle} is not live (Shopify option titles or status do not match the allowlist).`);
    assert.match(deal.name, /Bundle Deal$/, `${label}: ${handle} is not named as a bundle deal.`);
  }
  for (const path of Object.keys(APPROVED_ASSETS)) {
    assert.ok(cards.some((card) => card.src === path), `${label}: no live card renders ${path}.`);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${outputDir}/shop-${label}.png`, fullPage: true });
  return cards;
}

async function bundleJourney(page, label) {
  await page.goto(`${baseURL}/shop`, { waitUntil: "networkidle", timeout: 60_000 });
  const card = page.getByTestId(`card-product-${JOURNEY_HANDLE}`);
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await page.getByTestId("text-product-name").waitFor({ state: "visible", timeout: 30_000 });
  const pdpImage = page.getByTestId("img-product");
  await pdpImage.evaluate((img) =>
    img.complete ? null : new Promise((resolve) => img.addEventListener("load", resolve, { once: true })),
  );
  const pdp = await pdpImage.evaluate((img) => ({ src: new URL(img.currentSrc || img.src).pathname, naturalWidth: img.naturalWidth, alt: img.alt }));
  assert.equal(pdp.src, JOURNEY_IMAGE, `${label}: PDP image ${pdp.src} is not ${JOURNEY_IMAGE}.`);
  assert.ok(pdp.naturalWidth > 0, `${label}: PDP image failed to load.`);
  const productName = await page.getByTestId("text-product-name").innerText();
  assert.equal(pdp.alt, productName, `${label}: PDP alt text is not the JBH product name.`);

  const variants = page.locator('[data-testid^="variant-"]:not([disabled])');
  assert.ok((await variants.count()) > 0, `${label}: no sellable ${JOURNEY_HANDLE} variant is live.`);
  const chosen = variants.nth((await variants.count()) > 1 ? 1 : 0);
  const chosenOption = (await chosen.innerText()).trim();
  await chosen.click();
  const price = (await page.getByTestId("text-product-price").innerText()).trim();
  assert.match(price, /\$\d/, `${label}: PDP shows no live price.`);
  await page.screenshot({ path: `${outputDir}/pdp-${JOURNEY_HANDLE}-${label}.png` });

  await page.getByTestId(label === "mobile" ? "button-add-to-cart-mobile" : "button-add-to-cart").click();
  await page.goto(`${baseURL}/cart`, { waitUntil: "networkidle", timeout: 60_000 });
  const row = page.getByTestId(`row-cart-${JOURNEY_HANDLE}`);
  await row.waitFor({ state: "visible", timeout: 30_000 });
  const rowText = await row.innerText();
  assert.ok(rowText.includes(productName), `${label}: cart row does not name ${productName}.`);
  assert.ok(rowText.includes(chosenOption), `${label}: cart row lost the selected option ${chosenOption}.`);
  const cartImage = await row.locator("img").evaluate((img) => ({ src: new URL(img.currentSrc || img.src).pathname, naturalWidth: img.naturalWidth }));
  assert.equal(cartImage.src, JOURNEY_IMAGE, `${label}: cart thumbnail ${cartImage.src} is not ${JOURNEY_IMAGE}.`);
  assert.ok(cartImage.naturalWidth > 0, `${label}: cart thumbnail failed to load.`);
  await page.screenshot({ path: `${outputDir}/cart-${label}.png`, fullPage: true });
  return { productName, chosenOption, price, pdp, cartImage };
}

const browser = await chromium.launch({ headless: true });
const results = {};
try {
  for (const [label, viewport] of [
    ["desktop", { width: 1440, height: 1100 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const page = await proofPage(browser, viewport);
    results[label] = { cards: await cardInventory(page, label), journey: await bundleJourney(page, label) };
    await page.close();
  }
} finally {
  await browser.close();
}

await writeFile(
  `${outputDir}/evidence.json`,
  `${JSON.stringify({ recordedAt: new Date().toISOString(), liveSha: version?.sha, servedAssets, results }, null, 2)}\n`,
);
console.log(`Live catalog image authority proof passed on ${version?.sha}; no payment submitted.`);
