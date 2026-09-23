import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { chromium } from "playwright";

// Browser proof that the three beauty-essential handles render the customer-safe
// placeholder (never the withheld label imagery or raw Shopify featuredImage) on
// Shop cards, PDP, and Cart, and that those surfaces keep the exact JBH card, PDP,
// and hover presentation used by healthy products in the same grid.
const host = "127.0.0.1";
const port = Number(process.env.PLAYWRIGHT_ESSENTIALS_PORT || 4176);
const baseURL = `http://${host}:${port}`;
const outputDir = "artifacts/beauty-essentials-images";
const vitePath = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const withheldAssetPattern = /edge-control|lace-melt-spray|hair-oil/;
let serverOutput = "";

const essential = (handle, id, option, price) => ({
  id: handle,
  shopifyProductId: `gid://shopify/Product/${id}`,
  name: `Raw Shopify title ${handle}`,
  category: "Beauty Essentials",
  tagline: "",
  description: "Raw Shopify description.",
  variants: [
    { id: `gid://shopify/ProductVariant/${id}1`, option, price, availableForSale: true },
  ],
  // Raw Shopify featuredImage must never reach the customer.
  image: `https://cdn.shopify.com/s/files/1/0845/7604/3251/files/${handle}-raw.jpg`,
  availableForSale: true,
});

const essentials = [
  { handle: "lawless-edge-control-4-oz", name: "Lawless Edge Control — 4 oz" },
  { handle: "lawless-lace-melt-spray", name: "Lawless Lace Melt Spray" },
  { handle: "lawless-hair-oil-rosemary-mint", name: "Lawless Hair Oil — Rosemary Mint" },
];

const bundle = (handle, id, option) => ({
  id: handle,
  shopifyProductId: `gid://shopify/Product/${id}`,
  name: `Raw Shopify title ${handle}`,
  category: "Bundles",
  tagline: "",
  description: "Raw Shopify description.",
  variants: [{ id: `gid://shopify/ProductVariant/${id}1`, option, price: 58.99, availableForSale: true }],
  image: "",
  availableForSale: true,
});

// Healthy JBH products are interleaved so every repaired card shares a grid row
// with an approved JBH card on both 4-column desktop and 2-column mobile grids.
const healthyHandles = [
  "body-wave-human-hair-bundles",
  "deep-wave-human-hair-bundles",
  "loose-wave-human-hair-bundles",
  "kinky-straight-human-hair-bundles",
];

const mockProducts = [
  bundle("body-wave-human-hair-bundles", "9719789060339", '16"'),
  essential("lawless-edge-control-4-oz", "9719789060401", "4 oz", 10),
  bundle("deep-wave-human-hair-bundles", "9719789060340", '14"'),
  essential("lawless-lace-melt-spray", "9719789060402", "2 oz", 15),
  bundle("loose-wave-human-hair-bundles", "9719789060341", '14"'),
  essential("lawless-hair-oil-rosemary-mint", "9719789060403", "2 oz", 18),
  bundle("kinky-straight-human-hair-bundles", "9719789060342", '14"'),
];

const server = spawn(process.execPath, [vitePath, "--host", host, "--port", String(port)], {
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
});
for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
}

