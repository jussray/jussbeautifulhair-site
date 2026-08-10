import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const baseURL = process.env.LIVE_STOREFRONT_URL || "https://jussbeautifulhair.com";
const expectedHead = process.env.EXPECTED_HEAD_SHA || process.env.RELEASE_SHA || "unverified";
const expectedOrigin = "https://jussbeautifulhair.com";
const outputDir = "artifacts/frontdoor-live";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertStorefrontResponse(response, label) {
  assert(response, `${label}: navigation returned no main response.`);
  assert(response.ok(), `${label}: storefront returned HTTP ${response.status()}.`);
  const headers = response.headers();
  assert(
    headers["x-frame-options"]?.toUpperCase() === "DENY",
    `${label}: Cloudflare Worker security header X-Frame-Options: DENY is missing.`,
  );
  assert(
    headers["content-signal"]?.includes("search=yes"),
    `${label}: Cloudflare Worker Content-Signal header is missing.`,
  );
}

function assertNotShopifyPassword(bodyText, label) {
  const normalized = bodyText.toLowerCase();
  for (const marker of [
    "enter store using password",
    "this store is password protected",
    "opening soon",
  ]) {
    assert(!normalized.includes(marker), `${label}: Shopify password-wall marker rendered: ${marker}`);
  }
}

const parsedBase = new URL(baseURL);
assert(parsedBase.origin === expectedOrigin, `LIVE_STOREFRONT_URL must be exactly ${expectedOrigin}.`);

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const versionResponse = await fetch(`${baseURL}/version`, {
  headers: { accept: "application/json" },
});
assert(
  versionResponse.ok,
  `version route returned HTTP ${versionResponse.status}.`,
);
const versionPayload = await versionResponse.json();
assert(versionPayload.ok === true, "version route did not report ok=true.");
assert(
  versionPayload.sha === expectedHead,
  `version SHA mismatch: expected ${expectedHead}, received ${versionPayload.sha}.`,
);
const consoleErrors = [];
const results = [];

try {
  for (const viewport of [
    { label: "desktop", width: 1440, height: 1000 },
    { label: "mobile", width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(`${viewport.label}: ${message.text()}`);
    });
    page.on("pageerror", (error) => consoleErrors.push(`${viewport.label}: ${error.message}`));

    const response = await page.goto(`${baseURL}/#/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    assertStorefrontResponse(response, viewport.label);
    await page.locator("#root").waitFor({ state: "visible", timeout: 30_000 });

    const title = await page.title();
    const bodyText = await page.locator("body").innerText();
    assert(title.includes("Juss Beautiful Hair"), `${viewport.label}: branded document title is missing.`);
    assert(bodyText.includes("Juss Beautiful Hair"), `${viewport.label}: branded storefront text is missing.`);
    assertNotShopifyPassword(bodyText, viewport.label);

    await page.screenshot({
      path: `${outputDir}/home-${viewport.label}.png`,
      fullPage: true,
    });

    results.push({
      viewport: `${viewport.width}x${viewport.height}`,
      status: response.status(),
      title,
      workerHeadersVerified: true,
      shopifyPasswordWallAbsent: true,
    });
    await page.close();
  }

  const policyPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  for (const route of ["shipping", "returns", "privacy", "terms"]) {
    const response = await policyPage.goto(`${baseURL}/#/${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    assertStorefrontResponse(response, route);
    const bodyText = await policyPage.locator("body").innerText();
    assertNotShopifyPassword(bodyText, route);
    assert(bodyText.toLowerCase().includes(route), `${route}: expected policy content did not render.`);
  }
  await policyPage.close();

  assert(consoleErrors.length === 0, `Live browser console errors: ${consoleErrors.join(" | ")}`);

  await writeFile(
    `${outputDir}/manifest.json`,
    `${JSON.stringify(
      {
        expectedHead,
        verifiedAt: new Date().toISOString(),
        origin: expectedOrigin,
        assertions: [
          "root responds successfully on desktop and mobile",
          "Cloudflare Worker security headers prove the Worker served the root response",
          "version route serves the exact approved main SHA",
          "Shopify password-wall markers are absent",
          "Juss Beautiful Hair title and storefront text render",
          "shipping, returns, privacy, and terms routes render through the branded origin",
          "desktop and mobile browser consoles remain clean",
        ],
        results,
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Live JBH front-door Playwright proof passed for ${expectedHead}.`);
} finally {
  await browser.close();
}
