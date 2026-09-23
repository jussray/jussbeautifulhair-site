import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [worker, liveSmoke] = await Promise.all([
  read("worker/index.ts"),
  read("scripts/shopify-physical-live-smoke.mjs"),
]);

test("production catalog follows Shopify cursors instead of assuming one vendor page", () => {
  assert.match(worker, /catalogPageSize:\s*25/);
  assert.match(worker, /catalogMaxPages:\s*10/);
  assert.match(worker, /\$after:\s*String/);
  assert.match(worker, /products\(first:\s*\$first,\s*after:\s*\$after/);
  assert.match(worker, /async function fetchCompleteShopifyCatalog/);
  assert.match(worker, /after:\s*cursor/);
  assert.match(worker, /pageInfo\.hasNextPage/);
  assert.match(worker, /pageInfo\.endCursor/);
  assert.match(worker, /nextCursor === cursor/);
  assert.match(worker, /SHOPIFY_CATALOG_CURSOR_INVALID/);
  assert.match(worker, /SHOPIFY_CATALOG_PAGE_LIMIT/);
});

test("live no-payment proof traverses the same bounded vendor catalog", () => {
  assert.match(liveSmoke, /catalogPageSize = 25/);
  assert.match(liveSmoke, /catalogMaxPages = 10/);
  assert.match(liveSmoke, /\$after:\s*String/);
  assert.match(liveSmoke, /async function fetchCompleteCatalog/);
  assert.match(liveSmoke, /after:\s*cursor/);
  assert.match(liveSmoke, /catalogPageCount/);
  assert.match(liveSmoke, /supplierProductCount/);
  assert.doesNotMatch(
    liveSmoke,
    /Production catalog page size is no longer sufficient for the JBH vendor boundary/,
  );
});
