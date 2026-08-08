import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { chromium } from "playwright";

const host = "127.0.0.1";
const port = Number(process.env.PLAYWRIGHT_PORT || 4174);
const baseURL = `http://${host}:${port}`;
const expectedHead = process.env.EXPECTED_HEAD_SHA || "local-unpinned";
const outputDir = "artifacts/checkout-payment-truth";
const vitePath = fileURLToPath(
  new URL("../node_modules/vite/bin/vite.js", import.meta.url),
);
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

async function verifyMissingSession(page, label) {
  await page.addInitScript(
    ({ key, cart }) => {
      sessionStorage.setItem(key, JSON.stringify(cart));
    },
    { key: cartStorageKey, cart: seededCart },
  );

  await page.goto(`${baseURL}/#/success`, { waitUntil: "domcontentloaded" });
  await page.getByText("Payment not confirmed", { exact: true }).waitFor({
    state: "visible",
  });

  const bodyText = await page.locator("body").innerText();
  assert(!bodyText.includes("Order confirmed!"), `${label}: false order confirmation rendered.`);
  assert(
    !bodyText.includes("Stripe confirmed the payment."),
    `${label}: false Stripe-paid claim rendered.`,
  );

  const cart = await page.evaluate((key) => sessionStorage.getItem(key), cartStorageKey);
  assert(cart, `${label}: cart storage disappeared.`);
  const parsed = JSON.parse(cart);
  assert(Array.isArray(parsed) && parsed.length === 1, `${label}: cart was cleared without payment proof.`);
  assert(parsed[0]?.id === "bundle-bodywave", `${label}: seeded cart item changed unexpectedly.`);
}

let browser;
const consoleErrors = [];
try {
  await mkdir(outputDir, { recursive: true });
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  desktop.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`desktop: ${message.text()}`);
  });
  desktop.on("pageerror", (error) => consoleErrors.push(`desktop: ${error.message}`));
  await verifyMissingSession(desktop, "desktop");
  await desktop.screenshot({ path: `${outputDir}/missing-session-desktop.png`, fullPage: true });
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`mobile: ${message.text()}`);
  });
  mobile.on("pageerror", (error) => consoleErrors.push(`mobile: ${error.message}`));
  await verifyMissingSession(mobile, "mobile");
  await mobile.screenshot({ path: `${outputDir}/missing-session-mobile.png`, fullPage: true });
  await mobile.close();

  assert(consoleErrors.length === 0, `Browser console errors: ${consoleErrors.join(" | ")}`);

  await writeFile(
    `${outputDir}/manifest.json`,
    `${JSON.stringify(
      {
        expectedHead,
        verifiedAt: new Date().toISOString(),
        route: "/#/success",
        viewports: ["1440x1000", "390x844"],
        assertions: [
          "direct success navigation without a Checkout Session never renders paid confirmation",
          "direct success navigation preserves the existing cart",
          "desktop and mobile browser console remain clean",
        ],
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Checkout payment-truth Playwright proof passed for ${expectedHead}.`);
} finally {
  await browser?.close();
  await stopServer();
}
