import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const script = await readFile(
  new URL("../scripts/verify-github-governance-readback.mjs", import.meta.url),
  "utf8",
);
const workflow = await readFile(
  new URL("../.github/workflows/github-governance-readback.yml", import.meta.url),
  "utf8",
);

test("governance readback is provider-read-only and non-authorizing", () => {
  assert.match(script, /github-provider-readback/);
  assert.match(script, /authority:\s*"non-authorizing"/);
  assert.match(script, /providerMutationPerformed:\s*false/);
  assert.match(script, /not-proven-by-this-gate/);
  assert.doesNotMatch(script, /fetch\([^\n]+method:\s*["'](?:POST|PUT|PATCH|DELETE)/i);
});

test("governance readback pins the approved minimum mechanical membrane", () => {
  assert.match(script, /const REQUIRED_CONTEXT = "Required Gate"/);
  assert.match(script, /const REQUIRED_INTEGRATION_ID = 15368/);
  assert.match(script, /pull_request/);
  assert.match(script, /required_status_checks/);
  assert.match(script, /strict_required_status_checks_policy/);
  assert.match(script, /required_approving_review_count/);
  assert.match(script, /deletion/);
  assert.match(script, /non_fast_forward/);
  assert.match(script, /foreignRequiredChecks/);
});

test("governance provider workflow is manual, read-only, exact-head aware, and retains a receipt", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s+push:/m);
  assert.doesNotMatch(workflow, /^\s+pull_request:/m);
  assert.match(workflow, /permissions:\n\s+contents:\s+read/);
  assert.match(workflow, /EXPECTED_HEAD_SHA:/);
  assert.match(workflow, /verify-github-governance-readback\.mjs/);
  assert.match(workflow, /github-governance-readback-\$\{\{ env\.EXPECTED_HEAD_SHA \}\}/);
  assert.match(workflow, /if:\s+always\(\)/);
});
