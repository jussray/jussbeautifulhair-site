import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { chromium } from "playwright";

// Browser proof that the three beauty-essential handles render the customer-safe
// placeholder (never the withheld label imagery or raw Shopify featuredImage) on
// Shop cards, PDP, and Cart, while an approved product image still loads.
const host = "127.0.0.1";
const port = Number(process.env.PLAYWRIGHT_ESSENTIALS_PORT || 4176);
const baseURL = `http://${host}:${port}`;
const outputDir = "artifacts/beauty-essentials-images";
const vitePath = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const withheldAssetPattern = /edge-control|lace-melt-spray|hair-oil/;
let serverOutput = "";

const essential = (handle, id, option, price) => ({
  id: handle,
  shopifyProductId: `gid://shopify/Product/${id}`,
  name: `Raw Shopify title ${handle}`,
  category: "Beauty Essentials",
  tagline: "",
  description: "Raw Shopify description.",
  variants: [
    { id: `gid://shopify/ProductVariant/${id}1`, option, price, availableForSale: true },
  ],
  // Raw Shopify featuredImage must never reach the customer.
  image: `https://cdn.shopify.com/s/files/1/0845/7604/3251/files/${handle}-raw.jpg`,
  availableForSale: true,
});

const essentials = [
  { handle: "lawless-edge-control-4-oz", name: "Lawless Edge Control — 4 oz" },
  { handle: "lawless-lace-melt-spray", name: "Lawless Lace Melt Spray" },
  { handle: "lawless-hair-oil-rosemary-mint", name: "Lawless Hair Oil — Rosemary Mint" },
];

const mockProducts = [
  essential("lawless-edge-control-4-oz", "9719789060401", "4 oz", 10),
  essential("lawless-lace-melt-spray", "9719789060402", "2 oz", 15),
  essential("lawless-hair-oil-rosemary-mint", "9719789060403", "2 oz", 18),
  {
    id: "body-wave-human-hair-bundles",
    shopifyProductId: "gid://shopify/Product/9719789060339",
    name: "Body Wave Human Hair Bundles",
    category: "Bundles",
    tagline: "",
    description: "Raw Shopify description.",
    variants: [
      { id: "gid://shopify/ProductVariant/50273899900002", option: '16"', price: 58.99, availableForSale: true },
    ],
    image: "",
    availableForSale: true,
  },
];

const server = spawn(process.execPath, [vitePath, "--host", host, "--port", String(port)], {
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
});
for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
}

