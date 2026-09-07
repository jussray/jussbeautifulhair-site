import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workerEntry = await readFile(
  new URL("../worker/entry.ts", import.meta.url),
  "utf8",
);
const readbackScript = await readFile(
  new URL("../scripts/verify-founder-funnel-readback.mjs", import.meta.url),
  "utf8",
);
const readbackWorkflow = await readFile(
  new URL("../.github/workflows/founder-funnel-exact-head.yml", import.meta.url),
  "utf8",
);

test("Founder Funnel datapoints are stamped by the Worker with exact release identity", () => {
  assert.match(
    workerEntry,
    /const releaseSha = explicitReleaseSha\(env\) \|\| await buildProofReleaseSha\(request, env\) \|\| "unknown";/,
  );
  assert.match(
    workerEntry,
    /blobs:\s*\[\s*payload\.event,[\s\S]*trafficClass,\s*releaseSha,\s*\]/,
  );
  assert.doesNotMatch(workerEntry, /decoded\.releaseSha|payload\.releaseSha/);
});

test("Analytics Engine readback requires proof traffic from the exact release SHA", () => {
  assert.match(readbackScript, /const DATASET = "jbh_funnel_v1"/);
  assert.match(readbackScript, /EXPECTED_HEAD_SHA/);
  assert.match(readbackScript, /EXACT_SHA = \/\^\[0-9a-f\]\{40\}\$\/i/);
  assert.match(readbackScript, /SUM\(_sample_interval\) AS observations/);
  assert.match(readbackScript, /AND index1 = '\$\{FUNNEL_INDEX\}'/);
  assert.match(readbackScript, /AND blob5 = 'proof'/);
  assert.match(readbackScript, /AND blob6 = '\$\{expectedHead\}'/);
  for (const event of ["product_view", "add_to_cart", "checkout_start", "shopify_handoff"]) {
    assert.match(readbackScript, new RegExp(`"${event}"`));
  }
  assert.match(readbackScript, /analytics_engine\/sql/);
  assert.match(readbackScript, /Authorization: `Bearer \$\{apiToken\}`/);
  assert.match(readbackScript, /Account Analytics Read/);
  assert.match(readbackScript, /contract: "jbh-founder-funnel-readback-v1"/);
});

test("Founder Funnel source verification remains secretless while production readback uses the Production environment", () => {
  assert.match(readbackWorkflow, /^name: Founder Funnel Exact-Head Gate$/m);
  assert.match(readbackWorkflow, /^\s*push:\s*\n\s+branches: \[main\]/m);
  assert.match(readbackWorkflow, /checks: read/);

  const sourceJob = readbackWorkflow.indexOf("  verify:\n");
  const productionJob = readbackWorkflow.indexOf("  production-readback:\n");
  assert.ok(sourceJob >= 0, "Secretless source verification job is missing.");
  assert.ok(productionJob > sourceJob, "Push-only production readback job is missing.");

  const sourceSection = readbackWorkflow.slice(sourceJob, productionJob);
  const productionSection = readbackWorkflow.slice(productionJob);

  assert.match(sourceSection, /name: Verify Founder Funnel exact-release readback/);
  assert.match(sourceSection, /node --test tests\/founder-funnel-readback-contract\.test\.mjs/);
  assert.doesNotMatch(sourceSection, /environment:\s*Production/);
  assert.doesNotMatch(sourceSection, /secrets\.CLOUDFLARE_/);

  assert.match(productionSection, /if: github\.event_name == 'push'/);
  assert.match(productionSection, /needs: verify/);
  assert.match(productionSection, /environment:\s*Production/);
  assert.match(productionSection, /Verify tokenless Shopify checkout bridge/);
  assert.match(productionSection, /Verify production Cloudflare credentials are present/);
  assert.match(productionSection, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.match(productionSection, /secrets\.CLOUDFLARE_ACCOUNT_ID/);

  const productionWait = productionSection.indexOf("Wait for exact production Shopify proof");
  const credentialPreflight = productionSection.indexOf("Verify production Cloudflare credentials are present");
  const readback = productionSection.indexOf("node scripts/verify-founder-funnel-readback.mjs");
  assert.ok(productionWait >= 0, "Exact production Shopify proof wait is missing.");
  assert.ok(credentialPreflight > productionWait, "Production credential preflight must follow commerce proof.");
  assert.ok(readback > credentialPreflight, "Analytics readback must run only after credential preflight.");

  assert.doesNotMatch(readbackWorkflow, /wrangler[^\n]*deploy/i);
  assert.doesNotMatch(readbackWorkflow, /api-tokens|tokens\/permission|create token/i);
  assert.match(readbackWorkflow, /founder-funnel-readback-\$\{\{ env\.EXPECTED_HEAD_SHA \}\}/);
});
