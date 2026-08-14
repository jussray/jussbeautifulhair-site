import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { chromium } from "playwright";

const host = "127.0.0.1";
const port = Number(process.env.PLAYWRIGHT_PHYSICAL_PORT || 4175);
const baseURL = `http://${host}:${port}`;
const expectedHead = process.env.EXPECTED_HEAD_SHA || "local-unpinned";
const outputDir = "artifacts/shopify-physical";
const checkoutHost = "8qp1z2-az.myshopify.com";
const brandedCheckoutHost = "jussbeautifulhair.com";
const selectedVariantId = "gid://shopify/ProductVariant/50273899900002";
const vitePath = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
let serverOutput = "";

const mockProducts = [
  {
    id: "body-wave-human-hair-bundles",
    shopifyProductId: "gid://shopify/Product/9719789060339",
    name: "Body Wave Human Hair Bundles",
    category: "Bundles",
    tagline: "",
    description: "Soft body wave human hair with live Shopify variant availability.",
    variants: [
      {
        id: "gid://shopify/ProductVariant/50273899900001",
        option: '14"',
        price: 52.99,
        availableForSale: true,
      },
      {
        id: selectedVariantId,
        option: '16"',
        price: 58.99,
        availableForSale: true,
      },
    ],
    image: "/jbh_homepage_hero.jpg",
    availableForSale: true,
  },
  {
    id: "deep-wave-4x4-transparent-lace-closure",
    shopifyProductId: "gid://shopify/Product/9719787978995",
    name: "Deep Wave 4x4 Transparent Lace Closure",
    category: "Closures & Frontals",
    tagline: "",
    description: "Deep wave transparent lace closure.",
    variants: [
      {
        id: "gid://shopify/ProductVariant/50273899900003",
        option: '12"',
        price: 39.99,
        availableForSale: true,
      },
    ],
    image: "/jbh_homepage_hero.jpg",
    availableForSale: true,
  },
];

const server = spawn(process.execPath, [vitePath, "--host", host, "--port", String(port)], {
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
});

for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", (chunk) => {
    const text = chunk.toString();
    serverOutput += text;
    process.stdout.write(text);
  });
}

async function waitForServer(timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (server.exitCode !== null) throw new Error(`Vite exited before verification.\n${serverOutput}`);
    try {
      const response = await fetch(baseURL);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${baseURL}.\n${serverOutput}`);
}

async function stopServer(timeoutMs = 5_000) {
  if (server.exitCode !== null) return;
  const exited = new Promise((resolve) => server.once("exit", resolve));
  server.kill("SIGTERM");
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
  if (server.exitCode === null) {
    server.kill("SIGKILL");
    await exited;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert(
    dimensions.scrollWidth <= dimensions.clientWidth + 1,
    `${label} overflows horizontally: ${JSON.stringify(dimensions)}`,
  );
}

async function configureMocks(page, evidence) {
  await page.route("**/api/shopify/catalog", async (route) => {
    evidence.catalogRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ products: mockProducts, source: "shopify-storefront" }),
    });
  });

  await page.route("**/api/shopify/cart", async (route) => {
    evidence.cartRequests += 1;
    const body = route.request().postDataJSON();
    evidence.cartBody = body;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        checkoutUrl: `https://${brandedCheckoutHost}/cart/c/jbh-browser-proof?key=exact-head`,
        totalQuantity: 1,
        cost: {
          subtotalAmount: { amount: "58.99", currencyCode: "USD" },
          totalAmount: { amount: "58.99", currencyCode: "USD" },
        },
      }),
    });
  });

  await page.route(`https://${checkoutHost}/cart/**`, async (route) => {
    evidence.checkoutNavigations += 1;
    evidence.checkoutUrl = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Mock Shopify Checkout</title><h1>Shopify Checkout</h1>",
    });
  });
}

let browser;
const consoleErrors = [];
const evidence = {
  catalogRequests: 0,
  cartRequests: 0,
  checkoutNavigations: 0,
  cartBody: null,
  checkoutUrl: null,
};

