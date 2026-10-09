import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { chromium } from "playwright";

const host = "127.0.0.1";
const port = Number(process.env.PLAYWRIGHT_PORT || 4174);
const baseURL = `http://${host}:${port}`;
const privateIngressOrigin = "https://ingress.jbh.invalid";
const expectedHead = process.env.EXPECTED_HEAD_SHA || "local-unpinned";
const outputDir = "artifacts/shopify-headless";
const variantGid = "gid://shopify/ProductVariant/50196622344435";
const shopifyCatalogFixture = {
  products: [
    {
      id: "body-wave-human-hair-bundles",
      shopifyProductId: "gid://shopify/Product/9719789060339",
      name: "Body Wave Human Hair Bundles",
      category: "Bundles",
      tagline: "Live Shopify inventory",
      description: "Supplier-backed body wave bundles fulfilled through the connected Shopify catalog.",
      variants: [
        {
          id: "gid://shopify/ProductVariant/50273899900001",
          option: '14"',
          price: 75,
          availableForSale: true,
        },
      ],
      image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Crect width='100%25' height='100%25' fill='%23f3ede8'/%3E%3C/svg%3E",
      availableForSale: true,
    },
  ],
};
const vitePath = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
let serverOutput = "";

const server = spawn(process.execPath, [vitePath, "--host", host, "--port", String(port)], {
  env: {
    ...process.env,
    VITE_CONTACT_API_URL: `${privateIngressOrigin}/contact`,
    VITE_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
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

async function verifyBrandedCartHandoff(browser, viewport, label) {
  const page = await browser.newPage({ viewport });
  let navigation = null;

  await page.route("https://8qp1z2-az.myshopify.com/cart/c/**", async (route) => {
    navigation = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Mock Shopify Checkout</title><h1>Shopify Checkout</h1>",
    });
  });

  const cartToken = `inbound-${label}`;
  const expectedUrl = `https://8qp1z2-az.myshopify.com/cart/c/${cartToken}?key=handoff-secret`;
  await page.goto(`${baseURL}/cart/c/${cartToken}?key=handoff-secret`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForURL(expectedUrl);

  assert(navigation === expectedUrl, `${label} branded cart handoff did not preserve path and key.`);
  assert(
    (await page.locator("body").innerText()).includes("Shopify Checkout"),
    `${label} branded cart handoff did not reach Shopify checkout.`,
  );
  await page.screenshot({ path: `${outputDir}/cart-handoff-${label}.png`, fullPage: true });
  await page.close();

  return navigation;
}


async function configureShopifyCatalogMock(page) {
  await page.route("**/api/shopify/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(shopifyCatalogFixture),
    });
  });
}

async function configureNewsletterMocks(page, evidence, label) {
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: `
          window.turnstile = {
            render: function (_container, options) {
              setTimeout(function () { options.callback("playwright-newsletter-token"); }, 0);
              return "newsletter-widget";
            },
            reset: function () {},
            remove: function () {}
          };
        `,
      });
    },
  );

  await page.route(`${privateIngressOrigin}/newsletter`, async (route) => {
    const request = route.request();
    const headers = {
      "Access-Control-Allow-Origin": baseURL,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers, body: "" });
      return;
    }

    const payload = request.postDataJSON();
    evidence.newsletterSubmissions.push({ label, payload });
    await route.fulfill({
      status: 201,
      headers,
      body: JSON.stringify({
        subscribed: true,
        receipt: `newsletter-${label}-receipt`,
      }),
    });
  });
}