async function waitForServer(timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (server.exitCode !== null) throw new Error(`Vite exited before verification.\n${serverOutput}`);
    try {
      if ((await fetch(baseURL)).ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${baseURL}.\n${serverOutput}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertNoHorizontalOverflow(page, label) {
  const { clientWidth, scrollWidth } = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert(scrollWidth <= clientWidth + 1, `${label} overflows horizontally: ${scrollWidth} > ${clientWidth}`);
}


// Geometry and computed style of a product card. Pixel dimensions are compared
// between cards in the same grid; styles must be identical.
async function cardSignature(page, handle) {
  return page.getByTestId(`card-product-${handle}`).evaluate((card) => {
    const media = card.firstElementChild;
    const body = card.lastElementChild;
    const title = body.querySelector("h3");
    const category = body.querySelector("p");
    const pick = (el, props) => {
      const style = getComputedStyle(el);
      return Object.fromEntries(props.map((prop) => [prop, style[prop]]));
    };
    const box = (el) => {
      const rect = el.getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    };
    return {
      rowTop: Math.round(card.getBoundingClientRect().top + window.scrollY),
      className: card.className,
      card: { ...box(card), ...pick(card, ["borderRadius", "borderTopWidth", "borderTopColor", "backgroundColor", "overflow", "transitionProperty"]) },
      media: { ...box(media), ...pick(media, ["aspectRatio", "backgroundColor", "overflow"]) },
      body: { ...box(body), ...pick(body, ["paddingTop", "paddingLeft"]) },
      title: pick(title, ["fontFamily", "fontSize", "lineHeight", "color", "minHeight"]),
      category: pick(category, ["fontSize", "letterSpacing", "textTransform", "color"]),
    };
  });
}

function assertSameSignature(label, repaired, healthy, context) {
  // Grid rows stretch cards to the tallest title in that row, so card height is
  // compared only against a same-row neighbour (see assertSameRowRhythm).
  const strip = ({ className, card, media, body, title, category }) => ({
    className,
    card: { ...card, height: undefined },
    media,
    body: { ...body, height: undefined },
    title,
    category,
  });
  const a = JSON.stringify(strip(repaired));
  const b = JSON.stringify(strip(healthy));
  assert(a === b, `${label}: ${context} diverges from healthy JBH card\nrepaired=${a}\nhealthy=${b}`);
  assert(repaired.media.width === repaired.media.height, `${label}: ${context} media is not square`);
}

function assertSameRowRhythm(label, handle, repaired, healthySignatures) {
  const neighbour = Object.entries(healthySignatures).find(
    ([, healthy]) => Math.abs(healthy.rowTop - repaired.rowTop) <= 1,
  );
  assert(neighbour, `${label}: ${handle} shares no grid row with a healthy JBH card`);
  assert(
    Math.abs(neighbour[1].card.height - repaired.card.height) <= 1,
    `${label}: ${handle} height ${repaired.card.height} != row neighbour ${neighbour[0]} ${neighbour[1].card.height}`,
  );
  return neighbour[0];
}

async function pdpSignature(page) {
  return page.evaluate(() => {
    const heading = document.querySelector('[data-testid="text-product-name"]');
    const grid = heading.closest(".grid");
    const media = grid.firstElementChild;
    const mediaInner = media.firstElementChild;
    const add = document.querySelector('[data-testid="button-add-to-cart"]');
    const box = (el) => {
      const rect = el.getBoundingClientRect();
      return { x: Math.round(rect.x), width: Math.round(rect.width), height: Math.round(rect.height) };
    };
    const pick = (el, props) => {
      const style = getComputedStyle(el);
      return Object.fromEntries(props.map((prop) => [prop, style[prop]]));
    };
    return {
      gridColumns: getComputedStyle(grid).gridTemplateColumns,
      media: { ...box(media), ...pick(media, ["borderRadius", "backgroundColor", "borderTopWidth"]) },
      mediaInner: { ...box(mediaInner), aspectRatio: getComputedStyle(mediaInner).aspectRatio },
      heading: { x: box(heading).x, ...pick(heading, ["fontFamily", "fontSize", "color"]) },
      addButton: add ? { ...pick(add, ["backgroundColor", "borderRadius", "fontFamily", "height"]) } : null,
    };
  });
}

async function runViewport(browser, label, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const evidence = {
    label,
    imageResponses: [],
    withheldRequests: [],
    abortedExternalRequests: [],
    consoleErrors: [],
  };

  page.on("console", (message) => {
    // Aborted off-host requests (fonts, analytics) surface as net::ERR_FAILED.
    if (message.type() === "error" && !/net::ERR_FAILED/.test(message.text())) {
      evidence.consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => evidence.consoleErrors.push(error.message));
  page.on("request", (request) => {
    if (withheldAssetPattern.test(request.url()) && request.resourceType() === "image") {
      evidence.withheldRequests.push(request.url());
    }
  });
  page.on("response", (response) => {
    if (response.request().resourceType() === "image") {
      evidence.imageResponses.push({ url: new URL(response.url()).pathname, status: response.status() });
    }
  });

  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    evidence.abortedExternalRequests.push(new URL(route.request().url()).host);
    return route.abort();
  });
  await page.route("**/api/funnel", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/shopify/catalog", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ products: mockProducts, source: "shopify-storefront" }),
    }),
  );

  // Collection entry: essentials show the placeholder; the approved bundle image loads.
  await page.goto(`${baseURL}/shop`, { waitUntil: "networkidle" });
  for (const { handle } of essentials) {
    const card = page.getByTestId(`card-product-${handle}`);
    await card.waitFor();
    assert((await card.locator("img").count()) === 0, `${label}: ${handle} card rendered an <img>`);
    assert(
      (await card.getByText("Product image updating").count()) === 1,
      `${label}: ${handle} card missing customer-safe placeholder`,
    );
  }
  const healthySignatures = {};
  for (const handle of healthyHandles) {
    const image = page.getByTestId(`card-product-${handle}`).locator("img");
    await image.scrollIntoViewIfNeeded();
    await image.evaluate((img) => (img.complete ? null : new Promise((r) => (img.onload = r))));
    const width = await image.evaluate((img) => img.naturalWidth);
    assert(width > 0, `${label}: healthy ${handle} image failed to load`);
    healthySignatures[handle] = await cardSignature(page, handle);
  }
  const reference = healthySignatures[healthyHandles[0]];
  for (const handle of healthyHandles) {
    assertSameSignature(label, healthySignatures[handle], reference, `healthy ${handle}`);
  }
  const repairedSignatures = {};
  for (const { handle } of essentials) {
    repairedSignatures[handle] = await cardSignature(page, handle);
    assertSameSignature(label, repairedSignatures[handle], reference, `repaired ${handle}`);
    repairedSignatures[handle].rowNeighbour = assertSameRowRhythm(
      label,
      handle,
      repairedSignatures[handle],
      healthySignatures,
    );
  }
  const naturalWidth = await page
    .getByTestId(`card-product-${healthyHandles[0]}`)
    .locator("img")
    .evaluate((img) => img.naturalWidth);
  await assertNoHorizontalOverflow(page, `${label} /shop`);
  // Scroll to top first so the sticky header is not composited over the hero.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${outputDir}/shop-${label}.png`, fullPage: true });

  // Hover: repaired cards lift exactly like healthy cards.
  if (label === "desktop") {
    for (const handle of [healthyHandles[0], essentials[0].handle]) {
      const card = page.getByTestId(`card-product-${handle}`);
      await card.hover();
      await page.waitForTimeout(400);
      const transform = await card.evaluate((el) => getComputedStyle(el).transform);
      assert(transform !== "none", `${label}: ${handle} card did not lift on hover`);
    }
    await page.getByTestId(`card-product-${essentials[0].handle}`).hover();
    await page.waitForTimeout(400);
    await page.getByTestId(`card-product-${essentials[0].handle}`).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${outputDir}/shop-hover-repaired-${label}.png` });
    await page.mouse.move(0, 0);
  }

  await page.getByTestId("filter-beauty-essentials").click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outputDir}/collection-beauty-essentials-${label}.png`, fullPage: true });

  // Healthy JBH PDP reference for structural parity.
  await page.goto(`${baseURL}/product/${healthyHandles[0]}`, { waitUntil: "networkidle" });
  const healthyPdp = await pdpSignature(page);
  await page.screenshot({ path: `${outputDir}/pdp-${healthyHandles[0]}-${label}.png` });

  // PDP → add to cart → cart thumbnail for every essential.
  for (const { handle, name } of essentials) {
    await page.goto(`${baseURL}/product/${handle}`, { waitUntil: "networkidle" });
    const heading = await page.getByTestId("text-product-name").innerText();
    assert(heading === name, `${label}: PDP name ${heading} !== ${name}`);
    assert((await page.getByTestId("img-product").count()) === 0, `${label}: ${handle} PDP rendered an image`);
    assert(
      (await page.getByText("Product image updating").count()) >= 1,
      `${label}: ${handle} PDP missing placeholder`,
    );
    await assertNoHorizontalOverflow(page, `${label} PDP ${handle}`);
    const repairedPdp = await pdpSignature(page);
    assert(
      JSON.stringify(repairedPdp) === JSON.stringify(healthyPdp),
      `${label}: ${handle} PDP structure diverges\nrepaired=${JSON.stringify(repairedPdp)}\nhealthy=${JSON.stringify(healthyPdp)}`,
    );
    await page.screenshot({ path: `${outputDir}/pdp-${handle}-${label}.png` });
    const addButton = page.getByTestId(label === "mobile" ? "button-add-to-cart-mobile" : "button-add-to-cart");
    await addButton.click();
  }

  await page.goto(`${baseURL}/cart`, { waitUntil: "networkidle" });
  for (const { handle, name } of essentials) {
    const row = page.getByTestId(`row-cart-${handle}`);
    await row.waitFor();
    assert((await row.locator("img").count()) === 0, `${label}: ${handle} cart row rendered an <img>`);
    assert((await row.getByText(name).count()) === 1, `${label}: cart row missing ${name}`);
  }
  await assertNoHorizontalOverflow(page, `${label} /cart`);
  await page.screenshot({ path: `${outputDir}/cart-${label}.png`, fullPage: true });

  assert(evidence.withheldRequests.length === 0, `${label}: withheld asset requested ${evidence.withheldRequests}`);
  assert(
    !evidence.imageResponses.some(({ url }) => url.includes("-raw.jpg")),
    `${label}: raw Shopify featuredImage was requested`,
  );
  const failedLocalImages = evidence.imageResponses.filter(({ status }) => status >= 400);
  assert(failedLocalImages.length === 0, `${label}: image loads failed ${JSON.stringify(failedLocalImages)}`);
  assert(evidence.consoleErrors.length === 0, `${label}: console errors ${evidence.consoleErrors}`);

  await context.close();
  return {
    ...evidence,
    approvedImageNaturalWidth: naturalWidth,
    healthyCardSignature: reference,
    repairedCardSignatures: repairedSignatures,
    healthyPdpSignature: healthyPdp,
  };
}

try {
  await mkdir(outputDir, { recursive: true });
  await waitForServer();
  const browser = await chromium.launch();
  const results = [];
  for (const [label, viewport] of [
    ["desktop", { width: 1440, height: 1100 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    results.push(await runViewport(browser, label, viewport));
  }
  await browser.close();
  await writeFile(
    `${outputDir}/evidence.json`,
    `${JSON.stringify({ recordedAt: new Date().toISOString(), baseURL, results }, null, 2)}\n`,
  );
  console.log("Beauty-essentials image proof passed on desktop and mobile.");
} finally {
  server.kill("SIGTERM");
}
