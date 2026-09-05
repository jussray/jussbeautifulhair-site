import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import process from "node:process";
import { chromium } from "playwright";

const baseURL = process.env.LIVE_STOREFRONT_URL || "https://jussbeautifulhair.com";
const expectedHead = process.env.EXPECTED_HEAD_SHA || "";
const expectedOrigin = "https://jussbeautifulhair.com";
const approvedCheckoutHosts = new Set([
  "jussbeautifulhair.com",
  "8qp1z2-az.myshopify.com",
]);
const outputDir = "artifacts/shopify-production";

const parsedBase = new URL(baseURL);
assert.equal(parsedBase.origin, expectedOrigin, `LIVE_STOREFRONT_URL must be exactly ${expectedOrigin}.`);
assert.match(expectedHead, /^[0-9a-f]{40}$/i, "EXPECTED_HEAD_SHA must be an exact 40-character commit SHA.");

await mkdir(outputDir, { recursive: true });

const versionResponse = await fetch(`${baseURL}/version`, {
  headers: { accept: "application/json" },
});
assert.equal(versionResponse.ok, true, `version route returned HTTP ${versionResponse.status}.`);
const versionPayload = await versionResponse.json();
assert.equal(versionPayload?.ok, true, "version route did not report ok=true.");
assert.equal(
  versionPayload?.sha,
  expectedHead,
  `version SHA mismatch: expected ${expectedHead}, received ${versionPayload?.sha ?? "missing"}.`,
);

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

  await page.route("https://8qp1z2-az.myshopify.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Shopify handoff captured</title><h1>Shopify handoff captured</h1>",
    });
  });
  await page.route("https://jussbeautifulhair.com/cart/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Shopify handoff captured</title><h1>Shopify handoff captured</h1>",
    });
  });

  const catalogResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).origin === expectedOrigin &&
      new URL(response.url()).pathname === "/api/shopify/catalog" &&
      response.request().method() === "GET",
    { timeout: 60_000 },
  );

  const shopResponse = await page.goto(`${baseURL}/#/shop`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  assert.ok(shopResponse?.ok(), `live shop returned HTTP ${shopResponse?.status() ?? "unknown"}.`);

  const catalogResponse = await catalogResponsePromise;
  assert.equal(catalogResponse.status(), 200, `/api/shopify/catalog returned HTTP ${catalogResponse.status()}.`);
  const catalogPayload = await catalogResponse.json();
  assert.equal(catalogPayload?.source, "shopify-storefront", "production catalog did not identify Shopify Storefront as source.");
  assert.ok(Array.isArray(catalogPayload?.products), "production catalog response is missing products.");

  const product = catalogPayload.products.find(
    (candidate) =>
      candidate?.availableForSale &&
      Array.isArray(candidate?.variants) &&
      candidate.variants.some((variant) => variant?.availableForSale),
  );
  assert.ok(product, "production catalog contains no sellable Shopify product.");
  const variantIndex = product.variants.findIndex((variant) => variant?.availableForSale);
  const variant = product.variants[variantIndex];
  assert.ok(variant, "production catalog contains no sellable Shopify variant.");
  assert.match(variant.id, /^gid:\/\/shopify\/ProductVariant\/\d+$/);

  const productCard = page.getByTestId(`card-product-${product.id}`);
  await productCard.waitFor({ state: "visible", timeout: 30_000 });
  await page.screenshot({ path: `${outputDir}/shop.png`, fullPage: true });
  await productCard.click();

  await page.getByTestId("text-product-name").waitFor({ state: "visible", timeout: 30_000 });
  if (product.variants.length > 1) {
    await page.getByTestId(`variant-${variantIndex}`).click();
  }
  await page.getByTestId("button-add-to-cart").click();
  await page.getByTestId("link-cart").click();
  await page.getByTestId("button-checkout").click();
  await page.getByTestId("button-place-order").waitFor({ state: "visible", timeout: 30_000 });
  await page.screenshot({ path: `${outputDir}/checkout.png`, fullPage: true });

  let capturedCartStatus = null;
  let capturedCartRequestPayload = null;
  let capturedCartPayload = null;
  let resolveCartCapture;
  let rejectCartCapture;
  const cartCapturePromise = new Promise((resolve, reject) => {
    resolveCartCapture = resolve;
    rejectCartCapture = reject;
  });

  await page.route(`${expectedOrigin}/api/shopify/cart`, async (route) => {
    try {
      capturedCartRequestPayload = route.request().postDataJSON();
      const upstreamResponse = await route.fetch();
      capturedCartStatus = upstreamResponse.status();
      const upstreamBody = await upstreamResponse.text();
      capturedCartPayload = JSON.parse(upstreamBody);
      await route.fulfill({ response: upstreamResponse, body: upstreamBody });
      resolveCartCapture();
    } catch (error) {
      rejectCartCapture(error);
      await route.abort().catch(() => {});
    }
  });

  await page.getByTestId("button-place-order").click();
  await cartCapturePromise;

  assert.equal(capturedCartStatus, 200, `/api/shopify/cart returned HTTP ${capturedCartStatus}.`);
  assert.deepEqual(
    capturedCartRequestPayload,
    { lines: [{ merchandiseId: variant.id, quantity: 1 }] },
    `production cart request widened beyond merchandiseId and quantity: ${JSON.stringify(capturedCartRequestPayload)}`,
  );

  assert.equal(typeof capturedCartPayload?.checkoutUrl, "string", "production Shopify cart response is missing checkoutUrl.");
  assert.equal(capturedCartPayload?.totalQuantity, 1, "production Shopify cart returned an unexpected quantity.");

  const checkout = new URL(capturedCartPayload.checkoutUrl);
  assert.equal(checkout.protocol, "https:", "production Shopify checkout URL must use HTTPS.");
  assert.equal(
    approvedCheckoutHosts.has(checkout.hostname.toLowerCase()),
    true,
    `production Shopify checkout returned unexpected host ${checkout.hostname}.`,
  );
  assert.equal(checkout.username, "", "production Shopify checkout URL must not contain credentials.");
  assert.equal(checkout.password, "", "production Shopify checkout URL must not contain credentials.");
  assert.equal(checkout.port, "", "production Shopify checkout URL must not use a custom port.");

  await page.getByRole("heading", { name: "Shopify handoff captured" }).waitFor({
    state: "visible",
    timeout: 30_000,
  });
  const observedCheckout = new URL(page.url());
  assert.equal(
    approvedCheckoutHosts.has(observedCheckout.hostname.toLowerCase()),
    true,
    `rendered checkout handoff reached unexpected host ${observedCheckout.hostname}.`,
  );

  await writeFile(
    `${outputDir}/manifest.json`,
    `${JSON.stringify(
      {
        expectedHead,
        observedHead: versionPayload.sha,
        verifiedAt: new Date().toISOString(),
        origin: expectedOrigin,
        productHandle: product.id,
        variantId: variant.id,
        catalogStatus: catalogResponse.status(),
        cartStatus: capturedCartStatus,
        checkoutHost: checkout.hostname,
        renderedHandoffHost: observedCheckout.hostname,
        assertions: [
          "production /version matched the exact activated main SHA before commerce proof",
          "rendered production Shop consumed the live /api/shopify/catalog boundary",
          "a live sellable Shopify variant flowed through Product, Cart, and Checkout",
          "production /api/shopify/cart received only merchandiseId and quantity",
          "production cart creation returned an HTTPS checkout on an exact approved host",
          "the rendered checkout button navigated to that approved Shopify handoff",
          "no order or payment was submitted",
        ],
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Exact-deploy Shopify production Playwright proof passed for ${expectedHead}; no payment submitted.`);
} finally {
  await browser.close();
}