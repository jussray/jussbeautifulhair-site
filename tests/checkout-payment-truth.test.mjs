import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function read(relativePath) {
  return readFile(path.join(process.cwd(), ...relativePath.split("/")), "utf8");
}

test("Worker verifies a returned Checkout Session with Stripe and store-owned metadata", async () => {
  const worker = await read("worker/index.ts");

  assert.match(worker, /checkout\.sessions\.retrieve\(/);
  assert.match(worker, /client_reference_id/);
  assert.match(worker, /metadata\?\.checkout_attempt_id/);
  assert.match(worker, /session\.status === "complete"/);
  assert.match(worker, /session\.payment_status === "paid"/);
  assert.match(worker, /CHECKOUT_SESSION_ROUTE_PREFIX/);
});

test("success UI gates confirmation and cart clearing behind paid verification", async () => {
  const success = await read("client/src/pages/success.tsx");
  const verificationIndex = success.indexOf("isPaidCheckoutVerification(body)");
  const clearIndex = success.indexOf("clear();");

  assert.ok(verificationIndex >= 0, "paid verification guard must exist");
  assert.ok(clearIndex > verificationIndex, "cart clear must occur after paid verification");
  assert.match(success, /Payment not confirmed/);
  assert.match(success, /Your cart\s+has not been cleared/);
});
