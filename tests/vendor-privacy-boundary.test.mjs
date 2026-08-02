import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const worker = await readFile("worker/index.ts", "utf8");

test("public checkout exposes only canonical product routing metadata", () => {
  assert.match(worker, /kind: \"product\"/);
  assert.match(worker, /product_id: item\.id/);
  assert.match(worker, /variant: item\.variant/);
  assert.match(worker, /metadata: \{ checkout_attempt_id: reference \}/);

  for (const forbidden of [
    "vendorId",
    "vendor_id",
    "vendorCode",
    "vendor_name",
    "supplier",
    "wholesale",
    "unitCost",
    "margin",
    "fulfillmentEmail",
    "DATABASE_URL",
    "jbh-private",
  ]) {
    assert.doesNotMatch(worker, new RegExp(forbidden, "i"));
  }
});

test("public worker does not provide vendor or fulfillment endpoints", () => {
  assert.doesNotMatch(worker, /\/api\/(vendor|vendors|supplier|fulfillment|routing)/i);
  assert.match(worker, /if \(url\.pathname\.startsWith\(\"\/api\/\"\)\)/);
  assert.match(worker, /return json\(\{ error: \"Not found\" \}, 404\)/);
});
