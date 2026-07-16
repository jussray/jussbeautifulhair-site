import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");

const EXPECTED_STRIPE_API_VERSION = "2025-02-24.acacia";

test("client and Worker use the shared catalog without escaping the repository", async () => {
  const [bridge, worker] = await Promise.all([
    read("client/src/lib/catalog.ts"),
    read("worker/index.ts"),
  ]);

  assert.match(bridge, /export \* from "\.\.\/\.\.\/\.\.\/shared\/catalog";/);
  assert.doesNotMatch(bridge, /\.\.\/\.\.\/\.\.\/\.\.\/shared\/catalog/);
  assert.match(worker, /from "\.\.\/shared\/catalog"/);
  assert.doesNotMatch(worker, /client\/src\/lib\/catalog/);
});

test("catalog product identifiers are present and unique", async () => {
  const catalog = await read("shared/catalog.ts");
  const productIds = [...catalog.matchAll(/^\s+id:\s*"([^"]+)"/gm)].map((match) => match[1]);
  assert.ok(productIds.length >= 10, "expected the public catalog to contain products");
  assert.equal(new Set(productIds).size, productIds.length, "catalog product IDs must be unique");

  const numericPrices = [...catalog.matchAll(/price:\s*(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1]));
  assert.ok(numericPrices.length > 0, "expected catalog prices");
  assert.ok(numericPrices.every((price) => Number.isFinite(price) && price > 0), "catalog prices must be positive");
});

test("Stripe SDK API version is consistent across server entry points", async () => {
  const files = ["api/checkout.ts", "api/stripe/webhook.ts", "worker/index.ts"];
  for (const relativePath of files) {
    const text = await read(relativePath);
    assert.match(
      text,
      new RegExp(`apiVersion:\\s*"${EXPECTED_STRIPE_API_VERSION.replaceAll(".", "\\.")}"`),
      `${relativePath} must use ${EXPECTED_STRIPE_API_VERSION}`,
    );
  }
});

test("checkout pricing remains server authoritative", async () => {
  const worker = await read("worker/index.ts");
  const schemaStart = worker.indexOf("const checkoutSchema");
  const schemaEnd = worker.indexOf("function json");
  assert.ok(schemaStart >= 0 && schemaEnd > schemaStart, "checkout schema must be present");

  const schema = worker.slice(schemaStart, schemaEnd);
  assert.match(schema, /id:\s*z\.string/);
  assert.match(schema, /variant:\s*z\.string/);
  assert.match(schema, /quantity:\s*z\.number/);
  assert.doesNotMatch(schema, /\bprice\b|\bcurrency\b|\btotal\b/);

  assert.match(worker, /getProduct\(requested\.id\)/);
  assert.match(worker, /candidate\.option === requested\.variant/);
  assert.match(worker, /unit_amount:\s*Math\.round\(item\.price \* 100\)/);
  assert.match(worker, /idempotencyKey:\s*`jbh-checkout-\$\{reference\}`/);
});

test("webhook verifier uses the raw request body and does not log it", async () => {
  const webhook = await read("api/stripe/webhook.ts");
  assert.match(webhook, /bodyParser:\s*false/);
  assert.match(webhook, /const rawBody = await readRawBody\(req\)/);
  assert.match(webhook, /stripe\.webhooks\.constructEvent\([\s\S]*rawBody[\s\S]*signature[\s\S]*STRIPE_WEBHOOK_SECRET/);
  assert.doesNotMatch(webhook, /console\.(?:log|error|warn)\([^\n]*rawBody/);
  assert.doesNotMatch(webhook, /console\.(?:log|error|warn)\([^\n]*STRIPE_WEBHOOK_SECRET/);
});

test("Cloudflare public preview surfaces stay disabled", async () => {
  const wrangler = await read("wrangler.toml");
  assert.match(wrangler, /^workers_dev\s*=\s*false\s*$/m);
  assert.match(wrangler, /^preview_urls\s*=\s*false\s*$/m);
  assert.match(wrangler, /^STORE_ORIGIN\s*=\s*"https:\/\/[^\"]+"\s*$/m);
});