async function verifyNewsletterSignup(browser, viewport, label, evidence) {
  const page = await browser.newPage({ viewport });
  await configureShopifyCatalogMock(page);
  await configureNewsletterMocks(page, evidence, label);
  await page.goto(`${baseURL}/`, { waitUntil: "domcontentloaded" });

  await page.getByTestId("input-newsletter").fill(`proof-${label}@example.com`);
  await page.getByTestId("checkbox-newsletter-consent").check();
  await page.waitForTimeout(50);
  await page.getByTestId("button-subscribe").click();
  await page.getByTestId("text-subscribed").waitFor({ state: "visible" });

  const submission = evidence.newsletterSubmissions.find((entry) => entry.label === label);
  assert(submission, `${label} newsletter submission was not sent.`);
  assert(
    submission.payload?.email === `proof-${label}@example.com`,
    `${label} newsletter email changed before private ingress.`,
  );
  assert(submission.payload?.consent === true, `${label} newsletter consent was not explicit.`);
  assert(
    submission.payload?.turnstileToken === "playwright-newsletter-token",
    `${label} newsletter Turnstile token was not forwarded.`,
  );
  assert(
    submission.payload?.companyWebsite === "",
    `${label} newsletter honeypot was not empty.`,
  );

  await assertNoHorizontalOverflow(page, `${label} newsletter signup`);
  await page.screenshot({ path: `${outputDir}/newsletter-${label}.png`, fullPage: true });
  await page.close();

  return submission.payload;
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
  handoffDesktopNavigation: null,
  handoffMobileNavigation: null,
  newsletterSubmissions: [],
  newsletterDesktopPayload: null,
  newsletterMobilePayload: null,
};

try {
  await mkdir(outputDir, { recursive: true });
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  evidence.newsletterDesktopPayload = await verifyNewsletterSignup(
    browser,
    { width: 1440, height: 1100 },
    "desktop",
    evidence,
  );
  evidence.newsletterMobilePayload = await verifyNewsletterSignup(
    browser,
    { width: 390, height: 844 },
    "mobile",
    evidence,
  );

  evidence.handoffDesktopNavigation = await verifyBrandedCartHandoff(
    browser,
    { width: 1440, height: 1100 },
    "desktop",
  );
  evidence.handoffMobileNavigation = await verifyBrandedCartHandoff(
    browser,
    { width: 390, height: 844 },
    "mobile",
  );

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  desktop.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  desktop.on("pageerror", (error) => consoleErrors.push(error.message));
  await configureShopifyBridgeMock(desktop, evidence);
  await configureShopifyCatalogMock(desktop);

  await desktop.goto(`${baseURL}/`, { waitUntil: "domcontentloaded" });
  await desktop.getByTestId("button-hair-match-hero").waitFor({ state: "visible" });
  assert(
    await desktop.getByTestId("hair-match-home-offer").isVisible(),
    "Homepage Hair Match decision-help offer is missing.",
  );
  await desktop.getByTestId("button-hair-match-hero").click();
  await desktop.waitForURL("**/hair-match");

  await desktop.goto(`${baseURL}/hair-match`, { waitUntil: "domcontentloaded" });
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
  await configureShopifyCatalogMock(mobile);
  await mobile.goto(`${baseURL}/`, { waitUntil: "domcontentloaded" });
  await mobile.getByTestId("button-hair-match-hero-mobile").waitFor({ state: "visible" });
  assert(
    await mobile.getByTestId("hair-match-home-offer").isVisible(),
    "Mobile homepage Hair Match decision-help offer is missing.",
  );
  await mobile.getByTestId("button-hair-match-hero-mobile").click();
  await mobile.waitForURL("**/hair-match");

  await mobile.goto(`${baseURL}/hair-match`, { waitUntil: "domcontentloaded" });
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
          "newsletter signup uses explicit consent, Turnstile, honeypot, and private ingress on desktop and mobile",
          "newsletter signup renders without horizontal overflow on desktop and mobile",
          "direct branded /cart/c/* URLs hand off to canonical Shopify checkout on desktop and mobile",
          "direct branded cart handoff preserves the Shopify cart path and identity key",
          "truthful consultation and future-credit disclosure rendered",
          "four bounded non-sensitive preferences sent to the guarded Shopify bridge",
          "approved numeric Shopify variant and quantity sent without client pricing authority",
          "branded Shopify checkout URL escaped to canonical myshopify host",
          "Shopify cart path and identity key were preserved",
          "no Storefront access token exposed",
          "unsupported launch and fulfillment claims absent",
          "homepage exposes Hair Match conversion CTA on desktop and mobile",
          "homepage Hair Match CTA routes into the bounded Shopify offer",
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
