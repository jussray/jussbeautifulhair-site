import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const execFileAsync = promisify(execFile);
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const exists = async (relativePath) => {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
};
const isTrackedRepositoryPath = async (relativePath) => {
  try {
    const { stdout } = await execFileAsync("git", ["ls-files", "--", relativePath], {
      cwd: root,
      encoding: "utf8",
    });
    return stdout.trim().length > 0;
  } catch {
    return exists(relativePath);
  }
};

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
  const productIds = [...catalog.matchAll(/^\s+id:\s*"([^"]+)"/gm)].map(
    (match) => match[1],
  );
  assert.ok(productIds.length >= 10, "expected the public catalog to contain products");
  assert.equal(
    new Set(productIds).size,
    productIds.length,
    "catalog product IDs must be unique",
  );

  const numericPrices = [...catalog.matchAll(/price:\s*(\d+(?:\.\d+)?)/g)].map(
    (match) => Number(match[1]),
  );
  assert.ok(numericPrices.length > 0, "expected catalog prices");
  assert.ok(
    numericPrices.every((price) => Number.isFinite(price) && price > 0),
    "catalog prices must be positive",
  );
});

test("the only public Stripe SDK entry point uses the pinned API version", async () => {
  const worker = await read("worker/index.ts");
  assert.match(
    worker,
    new RegExp(
      `apiVersion:\\s*"${EXPECTED_STRIPE_API_VERSION.replaceAll(".", "\\.")}"`,
    ),
    `worker/index.ts must use ${EXPECTED_STRIPE_API_VERSION}`,
  );

  for (const forbiddenPath of [
    "api/checkout.ts",
    "api/stripe/webhook.ts",
    "api/orders/[id].ts",
    "vercel.json",
  ]) {
    assert.equal(
      await isTrackedRepositoryPath(forbiddenPath),
      false,
      `${forbiddenPath} must not restore an alternate public server surface`,
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

test("the public repository cannot regain an order webhook or numeric order lookup", async () => {
  const verifier = await read("scripts/verify-deployment-boundary.mjs");
  assert.match(verifier, /"api"/);
  assert.match(verifier, /"vercel\.json"/);
  assert.match(verifier, /"client\/src\/pages\/Confirmation\.tsx"/);
  assert.match(verifier, /order-by-numeric-id confirmation route/i);
  assert.match(verifier, /numeric order-lookup artifacts detected/i);
  assert.doesNotMatch(
    verifier,
    /console\.(?:log|error|warn)\([^\n]*(?:customer|address|email|phone|rawBody)/i,
  );
});

test("Cloudflare public preview surfaces stay disabled", async () => {
  const wrangler = await read("wrangler.toml");
  assert.match(wrangler, /^workers_dev\s*=\s*false\s*$/m);
  assert.match(wrangler, /^preview_urls\s*=\s*false\s*$/m);
  assert.match(wrangler, /^STORE_ORIGIN\s*=\s*"https:\/\/[^\"]+"\s*$/m);
});
