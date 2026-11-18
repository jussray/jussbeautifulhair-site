import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const temp = await mkdtemp(path.join(root, ".stripe-runtime-test-"));
let worker;
try {
  const outfile = path.join(temp, "worker.mjs");
  await build({
    entryPoints: [path.join(root, "worker/index.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    outfile,
    logLevel: "silent",
    target: "node24",
  });
  worker = (await import(pathToFileURL(outfile).href)).default;
} finally {
  await rm(temp, { recursive: true, force: true });
}

const base = "https://jussbeautifulhair.com";
const env = { ASSETS: { fetch: async () => new Response("assets") }, STORE_ORIGIN: base };
const request = (route, init) => new Request(base + route, init);

test("Stripe catalog fails closed without explicit approved inventory", async () => {
  for (const approvals of [
    undefined,
    "",
    "{invalid",
    "{}",
    JSON.stringify({ "unknown-product": ['14"'] }),
    JSON.stringify({ "bundle-bodywave": ['99"'] }),
  ]) {
    const response = await worker.fetch(
      request("/api/stripe/catalog"),
      { ...env, STRIPE_APPROVED_VARIANTS: approvals },
    );
    assert.equal(response.status, 503);
  }
});

test("Stripe catalog returns only explicitly approved canonical variants and prices", async () => {
  const response = await worker.fetch(
    request("/api/stripe/catalog"),
    { ...env, STRIPE_APPROVED_VARIANTS: JSON.stringify({ "bundle-bodywave": ['14"'] }) },
  );
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.source, "jbh-approved-stripe-catalog");
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].variants.length, 1);
  assert.equal(result.products[0].variants[0].id, "jbh:bundle-bodywave:0");
  assert.equal(result.products[0].variants[0].price, 75);
});

test("Stripe Checkout refuses unapproved items even with payment credentials", async () => {
  const configured = {
    ...env,
    STRIPE_SECRET_KEY: "sk_test_fake_not_a_provider_key",
    STRIPE_APPROVED_VARIANTS: JSON.stringify({ "bundle-bodywave": ['14"'] }),
  };
  const checkoutAttemptId = "6c11b5b4-05d5-4a9b-84ff-43836ecf8d41";
  for (const item of [
    { id: "bundle-bodywave", variant: '16"', quantity: 1 },
    { id: "unknown-product", variant: '14"', quantity: 1 },
  ]) {
    const response = await worker.fetch(
      request("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify({ checkoutAttemptId, items: [item] }),
      }),
      configured,
    );
    assert.equal(response.status, 400);
  }
});
