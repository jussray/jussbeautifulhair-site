import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(
  new URL("../.github/workflows/shopify-headless-exact-head.yml", import.meta.url),
  "utf8",
);
const proof = workflow.split("  production-proof:")[1];

test("trusted production proof rejects missing Browser Run credentials before expensive install", () => {
  assert.ok(proof, "production-proof job must exist");
  const preflight = proof.indexOf("Verify Cloudflare Browser Run credential inputs");
  const nodeSetup = proof.indexOf("actions/setup-node@v4");
  const chromiumInstall = proof.indexOf("Install Chromium");
  const liveProof = proof.indexOf("Prove exact live SHA and branded front door");
  assert.ok(preflight >= 0, "required credential preflight is missing");
  assert.ok(preflight < nodeSetup && nodeSetup < chromiumInstall, "preflight must precede setup and Chromium");
  assert.ok(chromiumInstall < liveProof, "live proof must follow browser installation");
  assert.match(proof, /CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}/);
  assert.match(proof, /CLOUDFLARE_BROWSER_RUN_TOKEN: \$\{\{ secrets\.CLOUDFLARE_BROWSER_RUN_TOKEN \}\}/);
  assert.match(proof, /test -n "\$CLOUDFLARE_ACCOUNT_ID"/);
  assert.match(proof, /test -n "\$CLOUDFLARE_BROWSER_RUN_TOKEN"/);
});

test("production receipt cannot rely on GitHub runner-local Chromium after Cloudflare 403", () => {
  assert.doesNotMatch(proof, /JBH_PROOF_BROWSER_MODE=local/);
  assert.doesNotMatch(proof, /Cloudflare Browser Run secrets are absent; using.*local Chromium/);
  assert.match(proof, /JBH_PROOF_BROWSER_MODE: cloudflare-cdp/);
  assert.match(proof, /node scripts\/frontdoor-live-playwright\.mjs/);
  assert.match(proof, /Write canonical production receipt/);
});
