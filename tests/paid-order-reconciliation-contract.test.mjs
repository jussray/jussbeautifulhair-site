import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

test("Stripe line items carry canonical product reconciliation metadata", () => {
  assert.match(worker, /metadata:\s*\{\s*kind:\s*"product"/s);
  assert.match(worker, /product_id:\s*item\.id/);
  assert.match(worker, /variant:\s*item\.variant/);
  assert.match(worker, /metadata:\s*\{\s*kind:\s*"shipping"\s*\}/s);
});

test("checkout attempt identity is attached to the session and payment intent", () => {
  assert.match(worker, /client_reference_id:\s*reference/);
  assert.match(worker, /metadata:\s*\{\s*checkout_attempt_id:\s*reference\s*\}/s);
  assert.match(
    worker,
    /payment_intent_data:\s*\{\s*metadata:\s*\{\s*checkout_attempt_id:\s*reference\s*\}/s,
  );
});

test("the public Worker still resolves prices from the canonical catalog", () => {
  assert.match(worker, /const product = getProduct\(requested\.id\)/);
  assert.match(worker, /unit_amount:\s*Math\.round\(item\.price \* 100\)/);
  assert.doesNotMatch(worker, /requested\.price/);
});