async function waitForServer(timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (server.exitCode !== null) throw new Error(`Vite exited before verification.\n${serverOutput}`);
    try {
      if ((await fetch(baseURL)).ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${baseURL}.\n${serverOutput}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertNoHorizontalOverflow(page, label) {
  const { clientWidth, scrollWidth } = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert(scrollWidth <= clientWidth + 1, `${label} overflows horizontally: ${scrollWidth} > ${clientWidth}`);
}

async function runViewport(browser, label, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const evidence = {
    label,
    imageResponses: [],
    withheldRequests: [],
    abortedExternalRequests: [],
    consoleErrors: [],
  };

  page.on("console", (message) => {
    // Aborted off-host requests (fonts, analytics) surface as net::ERR_FAILED.
    if (message.type() === "error" && !/net::ERR_FAILED/.test(message.text())) {
      evidence.consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => evidence.consoleErrors.push(error.message));
  page.on("request", (request) => {
    if (withheldAssetPattern.test(request.url()) && request.resourceType() === "image") {
      evidence.withheldRequests.push(request.url());
    }
  });
  page.on("response", (response) => {
    if (response.request().resourceType() === "image") {
      evidence.imageResponses.push({ url: new URL(response.url()).pathname, status: response.status() });
    }
  });

  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    evidence.abortedExternalRequests.push(new URL(route.request().url()).host);
    return route.abort();
  });
  await page.route("**/api/funnel", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/shopify/catalog", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ products: mockProducts, source: "shopify-storefront" }),
    }),
  );

  // Collection entry: essentials show the placeholder; the approved bundle image loads.
  await page.goto(`${baseURL}/shop`, { waitUntil: "networkidle" });
  for (const { handle } of essentials) {
    const card = page.getByTestId(`card-product-${handle}`);
    await card.waitFor();
    assert((await card.locator("img").count()) === 0, `${label}: ${handle} card rendered an <img>`);
    assert(
      (await card.getByText("Product image updating").count()) === 1,
      `${label}: ${handle} card missing customer-safe placeholder`,
    );
  }
  const approvedImage = page.getByTestId("card-product-body-wave-human-hair-bundles").locator("img");
  await approvedImage.scrollIntoViewIfNeeded();
  await approvedImage.evaluate((img) => (img.complete ? null : new Promise((r) => (img.onload = r))));
  const naturalWidth = await approvedImage.evaluate((img) => img.naturalWidth);
  assert(naturalWidth > 0, `${label}: approved bundle image failed to load`);
  await assertNoHorizontalOverflow(page, `${label} /shop`);
  await page.getByTestId("card-product-lawless-edge-control-4-oz").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${outputDir}/shop-${label}.png`, fullPage: false });

  // PDP → add to cart → cart thumbnail for every essential.
  for (const { handle, name } of essentials) {
    await page.goto(`${baseURL}/product/${handle}`, { waitUntil: "networkidle" });
    const heading = await page.getByTestId("text-product-name").innerText();
    assert(heading === name, `${label}: PDP name ${heading} !== ${name}`);
    assert((await page.getByTestId("img-product").count()) === 0, `${label}: ${handle} PDP rendered an image`);
    assert(
      (await page.getByText("Product image updating").count()) >= 1,
      `${label}: ${handle} PDP missing placeholder`,
    );
    await assertNoHorizontalOverflow(page, `${label} PDP ${handle}`);
    await page.screenshot({ path: `${outputDir}/pdp-${handle}-${label}.png` });
    const addButton = page.getByTestId(label === "mobile" ? "button-add-to-cart-mobile" : "button-add-to-cart");
    await addButton.click();
  }

  await page.goto(`${baseURL}/cart`, { waitUntil: "networkidle" });
  for (const { handle, name } of essentials) {
    const row = page.getByTestId(`row-cart-${handle}`);
    await row.waitFor();
    assert((await row.locator("img").count()) === 0, `${label}: ${handle} cart row rendered an <img>`);
    assert((await row.getByText(name).count()) === 1, `${label}: cart row missing ${name}`);
  }
  await assertNoHorizontalOverflow(page, `${label} /cart`);
  await page.screenshot({ path: `${outputDir}/cart-${label}.png`, fullPage: true });

  assert(evidence.withheldRequests.length === 0, `${label}: withheld asset requested ${evidence.withheldRequests}`);
  assert(
    !evidence.imageResponses.some(({ url }) => url.includes("-raw.jpg")),
    `${label}: raw Shopify featuredImage was requested`,
  );
  const failedLocalImages = evidence.imageResponses.filter(({ status }) => status >= 400);
  assert(failedLocalImages.length === 0, `${label}: image loads failed ${JSON.stringify(failedLocalImages)}`);
  assert(evidence.consoleErrors.length === 0, `${label}: console errors ${evidence.consoleErrors}`);

  await context.close();
  return { ...evidence, approvedImageNaturalWidth: naturalWidth };
}

try {
  await mkdir(outputDir, { recursive: true });
  await waitForServer();
  const browser = await chromium.launch();
  const results = [];
  for (const [label, viewport] of [
    ["desktop", { width: 1440, height: 1100 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    results.push(await runViewport(browser, label, viewport));
  }
  await browser.close();
  await writeFile(
    `${outputDir}/evidence.json`,
    `${JSON.stringify({ recordedAt: new Date().toISOString(), baseURL, results }, null, 2)}\n`,
  );
  console.log("Beauty-essentials image proof passed on desktop and mobile.");
} finally {
  server.kill("SIGTERM");
}
