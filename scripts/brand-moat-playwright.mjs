import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { chromium } from "playwright";

const host = "127.0.0.1";
const port = Number(process.env.PLAYWRIGHT_PORT || 4173);
const baseURL = `http://${host}:${port}`;
const expectedHead = process.env.EXPECTED_HEAD_SHA || "local-unpinned";
const outputDir = "artifacts/brand-moat";
const vitePath = fileURLToPath(
  new URL("../node_modules/vite/bin/vite.js", import.meta.url),
);
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
          option: '14\"',
          price: 75,
          availableForSale: true,
        },
      ],
      image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Crect width='100%25' height='100%25' fill='%23f3ede8'/%3E%3C/svg%3E",
      availableForSale: true,
    },
  ],
};
let serverOutput = "";
let catalogMode = "success";

const server = spawn(
  process.execPath,
  [vitePath, "--host", host, "--port", String(port)],
  {
    env: { ...process.env },
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

let browser;
const consoleErrors = [];
try {
  await mkdir(outputDir, { recursive: true });
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.route("**/api/shopify/catalog", async (route) => {
    if (catalogMode === "failure") {
      // Use an HTTP-successful but contract-invalid response. The storefront must
      // still fail closed because `products` is absent, while the browser console
      // remains clean enough to catch unrelated runtime errors independently.
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ error: "proof fixture: Shopify catalog unreadable" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(shopifyCatalogFixture),
    });
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  const moat = page.getByTestId("brand-moat");
  await moat.waitFor({ state: "visible" });
  assert((await moat.innerText()).includes("Story. Quality. Care. Proof."), "Brand moat heading is missing.");
  for (const pillar of ["story", "quality", "care", "proof"]) {
    assert(await page.getByTestId(`brand-moat-${pillar}`).isVisible(), `Brand moat pillar ${pillar} is missing.`);
  }
  await page.getByText("Live from Shopify", { exact: true }).waitFor({ state: "visible", timeout: 15_000 });
  await page
    .getByText("Lawless Body Wave Bundles", { exact: true })
    .first()
    .waitFor({ state: "visible", timeout: 15_000 });
  const desktopText = await page.locator("body").innerText();
  for (const riskyClaim of ["Quality Guaranteed", "never tangles", "lasts 2+ years", "factory pricing"]) {
    assert(!desktopText.includes(riskyClaim), `Unsupported certainty is still public: ${riskyClaim}`);
  }
  assert(desktopText.includes("Live from Shopify"), "Shopify catalog authority label is missing.");
  assert(desktopText.includes("Lawless Body Wave Bundles"), "Shopify-backed signature product did not render.");
  assert(!desktopText.includes("Crown Logo Cap"), "Untold Stories product leaked into the hair storefront.");
  await assertNoHorizontalOverflow(page, "desktop homepage");
  await page.screenshot({ path: `${outputDir}/home-desktop.png`, fullPage: true });

  await page.goto(`${baseURL}/#/about`, { waitUntil: "domcontentloaded" });
  const aboutText = await page.locator("body").innerText();
  assert(aboutText.includes("Beauty can carry memory."), "Evidence-aware brand story is missing from About.");
  assert(aboutText.includes("Story, Quality, Care, and Proof"), "Shared brand pillars are missing from About.");
  await page.screenshot({ path: `${outputDir}/about-desktop.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.getByTestId("button-shop-hero-mobile").waitFor({ state: "visible" });
  assert(await page.getByTestId("brand-moat").isVisible(), "Brand moat is not visible on mobile.");
  await assertNoHorizontalOverflow(page, "mobile homepage");
  await page.screenshot({ path: `${outputDir}/home-mobile.png`, fullPage: true });

  catalogMode = "failure";
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  const unavailable = page.getByTestId("home-catalog-unavailable");
  await unavailable.waitFor({ state: "visible", timeout: 15_000 });
  const unavailableText = await unavailable.innerText();
  assert(
    unavailableText.includes("Live inventory could not be verified"),
    `Homepage did not label failed catalog truth explicitly: ${unavailableText}`,
  );
  assert(
    unavailableText.includes("No stale prices or availability are being shown."),
    "Homepage failed state does not preserve the no-stale-commerce contract.",
  );
  assert(
    await page.getByTestId("button-retry-home-catalog").isVisible(),
    "Homepage failed catalog state is missing a retry action.",
  );
  const failedHomeText = await page.locator("body").innerText();
  assert(
    !failedHomeText.includes("Lawless Body Wave Bundles"),
    "Homepage showed prior catalog product data after the authoritative catalog read failed.",
  );
  await assertNoHorizontalOverflow(page, "mobile homepage unavailable state");
  await page.screenshot({
    path: `${outputDir}/home-mobile-catalog-unavailable.png`,
    fullPage: true,
  });

  assert(consoleErrors.length === 0, `Browser console errors: ${consoleErrors.join(" | ")}`);
  await writeFile(
    `${outputDir}/manifest.json`,
    `${JSON.stringify({
      expectedHead,
      verifiedAt: new Date().toISOString(),
      routes: ["/", "/#/about"],
      viewports: ["1440x1000", "390x844"],
      assertions: [
        "four brand pillars visible",
        "unsupported certainty absent",
        "Shopify-backed JBH product renders while Untold Stories catalog remains separate",
        "unusable Shopify catalog response renders an explicit unavailable state with no stale products",
        "failed Shopify catalog state keeps a real retry action",
        "desktop and mobile have no horizontal overflow",
        "mobile CTA remains visible",
        "browser console remains clean",
      ],
    }, null, 2)}\n`,
  );

  console.log(`Brand moat Playwright proof passed for ${expectedHead}.`);
} finally {
  await browser?.close();
  await stopServer();
}
