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
const numericVariantId = "50196622344435";
const vitePath = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
let serverOutput = "";

const server = spawn(process.execPath, [vitePath, "--host", host, "--port", String(port)], {
  env: {
    ...process.env,
    VITE_SHOPIFY_STORE_DOMAIN: "jbh-25.myshopify.com",
    VITE_SHOPIFY_HAIR_MATCH_VARIANT_ID: variantId,
  },
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

async function configureShopifyPermalinkMock(page, evidence) {
  await page.route("https://jbh-25.myshopify.com/cart/**", async (route) => {
    const checkout = new URL(route.request().url());
    evidence.checkoutRequests += 1;
    evidence.checkoutNavigation = checkout.toString();
    evidence.checkoutPath = checkout.pathname;
    evidence.ref = checkout.searchParams.get("ref");
    evidence.accessTokenPresent = checkout.searchParams.has("access_token");
    evidence.attributes = {};
    for (const [key, value] of checkout.searchParams.entries()) {
      const match = key.match(/^attributes\[(.+)\]$/);
      if (match) evidence.attributes[match[1]] = value;
    }

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
  checkoutRequests: 0,
  checkoutNavigation: null,
  checkoutPath: null,
  attributes: {},
  ref: null,
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
  await configureShopifyPermalinkMock(desktop, evidence);

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
  assert(await checkoutButton.isEnabled(), "Configured Shopify checkout is disabled.");
  await assertNoHorizontalOverflow(desktop, "desktop Hair Match page");
  await desktop.screenshot({ path: `${outputDir}/hair-match-desktop.png`, fullPage: true });

  await Promise.all([
    desktop.waitForURL("https://jbh-25.myshopify.com/cart/**"),
    checkoutButton.click(),
  ]);

  assert(evidence.checkoutRequests === 1, "Expected exactly one Shopify checkout navigation.");
  assert(
    evidence.checkoutPath === `/cart/${numericVariantId}:1`,
    "Unexpected Shopify cart permalink path.",
  );
  assert(evidence.accessTokenPresent === false, "Checkout URL exposed a Storefront token.");
  assert(evidence.ref === "jbh-hair-match-v1", "Referral marker is missing.");
  assert(evidence.attributes.source === "jussbeautifulhair.com", "Source attribute is missing.");
  assert(evidence.attributes.offer === "jbh-hair-match-v1", "Offer attribute is missing.");
  assert(evidence.attributes.hair_goal === "wig", "Hair goal attribute is wrong.");
  assert(evidence.attributes.preferred_length === "medium-16-20", "Length attribute is wrong.");
  assert(evidence.attributes.budget === "150-250", "Budget attribute is wrong.");
  assert(evidence.attributes.maintenance === "low-maintenance", "Maintenance attribute is wrong.");
  assert(
    evidence.checkoutNavigation?.startsWith("https://jbh-25.myshopify.com/cart/"),
    "Browser did not navigate to an HTTPS Shopify cart permalink.",
  );

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  mobile.on("pageerror", (error) => consoleErrors.push(error.message));
  await mobile.goto(`${baseURL}/#/hair-match`, { waitUntil: "domcontentloaded" });
  await mobile.getByTestId("select-hair-goal").waitFor({ state: "visible" });
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
          "four bounded non-sensitive preferences rendered",
          "preferences attached to Shopify cart permalink attributes",
          "no Storefront access token exposed",
          "approved numeric Shopify variant and quantity used",
          "unsupported launch and fulfillment claims absent",
          "Hair Match navigation visible on desktop and mobile",
          "HTTPS Shopify cart permalink navigation occurred",
          "desktop and mobile layouts have no horizontal overflow",
          "browser console remained clean",
        ],
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Shopify permalink Playwright proof passed for ${expectedHead}.`);
} finally {
  await browser?.close();
  await stopServer();
}
