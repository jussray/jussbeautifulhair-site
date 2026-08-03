import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { chromium } from "playwright";

const host = "127.0.0.1";
const port = Number(process.env.PLAYWRIGHT_PORT || 4174);
const baseURL = `http://${host}:${port}`;
const expectedHead = process.env.EXPECTED_HEAD_SHA || "local-unpinned";
const outputDir = "artifacts/shopify-headless";
const variantId = "gid://shopify/ProductVariant/50196622344435";
const vitePath = fileURLToPath(
  new URL("../node_modules/vite/bin/vite.js", import.meta.url),
);
let serverOutput = "";

const server = spawn(
  process.execPath,
  [vitePath, "--host", host, "--port", String(port)],
  {
    env: {
      ...process.env,
      VITE_SHOPIFY_STORE_DOMAIN: "jbh-25.myshopify.com",
      VITE_SHOPIFY_STOREFRONT_ACCESS: "browser-safe-test-access",
      VITE_SHOPIFY_STOREFRONT_API_VERSION: "2026-07",
      VITE_SHOPIFY_HAIR_MATCH_VARIANT_ID: variantId,
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

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
    if (server.exitCode !== null) {
      throw new Error(`Vite exited before verification.\n${serverOutput}`);
    }
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
  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
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

async function configureShopifyMocks(page, evidence) {
  await page.route("https://jbh-25.myshopify.com/api/**/graphql.json", async (route) => {
    const request = route.request();
    const payload = request.postDataJSON();
    const access = request.headers()["x-shopify-storefront-access-token"];

    evidence.graphqlRequests += 1;
    evidence.accessHeaderPresent = access === "browser-safe-test-access";
    evidence.requestedVariant =
      payload?.variables?.input?.lines?.[0]?.merchandiseId || null;
    evidence.usesCartCreate = String(payload?.query || "").includes("cartCreate");

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          cartCreate: {
            cart: {
              id: "gid://shopify/Cart/test-cart",
              checkoutUrl: "https://checkout.shopify.com/c/jbh-hair-match-test",
              cost: {
                totalAmount: { amount: "25.00", currencyCode: "USD" },
              },
            },
            userErrors: [],
          },
        },
      }),
    });
  });

  await page.route("https://checkout.shopify.com/**", async (route) => {
    evidence.checkoutNavigation = route.request().url();
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
  graphqlRequests: 0,
  accessHeaderPresent: false,
  requestedVariant: null,
  usesCartCreate: false,
  checkoutNavigation: null,
};

try {
  await mkdir(outputDir, { recursive: true });
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  desktop.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  desktop.on("pageerror", (error) => consoleErrors.push(error.message));
  await configureShopifyMocks(desktop, evidence);

  await desktop.goto(`${baseURL}/#/hair-match`, { waitUntil: "domcontentloaded" });
  const bodyText = await desktop.locator("body").innerText();
  assert(bodyText.includes("Juss Hair Match Session"), "Hair Match title is missing.");
  assert(bodyText.includes("$25"), "Hair Match price is missing.");
  assert(
    bodyText.includes("not an order for physical hair") &&
      bodyText.includes("no hair product ships from this purchase"),
    "Non-physical-product disclosure is incomplete.",
  );
  assert(bodyText.includes("Founding-client Hair Match"), "Truthful Hair Match announcement is missing.");
  for (const retiredClaim of ["Now Open", "shipped from the US", "shipping nationwide"]) {
    assert(!bodyText.includes(retiredClaim), `Unsupported storefront claim remains: ${retiredClaim}`);
  }
  assert(
    await desktop.getByTestId("link-nav-hair-match").isVisible(),
    "Desktop Hair Match navigation is missing.",
  );

  const checkoutButton = desktop.getByTestId("button-hair-match-checkout");
  await checkoutButton.waitFor({ state: "visible" });
  assert(await checkoutButton.isEnabled(), "Configured Shopify checkout is disabled.");
  await assertNoHorizontalOverflow(desktop, "desktop Hair Match page");
  await desktop.screenshot({
    path: `${outputDir}/hair-match-desktop.png`,
    fullPage: true,
  });

  await Promise.all([
    desktop.waitForURL("https://checkout.shopify.com/**"),
    checkoutButton.click(),
  ]);

  assert(evidence.graphqlRequests === 1, "Expected exactly one Shopify cartCreate request.");
  assert(evidence.accessHeaderPresent, "Public Storefront access header was missing.");
  assert(evidence.usesCartCreate, "Shopify cartCreate was not used.");
  assert(evidence.requestedVariant === variantId, "Unexpected Shopify variant was requested.");
  assert(
    evidence.checkoutNavigation?.startsWith("https://checkout.shopify.com/"),
    "Browser did not navigate to an HTTPS Shopify checkout.",
  );

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  mobile.on("pageerror", (error) => consoleErrors.push(error.message));
  await mobile.goto(`${baseURL}/#/hair-match`, { waitUntil: "domcontentloaded" });
  await mobile.getByTestId("button-hair-match-checkout").waitFor({ state: "visible" });
  await mobile.getByTestId("button-menu").click();
  assert(
    await mobile.getByTestId("link-mobnav-hair-match").isVisible(),
    "Mobile Hair Match navigation is missing.",
  );
  await mobile.getByTestId("button-menu").click();
  await assertNoHorizontalOverflow(mobile, "mobile Hair Match page");
  await mobile.screenshot({
    path: `${outputDir}/hair-match-mobile.png`,
    fullPage: true,
  });

  assert(consoleErrors.length === 0, `Browser console errors: ${consoleErrors.join(" | ")}`);

  await writeFile(
    `${outputDir}/manifest.json`,
    `${JSON.stringify(
      {
        expectedHead,
        verifiedAt: new Date().toISOString(),
        route: "/#/hair-match",
        viewports: ["1440x1000", "390x844"],
        evidence,
        assertions: [
          "truthful consultation and future-credit disclosure rendered",
          "unsupported launch and fulfillment claims absent",
          "Hair Match navigation visible on desktop and mobile",
          "configured CTA enabled",
          "Shopify cartCreate used with the approved variant",
          "public Storefront access header supplied",
          "HTTPS Shopify checkout navigation occurred",
          "desktop and mobile layouts have no horizontal overflow",
          "browser console remained clean",
        ],
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Shopify headless Playwright proof passed for ${expectedHead}.`);
} finally {
  await browser?.close();
  await stopServer();
}
