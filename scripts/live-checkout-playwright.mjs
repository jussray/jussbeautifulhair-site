import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const baseURL = process.env.LIVE_STOREFRONT_URL || "https://jussbeautifulhair.com";
const expectedLiveSha = process.env.EXPECTED_LIVE_SHA || "";
const expectedOrigin = "https://jussbeautifulhair.com";
const stripeOrigin = "https://checkout.stripe.com";
const outputDir = "artifacts/live-checkout";
const cartStorageKey = "jbh_cart_v1";
const seededCart = [
  {
    id: "bundle-bodywave",
    name: "Lawless Body Wave Bundle — Raw Vietnamese",
    variant: '14"',
    price: 75,
    qty: 1,
    image: "/products/bundle-bodywave.jpg",
  },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForExpectedLiveSha(attempts = 20, delayMs = 15_000) {
  let lastObserved = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${baseURL}/version`, {
        headers: { accept: "application/json" },
      });
      if (response.ok) {
        const payload = await response.json();
        lastObserved = payload?.sha ?? null;
        if (payload?.ok === true && payload?.sha === expectedLiveSha) return payload;
      }
    } catch {
      // Production can be between deploy states; retry within the bounded gate.
    }

    if (attempt < attempts) await sleep(delayMs);
  }

  throw new Error(
    `Live version did not reach expected SHA ${expectedLiveSha}; last observed ${lastObserved ?? "unavailable"}.`,
  );
}

const parsedBase = new URL(baseURL);
assert(parsedBase.origin === expectedOrigin, `LIVE_STOREFRONT_URL must be exactly ${expectedOrigin}.`);
assert(/^[0-9a-f]{40}$/i.test(expectedLiveSha), "EXPECTED_LIVE_SHA must be an exact 40-character commit SHA.");

await mkdir(outputDir, { recursive: true });
const versionPayload = await waitForExpectedLiveSha();
const browser = await chromium.launch({ headless: true });
const consoleErrors = [];

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.addInitScript(
    ({ key, cart }) => {
      sessionStorage.setItem(key, JSON.stringify(cart));
    },
    { key: cartStorageKey, cart: seededCart },
  );

  const storefrontResponse = await page.goto(`${baseURL}/#/checkout`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  assert(storefrontResponse?.ok(), `Live checkout page returned HTTP ${storefrontResponse?.status() ?? "unknown"}.`);

  await page.getByTestId("button-place-order").waitFor({ state: "visible", timeout: 30_000 });
  const checkoutText = await page.locator("body").innerText();
  assert(checkoutText.includes("Lawless Body Wave Bundle"), "Seeded physical product is missing from live checkout.");
  assert(checkoutText.includes("$75"), "Live checkout subtotal is missing or changed.");
  assert(checkoutText.includes("$9.99"), "Expected flat shipping is missing from live checkout.");
  assert(checkoutText.includes("$84.99"), "Expected live checkout total is missing or changed.");

  await page.screenshot({ path: `${outputDir}/storefront-checkout.png`, fullPage: true });

  const checkoutResponsePromise = page.waitForResponse(
    (response) =>
      response.url() === `${baseURL}/api/checkout` &&
      response.request().method() === "POST",
    { timeout: 60_000 },
  );

  await page.getByTestId("button-place-order").click();
  const checkoutResponse = await checkoutResponsePromise;
  assert(checkoutResponse.status() === 200, `/api/checkout returned HTTP ${checkoutResponse.status()}.`);

  const checkoutPayload = await checkoutResponse.json();
  assert(typeof checkoutPayload?.url === "string", "Live checkout did not return a Stripe redirect URL.");
  const returnedStripeUrl = new URL(checkoutPayload.url);
  assert(returnedStripeUrl.origin === stripeOrigin, `Live checkout returned unexpected payment origin ${returnedStripeUrl.origin}.`);

  await page.waitForURL((url) => url.origin === stripeOrigin, { timeout: 60_000 });
  await page.locator("body").waitFor({ state: "visible", timeout: 30_000 });
  const stripeText = await page.locator("body").innerText();
  const normalizedStripeText = stripeText.toLowerCase();

  assert(page.url().startsWith(`${stripeOrigin}/`), "Browser did not reach Stripe hosted Checkout.");
  assert(
    normalizedStripeText.includes("lawless body wave bundle") || normalizedStripeText.includes("juss beautiful hair"),
    "Stripe Checkout did not render the JBH purchase context.",
  );
  assert(
    stripeText.includes("$84.99") || stripeText.includes("$75.00") || stripeText.includes("$75"),
    "Stripe Checkout did not render the expected purchase amount.",
  );
  assert(
    (await page.locator("input, iframe, button").count()) > 0,
    "Stripe Checkout rendered without interactive payment controls.",
  );

  await page.screenshot({ path: `${outputDir}/stripe-payment-screen.png`, fullPage: true });

  assert(consoleErrors.length === 0, `Live checkout browser console errors: ${consoleErrors.join(" | ")}`);

  await writeFile(
    `${outputDir}/manifest.json`,
    `${JSON.stringify(
      {
        expectedLiveSha,
        observedLiveSha: versionPayload.sha,
        verifiedAt: new Date().toISOString(),
        storefrontOrigin: expectedOrigin,
        apiCheckoutStatus: checkoutResponse.status(),
        paymentOrigin: returnedStripeUrl.origin,
        seededProduct: {
          id: "bundle-bodywave",
          variant: '14"',
          quantity: 1,
          subtotalUsd: "75.00",
          shippingUsd: "9.99",
          totalUsd: "84.99",
        },
        assertions: [
          "live /version matched the exact expected production SHA",
          "physical product rendered in the live checkout review",
          "server-authoritative subtotal, shipping, and total rendered",
          "live POST /api/checkout returned HTTP 200",
          "checkout response returned only the approved Stripe hosted origin",
          "browser reached Stripe hosted Checkout",
          "Stripe rendered JBH purchase context and interactive payment controls",
          "no payment was submitted by the smoke test",
        ],
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Live checkout Playwright proof passed for ${expectedLiveSha}; no payment submitted.`);
} finally {
  await browser.close();
}
