import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
const temp = await mkdtemp(path.join(root, ".stripe-runtime-test-"));
let worker;
try {
  const workerSource = await readFile(path.join(root, "worker/index.ts"), "utf8");
  const catalogSource = await readFile(path.join(root, "shared/catalog.ts"), "utf8");
  assert.match(workerSource, /from "\.\.\/shared\/catalog"/);
  const transpile = (source) => ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiled = transpile(workerSource.replace(
    'from "../shared/catalog"',
    'from "./catalog.mjs"',
  ));
  await writeFile(path.join(temp, "catalog.mjs"), transpile(catalogSource));
  const outfile = path.join(temp, "worker.mjs");
  await writeFile(outfile, compiled);
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
    STRIPE_CHECKOUT_MODE: "test",
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

test("test/live Stripe key modes must match and missing mode fails closed", async () => {
  const body = JSON.stringify({
    checkoutAttemptId: "6c11b5b4-05d5-4a9b-84ff-43836ecf8d41",
    items: [{ id: "bundle-bodywave", variant: '14"', quantity: 1 }],
  });
  for (const [key, mode] of [
    ["sk_live_fake_not_a_provider_key", "test"],
    ["sk_test_fake_not_a_provider_key", "live"],
    ["sk_test_fake_not_a_provider_key", undefined],
    ["sk_live_fake_not_a_provider_key", undefined],
  ]) {
    const response = await worker.fetch(
      request("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base },
        body,
      }),
      {
        ...env,
        STRIPE_SECRET_KEY: key,
        STRIPE_CHECKOUT_MODE: mode,
        STRIPE_APPROVED_VARIANTS: JSON.stringify({ "bundle-bodywave": ['14"'] }),
      },
    );
    assert.equal(response.status, 503);
    const result = await response.json();
    assert.equal(result.error, "Payment mode is not approved");
  }
});
