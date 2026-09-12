import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const localManifest = await readJson("control-room.manifest.json");
const providerGates = await readJson(".control-room/provider-gates.json");
const frontdoorWorkflow = await readFile(".github/workflows/frontdoor-activate.yml", "utf8");

test("Control Room exports Shopify-first commerce truth without promoting stale Stripe proof", () => {
  const sourceOfTruth = localManifest.authority?.sourceOfTruth ?? "";

  assert.match(sourceOfTruth, /Shopify Storefront Cart plus Shopify-hosted checkout/);
  assert.doesNotMatch(sourceOfTruth, /Stripe redirect behavior/);
  assert.equal(localManifest.authority?.providerGates, ".control-room/provider-gates.json");
  assert.equal(localManifest.evidence?.status, "historical-source-contract");
  assert.equal(localManifest.evidence?.currentHeadReacquireRequired, true);
  assert.ok(localManifest.controlRoom?.surfaces?.includes(".github/workflows/frontdoor-activate.yml"));
  assert.ok(localManifest.controlRoom?.surfaces?.includes("wrangler.frontdoor.toml"));
});

test("provider gates remain non-authorizing and externally evidenced", () => {
  assert.equal(providerGates.projectId, "juss-beautiful-hair");
  assert.equal(providerGates.repository, "jussray/jussbeautifulhair-site");
  assert.equal(providerGates.truthBoundary?.sourceMaySelfPromoteProviderGate, false);
  assert.equal(providerGates.truthBoundary?.currentHeadMustBeReacquiredBeforeExecution, true);
  assert.equal(providerGates.truthBoundary?.continuityMarkersAuthorize, false);

  const gates = new Map(providerGates.gates.map((gate) => [gate.id, gate]));
  const frontdoor = gates.get("branded-frontdoor-provider-activation");
  const governance = gates.get("github-main-provider-governance");

  assert.ok(frontdoor, "front-door provider gate must remain represented");
  assert.equal(frontdoor.portfolioStatus, "unverified");
  assert.equal(frontdoor.authority, "external-provider-evidence");

  assert.ok(governance, "GitHub provider governance gate must remain represented");
  assert.equal(governance.portfolioStatus, "unsatisfied");
  assert.equal(governance.authority, "github-provider-readback");

  assert.equal(providerGates.proofCookie?.authorizes, false);
});

test("front-door carrier remains exact-head, browser-proved, and fail-closed", () => {
  assert.match(frontdoorWorkflow, /workflow_dispatch:/);
  assert.match(frontdoorWorkflow, /expected_main_sha:/);
  assert.match(frontdoorWorkflow, /test \"\$EXPECTED_HEAD_SHA\" = \"\$actual\"/);
  assert.match(frontdoorWorkflow, /node scripts\/frontdoor-live-playwright\.mjs/);
  assert.match(frontdoorWorkflow, /node scripts\/shopify-production-playwright\.mjs/);
  assert.match(frontdoorWorkflow, /Remove newly-created route if post-activation proof fails/);
  assert.match(frontdoorWorkflow, /if: failure\(\) && steps\.activate_route\.outcome == 'success'/);
});
