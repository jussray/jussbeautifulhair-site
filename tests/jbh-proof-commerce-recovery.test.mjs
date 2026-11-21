import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const base = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, base), "utf8");

const [wrangler, metadataText, playwright, workflow] = await Promise.all([
  read("wrangler.toml"),
  read("client/public/.well-known/jbh-meta-agent.json"),
  read("scripts/frontdoor-live-playwright.mjs"),
  read(".github/workflows/shopify-headless-exact-head.yml"),
]);
const metadata = JSON.parse(metadataText);

test("public shopping knowledge points to the configured JussPay catalog, not disabled Shopify", () => {
  assert.match(wrangler, /^JBH_COMMERCE_PROVIDER = "jusspay"$/m);
  assert.match(wrangler, /^JBH_JUSSPAY_LIVE_ENABLED = "false"$/m);
  assert.equal(metadata.catalog.url, "https://jussbeautifulhair.com/api/commerce/catalog");
  assert.equal(metadata.catalog.provider, "jusspay");
  assert.match(metadata.catalog.availabilityRule, /unavailable/i);
  assert.doesNotMatch(metadata.catalog.authority, /Shopify/i);
  assert.match(playwright, /knowledge\.catalog\?\.url === `\$\{baseURL\}\/api\/commerce\/catalog`/);
});

test("production browser proof rejects absent credentials before expensive browser setup", () => {
  const block = workflow.split("  production-proof:")[1];
  assert.ok(block, "trusted production proof job must exist");
  const preflight = block.indexOf("Verify Cloudflare Browser Run credential inputs");
  const install = block.indexOf("Install pinned browser verifier");
  const liveProof = block.indexOf("Prove exact live SHA and branded front door");
  assert.ok(preflight >= 0 && preflight < install, "credential preflight must run before Chromium installation");
  assert.ok(install < liveProof, "trusted browser evidence must still run after browser setup");
  assert.match(block, /CLOUDFLARE_BROWSER_RUN_TOKEN: \$\{\{ secrets\.CLOUDFLARE_BROWSER_RUN_TOKEN \}\}/);
  assert.match(block, /CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}/);
  assert.match(block, /test -n "\$CLOUDFLARE_BROWSER_RUN_TOKEN"/);
  assert.match(block, /test -n "\$CLOUDFLARE_ACCOUNT_ID"/);
  assert.match(block, /node scripts\/frontdoor-live-playwright\.mjs/);
});
