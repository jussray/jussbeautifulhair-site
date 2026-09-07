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

test("Founder Funnel readback is a separate exact-head lane after production commerce proof", () => {
  assert.match(readbackWorkflow, /^name: Founder Funnel Exact-Head Gate$/m);
  assert.match(readbackWorkflow, /^\s*push:\s*\n\s+branches: \[main\]/m);
  assert.match(readbackWorkflow, /checks: read/);
  assert.match(readbackWorkflow, /Verify tokenless Shopify checkout bridge/);
  assert.match(readbackWorkflow, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.match(readbackWorkflow, /secrets\.CLOUDFLARE_ACCOUNT_ID/);

  const productionWait = readbackWorkflow.indexOf("Wait for exact production Shopify proof");
  const readback = readbackWorkflow.indexOf("node scripts/verify-founder-funnel-readback.mjs");
  assert.ok(productionWait >= 0, "Exact production Shopify proof wait is missing.");
  assert.ok(readback > productionWait, "Analytics readback must run only after exact production commerce proof.");

  assert.doesNotMatch(readbackWorkflow, /wrangler[^\n]*deploy/i);
  assert.doesNotMatch(readbackWorkflow, /api-tokens|tokens\/permission|create token/i);
  assert.match(readbackWorkflow, /founder-funnel-readback-\$\{\{ env\.EXPECTED_HEAD_SHA \}\}/);
});
