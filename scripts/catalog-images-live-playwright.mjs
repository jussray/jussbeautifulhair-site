import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { chromium } from "playwright";

// Live proof of the JBH catalog image authority on the production storefront:
// approved relabelled assets are the bytes actually served, every card renders
// exactly its allowlisted JBH image (or the placeholder) inside the shared JBH
// card shell, supplier identity never appears in page text, the three-bundle
// deals are live, and one bundle keeps its exact image and live variant price
// from card to PDP to cart. No checkout or payment is submitted. Branding baked
// into image pixels is not text-detectable; it is covered by the byte hashes
// below for the relabelled assets and by founder review for the rest.
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
// Journey preference: products carrying the hashed LAWLESS assets first. The
// first one that is sellable live is walked, so a sell-out never reads as a
// code regression on the main gate.
const JOURNEY_PREFERENCE = ["body-wave-human-hair-bundles", "loose-wave-human-hair-bundles"];
const SUPPLIER_IDENTITY = /Dropship Beauty|Dropship Bundles|DSers|Faire|AZ Hair|APOHAIR|Indique|Jaipur|5S Hair|LUXE CROWNS/i;
const IMAGE_HOSTS = new Set(["jussbeautifulhair.com", "cdn.shopify.com"]);
const IMAGE_TIMEOUT_MS = 15_000;

// handle -> approved image from the JBH presentation allowlist ("" = placeholder).
const APPROVED_IMAGE_BY_HANDLE = Object.fromEntries(
  [
    ...(await readFile(new URL("../client/src/lib/shopifyCatalog.ts", import.meta.url), "utf8")).matchAll(
      /"([a-z0-9-]+)": \{\s*name: "[^"]+",\s*category: "[^"]+",[\s\S]*?image:\s*"([^"]*)",/g,
    ),
  ].map(([, handle, image]) => [handle, image]),
);
assert.ok(Object.keys(APPROVED_IMAGE_BY_HANDLE).length > 0, "could not read the JBH presentation allowlist.");
// Byte pins apply while the allowlist still uses the asset; retiring an image
// in shopifyCatalog.ts retires its pin instead of turning the gate red.
const PINNED_ASSETS = Object.fromEntries(
  Object.entries(APPROVED_ASSETS).filter(([path]) => Object.values(APPROVED_IMAGE_BY_HANDLE).includes(path)),
);
// Three-bundle deals are whatever the allowlist currently publishes.
const BUNDLE_DEAL_HANDLES = Object.keys(APPROVED_IMAGE_BY_HANDLE).filter((handle) => handle.endsWith("-bundle-deal"));
const imageIdentity = (src) => {
  const url = new URL(src, expectedOrigin);
  return `${url.hostname}${url.pathname}`;
};

// Resolves on load, rejects on error or after a bounded wait so a broken image
// fails the gate promptly instead of stalling until the job timeout.
async function loadedImage(locator, label) {
  const state = await locator.evaluate(
    (img, timeout) =>
      img.complete
        ? { ok: img.naturalWidth > 0 }
        : new Promise((resolve) => {
            const timer = setTimeout(() => resolve({ ok: false, reason: "timeout" }), timeout);
            img.addEventListener("load", () => { clearTimeout(timer); resolve({ ok: img.naturalWidth > 0 }); }, { once: true });
            img.addEventListener("error", () => { clearTimeout(timer); resolve({ ok: false, reason: "error" }); }, { once: true });
          }),
    IMAGE_TIMEOUT_MS,
  );
  const details = await locator.evaluate((img) => ({ src: img.currentSrc || img.src, naturalWidth: img.naturalWidth, alt: img.alt }));
  assert.ok(state.ok, `${label} failed to load (${state.reason || "zero width"}): ${details.src}`);
  return details;
}

assert.equal(new URL(baseURL).origin, expectedOrigin, `LIVE_STOREFRONT_URL must be exactly ${expectedOrigin}.`);
await mkdir(outputDir, { recursive: true });

const version = await (await fetch(`${baseURL}/version`, { headers: { accept: "application/json" } })).json();
if (requireExactHead) {
  assert.equal(version?.sha, expectedHead, `live SHA ${version?.sha} is not the exact head ${expectedHead}.`);
}

