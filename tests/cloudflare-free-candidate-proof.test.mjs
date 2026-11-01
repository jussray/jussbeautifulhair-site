import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  checkFreePlanRuntime,
  BRANDED_ORIGIN,
  WORKER_RUNTIME_ORIGIN,
} from "../scripts/cloudflare-free-candidate-proof.mjs";

const sha = "a".repeat(40);
const version = {
  ok: true,
  sha,
  identitySource: "asset-build-proof",
  evidenceRole: "identity-observation",
  authority: "none",
};
const asJson = (body = version) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { "content-type": "application/json" },
});
const challenge = (headers = {}) => new Response("security challenge", {
  status: 403,
  headers: {
    server: "cloudflare",
    "cf-mitigated": "challenge",
    "cf-ray": "a4c6d92cdb61f273-IAD",
    ...headers,
  },
});
function fetchScenario(brand, worker = asJson()) {
  const hits = [];
  const request = async (url, options) => {
    hits.push({ url, options });
    if (url === `${BRANDED_ORIGIN}/version`) return brand;
    if (url === `${WORKER_RUNTIME_ORIGIN}/version`) return worker;
    throw new Error(`Unexpected probe URL ${url}`);
  };
  return { request, hits };
}

test("Cloudflare Free bot challenge yields partial runtime evidence, never a production pass", async () => {
  const { request, hits } = fetchScenario(challenge());
  const result = await checkFreePlanRuntime(sha, request);
  assert.equal(result.brandVersionState, "CLOUDFLARE_CHALLENGED");
  assert.equal(result.workerRuntimeVerified, true);
  assert.equal(result.brandedVersionVerified, false);
  assert.equal(result.brandedBrowserVerified, false);
  assert.equal(result.productionReleaseVerified, false);
  assert.equal(result.purchaseVerified, false);
  assert.equal(result.cloudflareRayId, "a4c6d92cdb61f273-IAD");
  assert.equal(hits.length, 2);
  for (const hit of hits) {
    assert.equal(hit.options.redirect, "manual");
    assert.equal(hit.options.cache, "no-store");
  }
});

test("reachable branded /version still never claims full browser/commerce production proof", async () => {
  const { request } = fetchScenario(asJson());
  const result = await checkFreePlanRuntime(sha, request);
  assert.equal(result.brandVersionState, "VERSION_VERIFIED");
  assert.equal(result.brandedVersionVerified, true);
  assert.equal(result.productionReleaseVerified, false);
});

test("unattributed 403 cannot be waved away as Bot Fight Mode", async () => {
  const { request } = fetchScenario(challenge({ "cf-mitigated": "not-a-challenge" }));
  await assert.rejects(checkFreePlanRuntime(sha, request), /known Cloudflare challenge/);
});

test("unexpected error codes and redirects fail closed", async () => {
  for (const status of [301, 404, 500]) {
    const { request } = fetchScenario(new Response("", { status }));
    await assert.rejects(checkFreePlanRuntime(sha, request), /Unexpected branded version HTTP/);
  }
});

test("cannot use unproven runtime, mismatched SHA, or alternate alias", async () => {
  const { request } = fetchScenario(challenge(), asJson({ ...version, sha: "b".repeat(40) }));
  await assert.rejects(checkFreePlanRuntime(sha, request), /match current main SHA/);
  await assert.rejects(checkFreePlanRuntime("short", fetchScenario(asJson()).request), /40-character SHA/);
  const wrong = fetchScenario(challenge(), new Response("unavailable", { status: 404 }));
  await assert.rejects(checkFreePlanRuntime(sha, wrong.request), /Workers.dev runtime/);
});

test("retired diagnostic cannot replace candidate isolation or trusted production browser proof", async () => {
  const workflow = await readFile(".github/workflows/shopify-headless-exact-head.yml", "utf8");
  assert.doesNotMatch(workflow, /\bnode\s+scripts\/cloudflare-free-candidate-proof\.mjs\b/);
  assert.doesNotMatch(workflow, /steps\.free-plan\.outputs|id: live-base/);
  const candidateBoundary = workflow.split("      - name: Record candidate-only evidence boundary")[1]
    ?.split("      - name: Wait for exact Cloudflare Worker build")[0];
  assert.ok(candidateBoundary, "Candidate proof must retain its explicit source/local boundary.");
  assert.match(candidateBoundary, /if: github\.event_name == 'pull_request'/);
  assert.match(candidateBoundary, /Candidate checks are source\/local proofs only/);
  assert.doesNotMatch(candidateBoundary, /secrets\.|shopify-production-playwright|frontdoor-live-playwright/);
  assert.match(workflow, /if: github\.event_name == 'push'/);
  assert.match(workflow, /node scripts\/frontdoor-live-playwright\.mjs/);
  assert.match(workflow, /node scripts\/shopify-production-playwright\.mjs/);
  assert.match(workflow, /JBH_PROOF_BROWSER_MODE: cloudflare-cdp/);
  assert.match(workflow, /secrets\.CLOUDFLARE_BROWSER_RUN_TOKEN/);
  assert.match(workflow, /schema: 'juss\/jbh-production-evidence-receipt@v2'/);
  assert.match(workflow, /live_state: 'verified'/);
  assert.doesNotMatch(workflow, /artifacts\/free-plan-runtime\//);
});
