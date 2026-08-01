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
let serverOutput = "";

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
  const desktopText = await page.locator("body").innerText();
  for (const riskyClaim of ["Quality Guaranteed", "never tangles", "lasts 2+ years", "factory pricing"]) {
    assert(!desktopText.includes(riskyClaim), `Unsupported certainty is still public: ${riskyClaim}`);
  }
  assert(desktopText.includes("Royal Raw Indian Temple Bundle"), "Existing signature product disappeared.");
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
        "hair and Untold Stories catalogs remain separate",
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
