import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const activationWorkflow = await readFile(
  new URL("../.github/workflows/frontdoor-activate.yml", import.meta.url),
  "utf8",
);
const mainShopifyWorkflow = await readFile(
  new URL("../.github/workflows/shopify-headless-exact-head.yml", import.meta.url),
  "utf8",
);
const frontdoorConfig = await readFile(
  new URL("../wrangler.frontdoor.toml", import.meta.url),
  "utf8",
);
const livePlaywright = await readFile(
  new URL("../scripts/frontdoor-live-playwright.mjs", import.meta.url),
  "utf8",
);
const shopifyProductionPlaywright = await readFile(
  new URL("../scripts/shopify-production-playwright.mjs", import.meta.url),
  "utf8",
);
const worker = await readFile(
  new URL("../worker/index.ts", import.meta.url),
  "utf8",
);
const workerEntry = await readFile(
  new URL("../worker/entry.ts", import.meta.url),
  "utf8",
);
const metaAgentKnowledge = JSON.parse(
  await readFile(
    new URL("../client/public/.well-known/jbh-meta-agent.json", import.meta.url),
    "utf8",
  ),
);

test("front-door production activation remains manual, founder-approved, and exact-head gated", () => {
  assert.match(activationWorkflow, /^on:\s*\n\s+workflow_dispatch:/m);
  assert.doesNotMatch(activationWorkflow, /^\s+(?:push|pull_request|schedule):/m);
  assert.match(activationWorkflow, /environment:\s*Production/);
  assert.match(activationWorkflow, /expected_main_sha:/);
  assert.match(activationWorkflow, /confirm_domain:/);
  assert.match(activationWorkflow, /confirm_action:/);
  assert.match(activationWorkflow, /test \"\$GITHUB_ACTOR\" = \"jussray\"/);
  assert.match(activationWorkflow, /test \"\$GITHUB_REF\" = \"refs\/heads\/main\"/);
  assert.match(activationWorkflow, /test \"\$GITHUB_SHA\" = \"\$actual\"/);
  assert.match(activationWorkflow, /test \"\$EXPECTED_HEAD_SHA\" = \"\$actual\"/);
  assert.match(activationWorkflow, /test \"\$CONFIRM_DOMAIN\" = \"jussbeautifulhair\.com\"/);
  assert.match(activationWorkflow, /test \"\$CONFIRM_ACTION\" = \"activate-frontdoor\"/);
});

test("front-door activation requires Cloudflare credentials and proxied root DNS", () => {
  assert.match(activationWorkflow, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.match(activationWorkflow, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
  assert.match(activationWorkflow, /dns_records/);
  assert.match(
    activationWorkflow,
    /select\(\.name == \"jussbeautifulhair\.com\" and \.proxied == true\)/,
  );
  assert.match(activationWorkflow, /test \"\$proxied_count\" -ge 1/);
});

test("first activation refuses an existing JBH Worker route", () => {
  assert.match(activationWorkflow, /workers\/routes/);
  assert.match(
    activationWorkflow,
    /select\(\.pattern \| contains\(\"jussbeautifulhair\.com\"\)\)/,
  );
  assert.match(activationWorkflow, /test \"\$conflicting_routes\" -eq 0/);
});

test("Wrangler activation is pinned, dry-run first, and uses only the front-door config", () => {
  assert.match(activationWorkflow, /WRANGLER_VERSION: 4\.114\.0/);
  assert.match(activationWorkflow, /--var RELEASE_SHA:\$\{EXPECTED_HEAD_SHA\}/);
  const dryRunIndex = activationWorkflow.indexOf(
    "deploy --config wrangler.frontdoor.toml --var RELEASE_SHA:${EXPECTED_HEAD_SHA} --dry-run",
  );
  const activationIndex = activationWorkflow.indexOf(
    "deploy --config wrangler.frontdoor.toml --var RELEASE_SHA:${EXPECTED_HEAD_SHA}\n",
  );
  assert.ok(dryRunIndex >= 0, "Pinned front-door dry run is missing.");
  assert.ok(activationIndex > dryRunIndex, "Live activation must occur only after the dry run.");
  assert.doesNotMatch(activationWorkflow, /wrangler@(?:latest|next)/i);
  assert.doesNotMatch(activationWorkflow, /--temporary\b/i);
});

test("post-deploy route identity is exact and failed proof removes only that route", () => {
  assert.match(
    activationWorkflow,
    /select\(\.pattern == \"jussbeautifulhair\.com\/\*\" and \.script == \"jussbeautifulhair-site\"\)/,
  );
  assert.match(activationWorkflow, /test \"\$route_count\" -eq 1/);
  assert.match(
    activationWorkflow,
    /if: failure\(\) && steps\.activate_route\.outcome == 'success'/,
  );
  assert.match(activationWorkflow, /curl[^\n]*--fail-with-body[\s\S]*-X DELETE/);
  assert.match(
    activationWorkflow,
    /workers\/routes\/\$route_id/,
  );
});

test("live Playwright proof binds to the branded origin and rejects Shopify password wall", () => {
  assert.match(livePlaywright, /https:\/\/jussbeautifulhair\.com/);
  assert.match(livePlaywright, /\/version/);
  assert.match(livePlaywright, /versionPayload\.sha === expectedHead/);
  assert.match(livePlaywright, /x-frame-options/);
  assert.match(livePlaywright, /content-signal/);
  assert.match(livePlaywright, /enter store using password/);
  assert.match(livePlaywright, /this store is password protected/);
  assert.match(livePlaywright, /opening soon/);
  assert.match(livePlaywright, /\"shipping\", \"returns\", \"privacy\", \"terms\"/);
  assert.match(livePlaywright, /Juss Beautiful Hair/);
  assert.match(livePlaywright, /knowledgeContentType/);
  assert.match(livePlaywright, /application\/json/);
  assert.match(livePlaywright, /returned non-JSON content/);
  assert.match(activationWorkflow, /node scripts\/frontdoor-live-playwright\.mjs/);
});

test("Shopify production proof is exact-deploy bound and stops before payment", () => {
  const frontdoorProofIndex = activationWorkflow.indexOf("node scripts/frontdoor-live-playwright.mjs");
  const shopifyProofIndex = activationWorkflow.indexOf("node scripts/shopify-production-playwright.mjs");
  const rollbackIndex = activationWorkflow.indexOf("Remove newly-created route if post-activation proof fails");

  assert.ok(frontdoorProofIndex >= 0, "Front-door live proof is missing.");
  assert.ok(shopifyProofIndex > frontdoorProofIndex, "Shopify production proof must run after exact front-door proof.");
  assert.ok(rollbackIndex > shopifyProofIndex, "Shopify proof must remain inside the post-activation rollback boundary.");
  assert.match(activationWorkflow, /artifacts\/shopify-production\//);

  assert.match(shopifyProductionPlaywright, /EXPECTED_HEAD_SHA/);
  assert.match(shopifyProductionPlaywright, /\/version/);
  assert.match(shopifyProductionPlaywright, /versionPayload\?\.sha,\s*expectedHead/);
  assert.match(shopifyProductionPlaywright, /\/api\/shopify\/catalog/);
  assert.match(shopifyProductionPlaywright, /\/api\/shopify\/cart/);
  assert.match(shopifyProductionPlaywright, /card-product-\$\{product\.id\}/);
  assert.match(shopifyProductionPlaywright, /button-place-order/);
  assert.match(shopifyProductionPlaywright, /merchandiseId: variant\.id, quantity: 1/);
  assert.match(shopifyProductionPlaywright, /no order or payment was submitted/);
});

test("main commerce gate waits for the exact Worker build and emits verified only after live Playwright", () => {
  assert.match(mainShopifyWorkflow, /^\s*push:\s*\n\s+branches: \[main\]/m);
  assert.match(mainShopifyWorkflow, /checks: read/);
  assert.match(mainShopifyWorkflow, /Workers Builds: jussbeautifulhair-site/);
  const providerIndex = mainShopifyWorkflow.indexOf("Wait for exact Cloudflare Worker build");
  const frontdoorIndex = mainShopifyWorkflow.indexOf("node scripts/frontdoor-live-playwright.mjs");
  const productionIndex = mainShopifyWorkflow.indexOf("node scripts/shopify-production-playwright.mjs");
  const receiptIndex = mainShopifyWorkflow.indexOf("Write canonical production receipt");
  assert.ok(providerIndex >= 0, "Exact Worker-build wait is missing.");
  assert.ok(frontdoorIndex > providerIndex, "Live front-door Playwright must follow exact provider build proof.");
  assert.ok(productionIndex > frontdoorIndex, "Production Shopify Playwright must follow live SHA proof.");
  assert.ok(receiptIndex > productionIndex, "Verified receipt must be emitted only after both live browser gates.");
  assert.match(mainShopifyWorkflow, /live_state: 'verified'/);
  assert.match(mainShopifyWorkflow, /https:\/\/jussbeautifulhair\.com\/version/);
  assert.doesNotMatch(mainShopifyWorkflow, /wrangler[^\n]*deploy/i);
});

test("front-door Wrangler config remains one route for the branded root", () => {
  const routeBlocks = frontdoorConfig.match(/^\s*\[\[routes\]\]\s*$/gm) ?? [];
  assert.equal(routeBlocks.length, 1);
  assert.match(frontdoorConfig, /^pattern\s*=\s*\"jussbeautifulhair\.com\/\*\"\s*$/m);
  assert.match(frontdoorConfig, /^zone_name\s*=\s*\"jussbeautifulhair\.com\"\s*$/m);
  assert.match(
    frontdoorConfig,
    /run_worker_first\s*=\s*\[\s*\"\/api\/\*\"\s*,\s*\"\/version\"\s*,\s*\"\/\.well-known\/jbh-meta-agent\.json\"\s*\]/,
  );
  assert.doesNotMatch(frontdoorConfig, /custom_domain\s*=\s*true/i);
});

test("Meta Business Agent knowledge endpoint is explicit Worker-routed JSON", () => {
  assert.equal(metaAgentKnowledge.schema, "jbh-meta-business-agent@v1");
  assert.equal(metaAgentKnowledge.brand, "Juss Beautiful Hair");
  assert.match(workerEntry, /import metaAgentKnowledge from \"\.\.\/client\/public\/\.well-known\/jbh-meta-agent\.json\"/);
  assert.match(workerEntry, /META_AGENT_KNOWLEDGE_PATH = \"\/\.well-known\/jbh-meta-agent\.json\"/);
  assert.match(workerEntry, /pathname === META_AGENT_KNOWLEDGE_PATH/);
  assert.match(workerEntry, /\"Content-Type\": \"application\/json; charset=utf-8\"/);
  assert.match(workerEntry, /JSON\.stringify\(metaAgentKnowledge\)/);
});

test("Worker version route reads the explicit release binding", () => {
  assert.match(worker, /url\.pathname === \"\/version\"/);
  assert.match(worker, /function getReleaseSha\(env: Env\)/);
  assert.match(worker, /sha: getReleaseSha\(env\)/);
});