try {
  await mkdir(outputDir, { recursive: true });
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  desktop.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  desktop.on("pageerror", (error) => consoleErrors.push(error.message));
  await configureMocks(desktop, evidence);

  await desktop.goto(`${baseURL}/#/shop`, { waitUntil: "domcontentloaded" });
  await desktop.getByTestId("card-product-body-wave-human-hair-bundles").waitFor({ state: "visible" });
  assert((await desktop.locator("body").innerText()).includes("Live hair and beauty inventory"), "Shop page live-inventory copy is missing.");
  await assertNoHorizontalOverflow(desktop, "desktop shop");
  await desktop.screenshot({ path: `${outputDir}/shop-desktop.png`, fullPage: true });

  await desktop.getByTestId("card-product-body-wave-human-hair-bundles").click();
  await desktop.getByTestId("text-product-name").waitFor({ state: "visible" });
  await desktop.getByTestId("variant-1").click();
  await desktop.getByTestId("button-add-to-cart").click();
  assert((await desktop.getByTestId("text-cart-count").innerText()) === "1", "Cart count did not update.");

  await desktop.getByTestId("link-cart").click();
  await desktop.getByTestId("button-checkout").waitFor({ state: "visible" });
  await assertNoHorizontalOverflow(desktop, "desktop cart");
  await desktop.screenshot({ path: `${outputDir}/cart-desktop.png`, fullPage: true });

  await desktop.getByTestId("button-checkout").click();
  await desktop.getByTestId("button-place-order").waitFor({ state: "visible" });
  const checkoutText = (await desktop.locator("body").innerText()).toLowerCase();
  assert(checkoutText.includes("secure shopify checkout"), "Physical checkout does not identify Shopify.");
  assert(!checkoutText.includes("stripe"), "Physical checkout still exposes Stripe copy.");
  await desktop.screenshot({ path: `${outputDir}/checkout-desktop.png`, fullPage: true });

  await Promise.all([
    desktop.waitForURL(`https://${checkoutHost}/cart/**`),
    desktop.getByTestId("button-place-order").click(),
  ]);

  assert(evidence.cartRequests === 1, "Expected one Shopify cart request.");
  assert(evidence.checkoutNavigations === 1, "Expected one Shopify checkout navigation.");
  assert(
    JSON.stringify(evidence.cartBody) ===
      JSON.stringify({ lines: [{ merchandiseId: selectedVariantId, quantity: 1 }] }),
    `Unexpected Shopify cart payload: ${JSON.stringify(evidence.cartBody)}`,
  );
  assert(
    evidence.checkoutUrl === `https://${checkoutHost}/cart/c/jbh-browser-proof?key=exact-head`,
    `Branded Shopify checkout did not escape to the canonical host with its exact cart key: ${evidence.checkoutUrl}`,
  );

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  mobile.on("pageerror", (error) => consoleErrors.push(error.message));
  await configureMocks(mobile, evidence);
  await mobile.goto(`${baseURL}/#/shop`, { waitUntil: "domcontentloaded" });
  await mobile.getByTestId("card-product-body-wave-human-hair-bundles").waitFor({ state: "visible" });
  await assertNoHorizontalOverflow(mobile, "mobile shop");
  await mobile.screenshot({ path: `${outputDir}/shop-mobile.png`, fullPage: true });

  await mobile.getByTestId("card-product-body-wave-human-hair-bundles").click();
  await mobile.getByTestId("button-add-to-cart-mobile").waitFor({ state: "visible" });
  await mobile.getByTestId("button-add-to-cart-mobile").click();
  await mobile.getByTestId("link-cart").click();
  await mobile.getByTestId("button-checkout").click();
  await mobile.getByTestId("button-place-order").waitFor({ state: "visible" });
  await assertNoHorizontalOverflow(mobile, "mobile checkout");
  await mobile.screenshot({ path: `${outputDir}/checkout-mobile.png`, fullPage: true });

  assert(evidence.catalogRequests >= 2, "Desktop and mobile did not both request live catalog data.");
  assert(consoleErrors.length === 0, `Browser console errors: ${consoleErrors.join(" | ")}`);

  await writeFile(
    `${outputDir}/manifest.json`,
    `${JSON.stringify(
      {
        expectedHead,
        verifiedAt: new Date().toISOString(),
        route: "/#/shop -> /#/product/:handle -> /#/cart -> /#/checkout",
        viewports: ["1440x1100", "390x844"],
        evidence,
        assertions: [
          "Shop renders supplier-backed live-catalog response inside existing JBH visual shell",
          "product selection stores Shopify variant GID rather than static price identity",
          "cart and checkout remain usable on desktop and mobile",
          "physical checkout sends only merchandiseId and quantity",
          "physical checkout no longer presents Stripe as the active payment handoff",
          "branded Shopify checkout URL escapes to the canonical Shopify host without changing the cart path or key",
          "desktop and mobile layouts have no horizontal overflow",
          "browser console remained clean",
        ],
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Shopify physical storefront Playwright proof passed for ${expectedHead}.`);
} finally {
  await browser?.close();
  await stopServer();
}
