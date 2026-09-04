import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const entry = await readFile(new URL("../worker/entry.ts", import.meta.url), "utf8");
const receiptWriter = await readFile(
  new URL("../scripts/write-public-build-receipt.mjs", import.meta.url),
  "utf8",
);

test("automatic Cloudflare build identity is available to the runtime version route", () => {
  assert.match(receiptWriter, /WORKERS_CI_COMMIT_SHA/);
  assert.match(receiptWriter, /jbh-public-build-proof-v1/);
  assert.match(entry, /PUBLIC_BUILD_PROOF_PATH = "\/\.well-known\/jbh-build-proof\.json"/);
  assert.match(entry, /env\.ASSETS\.fetch/);
  assert.match(entry, /proof\.contract !== "jbh-public-build-proof-v1"/);
  assert.match(entry, /proof\.publicSafe !== true/);
  assert.match(entry, /proof\.sourceCommitSha/);
  assert.match(entry, /pathname === VERSION_PATH/);
  assert.match(entry, /explicitReleaseSha\(env\) \|\| await buildProofReleaseSha\(request, env\) \|\| "unknown"/);
});
