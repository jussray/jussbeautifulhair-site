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
const variantGid = "gid://shopify/ProductVariant/50196622344435";
const vitePath = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
let serverOutput = "";

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

async function configureShopifyBridgeMock(page, evidence) {
  await page.route("**/api/shopify/cart", async (route) => {
    const request = route.request();
    evidence.bridgeRequests += 1;
    evidence.bridgePayload = request.postDataJSON();

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        checkoutUrl: "https://jussbeautifulhair.com/cart/c/hair-match-proof?key=proof-secret",
        totalQuantity: 1,
        cost: {
          subtotalAmount: { amount: "25.00", currencyCode: "USD" },
          totalAmount: { amount: "25.00", currencyCode: "USD" },
        },
      }),
    });
  });

  await page.route("https://8qp1z2-az.myshopify.com/cart/c/**", async (route) => {
    const checkout = new URL(route.request().url());
    evidence.checkoutRequests += 1;
    evidence.checkoutNavigation = checkout.toString();
    evidence.checkoutPath = checkout.pathname;
    evidence.checkoutKey = checkout.searchParams.get("key");
    evidence.accessTokenPresent = checkout.searchParams.has("access_token");

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
  configurationSource: "repository-approved-cloudflare-shopify-bridge",
  bridgeRequests: 0,
  bridgePayload: null,
  checkoutRequests: 0,
  checkoutNavigation: null,
  checkoutPath: null,
  checkoutKey: null,
  accessTokenPresent: false,
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
  await configureShopifyBridgeMock(desktop, evidence);

  await desktop.goto(`${baseURL}/#/hair-match`, { waitUntil: "domcontentloaded" });
  const bodyText = await desktop.locator("body").innerText();
  const normalizedText = bodyText.toLowerCase();
  assert(normalizedText.includes("juss hair match session"), "Hair Match title is missing.");
  assert(bodyText.includes("$25"), "Hair Match price is missing.");
  assert(
    normalizedText.includes("not an order for physical hair") &&
      normalizedText.includes("no hair product ships from this purchase"),
    "Non-physical-product disclosure is incomplete.",
  );
  assert(normalizedText.includes("founding-client hair match"), "Truthful announcement is missing.");
  for (const retiredClaim of ["now open", "shipped from the us", "shipping nationwide"]) {
    assert(!normalizedText.includes(retiredClaim), `Unsupported storefront claim remains: ${retiredClaim}`);
  }
  assert(await desktop.getByTestId("link-nav-hair-match").isVisible(), "Desktop navigation is missing.");

  await desktop.getByTestId("select-hair-goal").selectOption("wig");
  await desktop.getByTestId("select-preferred-length").selectOption("medium-16-20");
  await desktop.getByTestId("select-budget").selectOption("150-250");
  await desktop.getByTestId("select-maintenance").selectOption("low-maintenance");

  const checkoutButton = desktop.getByTestId("button-hair-match-checkout");
  await checkoutButton.waitFor({ state: "visible" });
  assert(await checkoutButton.isEnabled(), "Repository-approved Shopify checkout is disabled.");
  await assertNoHorizontalOverflow(desktop, "desktop Hair Match page");
  await desktop.screenshot({ path: `${outputDir}/hair-match-desktop.png`, fullPage: true });

  await Promise.all([
    desktop.waitForURL("https://8qp1z2-az.myshopify.com/cart/c/**"),
    checkoutButton.click(),
  ]);

  assert(evidence.bridgeRequests === 1, "Expected exactly one Shopify bridge request.");
  assert(evidence.checkoutRequests === 1, "Expected exactly one Shopify checkout navigation.");
  assert(evidence.checkoutPath === "/cart/c/hair-match-proof", "Unexpected Shopify checkout path.");
  assert(evidence.checkoutKey === "proof-secret", "Shopify cart identity key was not preserved.");
  assert(evidence.accessTokenPresent === false, "Checkout URL exposed a Storefront token.");

  const payload = evidence.bridgePayload;
  assert(payload && typeof payload === "object", "Shopify bridge payload is missing.");
  assert(Array.isArray(payload.lines) && payload.lines.length === 1, "Hair Match must send one cart line.");
  assert(payload.lines[0].merchandiseId === variantGid, "Hair Match used the wrong Shopify variant.");
  assert(payload.lines[0].quantity === 1, "Hair Match quantity is wrong.");
  assert(payload.hairMatch?.offer === "jbh-hair-match-v1", "Hair Match offer marker is missing.");
  assert(Array.isArray(payload.hairMatch?.attributes), "Hair Match preference attributes are missing.");
  const attributes = Object.fromEntries(
    payload.hairMatch.attributes.map(({ key, value }) => [key, value]),
  );
  assert(attributes.hair_goal === "wig", "Hair goal attribute is wrong.");
  assert(attributes.preferred_length === "medium-16-20", "Length attribute is wrong.");
  assert(attributes.budget === "150-250", "Budget attribute is wrong.");
  assert(attributes.maintenance === "low-maintenance", "Maintenance attribute is wrong.");
  assert(!("price" in payload) && !("total" in payload), "Client sent pricing authority to the bridge.");
  assert(
    evidence.checkoutNavigation?.startsWith("https://8qp1z2-az.myshopify.com/cart/c/"),
    "Branded Shopify checkout did not escape to the canonical Shopify host.",
  );

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  mobile.on("pageerror", (error) => consoleErrors.push(error.message));
  await mobile.goto(`${baseURL}/#/hair-match`, { waitUntil: "domcontentloaded" });
  await mobile.getByTestId("select-hair-goal").waitFor({ state: "visible" });
  assert(
    await mobile.getByTestId("button-hair-match-checkout").isEnabled(),
    "Mobile repository-approved Shopify checkout is disabled.",
  );
  await mobile.getByTestId("button-menu").click();
  assert(await mobile.getByTestId("link-mobnav-hair-match").isVisible(), "Mobile navigation is missing.");
  await mobile.getByTestId("button-menu").click();
  await assertNoHorizontalOverflow(mobile, "mobile Hair Match page");
  await mobile.screenshot({ path: `${outputDir}/hair-match-mobile.png`, fullPage: true });

  assert(consoleErrors.length === 0, `Browser console errors: ${consoleErrors.join(" | ")}`);

  await writeFile(
    `${outputDir}/manifest.json`,
    `${JSON.stringify(
      {
        expectedHead,
        verifiedAt: new Date().toISOString(),
        route: "/#/hair-match",
        viewports: ["1440x1100", "390x844"],
        evidence,
        assertions: [
          "truthful consultation and future-credit disclosure rendered",
          "four bounded non-sensitive preferences sent to the guarded Shopify bridge",
          "approved numeric Shopify variant and quantity sent without client pricing authority",
          "branded Shopify checkout URL escaped to canonical myshopify host",
          "Shopify cart path and identity key were preserved",
          "no Storefront access token exposed",
          "unsupported launch and fulfillment claims absent",
          "Hair Match navigation visible on desktop and mobile",
          "desktop and mobile layouts have no horizontal overflow",
          "browser console remained clean",
        ],
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Shopify bridge Playwright proof passed for ${expectedHead}.`);
} finally {
  await browser?.close();
  await stopServer();
}