const servedAssets = {};
for (const [path, expected] of Object.entries(PINNED_ASSETS)) {
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
  assert.doesNotMatch(bodyText, SUPPLIER_IDENTITY, `${label}: supplier identity appeared in /shop page text.`);

  const handles = await page
    .locator('[data-testid^="card-product-"]')
    .evaluateAll((cards) => cards.map((card) => card.dataset.testid.replace("card-product-", "")));
  const cards = [];
  for (const handle of handles) {
    const card = page.getByTestId(`card-product-${handle}`);
    await card.scrollIntoViewIfNeeded();
    const approved = APPROVED_IMAGE_BY_HANDLE[handle];
    assert.notEqual(approved, undefined, `${label}: ${handle} rendered but is not in the JBH allowlist.`);
    const image = card.locator("img");
    let src = null;
    let naturalWidth = null;
    if (approved) {
      assert.equal(await image.count(), 1, `${label}: ${handle} should render its approved image ${approved}.`);
      ({ src, naturalWidth } = await loadedImage(image, `${label}: ${handle} card image`));
      assert.ok(IMAGE_HOSTS.has(new URL(src).hostname), `${label}: ${handle} image served from ${new URL(src).hostname}.`);
      assert.equal(imageIdentity(src), imageIdentity(approved), `${label}: ${handle} renders ${src}, not its approved ${approved}.`);
    } else {
      assert.equal(await image.count(), 0, `${label}: ${handle} is held on the placeholder but rendered an image.`);
      assert.equal(await card.getByText("Product image updating").count(), 1, `${label}: ${handle} is missing the JBH placeholder.`);
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
  for (const [handle, approved] of Object.entries(APPROVED_IMAGE_BY_HANDLE)) {
    if (!Object.hasOwn(PINNED_ASSETS, approved)) continue;
    const card = cards.find((candidate) => candidate.handle === handle);
    assert.ok(card, `${label}: ${handle} (approved ${approved}) is not live on /shop.`);
    assert.equal(card.src, approved, `${label}: ${handle} renders ${card.src}, not ${approved}.`);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${outputDir}/shop-${label}.png`, fullPage: true });
  return cards;
}

const formatPrice = (amount) => `$${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`; // mirrors shared/catalog.ts

async function bundleJourney(page, label) {
  const catalogResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/shopify/catalog" && response.request().method() === "GET",
    { timeout: 60_000 },
  );
  await page.goto(`${baseURL}/shop`, { waitUntil: "networkidle", timeout: 60_000 });
  const liveProducts = (await (await catalogResponse).json())?.products ?? [];
  const sellable = (handle) =>
    liveProducts.find((product) => product?.id === handle && product.availableForSale && product.variants?.some((variant) => variant.availableForSale));
  const candidates = [
    ...JOURNEY_PREFERENCE,
    ...Object.keys(APPROVED_IMAGE_BY_HANDLE).filter((handle) => !JOURNEY_PREFERENCE.includes(handle)),
  ].filter((handle) => APPROVED_IMAGE_BY_HANDLE[handle] && sellable(handle));
  assert.ok(candidates.length > 0, `${label}: no allowlisted product with an approved image is sellable live.`);

  let journeyHandle;
  let liveProduct;
  let variants;
  for (const handle of candidates) {
    await page.goto(`${baseURL}/shop`, { waitUntil: "networkidle", timeout: 60_000 });
    const card = page.getByTestId(`card-product-${handle}`);
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await page.getByTestId("text-product-name").waitFor({ state: "visible", timeout: 30_000 });
    variants = page.locator('[data-testid^="variant-"]:not([disabled])');
    if ((await variants.count()) > 0) {
      journeyHandle = handle;
      liveProduct = sellable(handle);
      break;
    }
  }
  assert.ok(journeyHandle, `${label}: no allowlisted product exposes a sellable option on its PDP.`);
  const journeyImage = imageIdentity(APPROVED_IMAGE_BY_HANDLE[journeyHandle]);

  const pdpDetails = await loadedImage(page.getByTestId("img-product"), `${label}: PDP image`);
  const pdp = { ...pdpDetails, src: imageIdentity(pdpDetails.src) };
  assert.equal(pdp.src, journeyImage, `${label}: ${journeyHandle} PDP image ${pdp.src} is not ${journeyImage}.`);
  const productName = await page.getByTestId("text-product-name").innerText();
  assert.equal(pdp.alt, productName, `${label}: PDP alt text is not the JBH product name.`);

  const chosen = variants.nth((await variants.count()) > 1 ? 1 : 0);
  const chosenOption = (await chosen.innerText()).trim();
  const liveVariant = liveProduct.variants.find((variant) => variant.option === chosenOption && variant.availableForSale);
  assert.ok(liveVariant, `${label}: selected option ${chosenOption} is not a sellable live Shopify variant.`);
  const expectedPrice = formatPrice(liveVariant.price);
  await chosen.click();
  const priceLocator = page.getByTestId("text-product-price");
  await page.waitForFunction(
    ({ expected }) => document.querySelector('[data-testid="text-product-price"]')?.textContent?.trim() === expected,
    { expected: expectedPrice },
    { timeout: 10_000 },
  ).catch(() => {});
  const price = (await priceLocator.innerText()).trim();
  assert.equal(price, expectedPrice, `${label}: PDP shows ${price}, live Shopify price for ${chosenOption} is ${expectedPrice}.`);
  await page.screenshot({ path: `${outputDir}/pdp-${journeyHandle}-${label}.png` });

  await page.getByTestId(label === "mobile" ? "button-add-to-cart-mobile" : "button-add-to-cart").click();
  await page.goto(`${baseURL}/cart`, { waitUntil: "networkidle", timeout: 60_000 });
  const row = page.getByTestId(`row-cart-${journeyHandle}`);
  await row.waitFor({ state: "visible", timeout: 30_000 });
  const rowText = await row.innerText();
  assert.ok(rowText.includes(productName), `${label}: cart row does not name ${productName}.`);
  assert.ok(rowText.includes(chosenOption), `${label}: cart row lost the selected option ${chosenOption}.`);
  const cartDetails = await loadedImage(row.locator("img"), `${label}: cart thumbnail`);
  const cartImage = { ...cartDetails, src: imageIdentity(cartDetails.src) };
  assert.equal(cartImage.src, journeyImage, `${label}: cart thumbnail ${cartImage.src} is not ${journeyImage}.`);
  assert.ok(rowText.includes(expectedPrice), `${label}: cart row lost the live price ${expectedPrice}.`);
  await page.screenshot({ path: `${outputDir}/cart-${label}.png`, fullPage: true });
  return { journeyHandle, productName, chosenOption, price, variantId: liveVariant.id, pdp, cartImage };
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
