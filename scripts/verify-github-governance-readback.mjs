import { mkdir, writeFile } from "node:fs/promises";

const OUTPUT_DIR = "artifacts/github-governance-readback";
const DEFAULT_BRANCH = "main";
const REQUIRED_CONTEXT = "Required Gate";
const REQUIRED_INTEGRATION_ID = 15368;

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for GitHub governance readback.`);
  return value;
}

function ruleOfType(rules, type) {
  return rules.find((rule) => rule?.type === type) || null;
}

async function writeReceipt(receipt) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    `${OUTPUT_DIR}/receipt.json`,
    `${JSON.stringify(receipt, null, 2)}\n`,
    "utf8",
  );
}

const repository = requiredEnv("GITHUB_REPOSITORY");
const apiUrl = (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, "");
const targetBranch = (process.env.TARGET_BRANCH || DEFAULT_BRANCH).trim();
const token = (process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "").trim();
const expectedHead = (process.env.EXPECTED_HEAD_SHA || "").trim().toLowerCase();

if (expectedHead && !/^[0-9a-f]{40}$/.test(expectedHead)) {
  throw new Error("EXPECTED_HEAD_SHA must be a full 40-character commit SHA when supplied.");
}

async function githubGet(path) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2026-03-10",
    "User-Agent": "jbh-governance-readback",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${apiUrl}${path}`, { headers });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const error = new Error(`GitHub API ${path} failed with HTTP ${response.status}.`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

const encodedBranch = encodeURIComponent(targetBranch);
const branch = await githubGet(`/repos/${repository}/branches/${encodedBranch}`);
const activeRules = await githubGet(`/repos/${repository}/rules/branches/${encodedBranch}`);

const pullRequestRule = ruleOfType(activeRules, "pull_request");
const statusRule = ruleOfType(activeRules, "required_status_checks");
const deletionRule = ruleOfType(activeRules, "deletion");
const nonFastForwardRule = ruleOfType(activeRules, "non_fast_forward");

const statusParameters = statusRule?.parameters || {};
const requiredChecks = Array.isArray(statusParameters.required_status_checks)
  ? statusParameters.required_status_checks
  : [];
const exactRequiredGate = requiredChecks.filter(
  (check) =>
    check?.context === REQUIRED_CONTEXT &&
    Number(check?.integration_id) === REQUIRED_INTEGRATION_ID,
);
const foreignRequiredChecks = requiredChecks.filter(
  (check) =>
    check?.context !== REQUIRED_CONTEXT ||
    Number(check?.integration_id) !== REQUIRED_INTEGRATION_ID,
);

const pullRequestParameters = pullRequestRule?.parameters || {};
const requiredApprovals = Number(pullRequestParameters.required_approving_review_count || 0);

const checks = {
  branchProtected: branch?.protected === true,
  pullRequestRequired: Boolean(pullRequestRule),
  zeroHumanApprovalDeadlock: requiredApprovals === 0,
  requiredGatePresent: exactRequiredGate.length === 1,
  noUnexpectedRequiredChecks: foreignRequiredChecks.length === 0 && requiredChecks.length === 1,
  strictRequiredChecks: statusParameters.strict_required_status_checks_policy === true,
  deletionBlocked: Boolean(deletionRule),
  forcePushBlocked: Boolean(nonFastForwardRule),
};

const mechanicalSatisfied = Object.values(checks).every(Boolean);
const observedHead = String(branch?.commit?.sha || "").toLowerCase();
const exactHeadMatched = !expectedHead || observedHead === expectedHead;
const verified = mechanicalSatisfied && exactHeadMatched;

const receipt = {
  contract: "jbh-github-governance-readback-v1",
  repository,
  targetBranch,
  expectedHead: expectedHead || null,
  observedHead: observedHead || null,
  verifiedAt: new Date().toISOString(),
  source: "github-provider-readback",
  authority: "non-authorizing",
  providerMutationPerformed: false,
  expectedRequiredCheck: {
    context: REQUIRED_CONTEXT,
    integrationId: REQUIRED_INTEGRATION_ID,
  },
  checks,
  activeRuleTypes: activeRules.map((rule) => rule?.type).filter(Boolean).sort(),
  requiredChecks,
  exactHeadMatched,
  mechanicalSatisfied,
  bypassProof: "not-proven-by-this-gate",
  fullProviderMembraneVerified: false,
  status: verified ? "mechanical-provider-policy-verified" : "provider-policy-unsatisfied",
};

await writeReceipt(receipt);
console.log(JSON.stringify(receipt));

if (!verified) {
  throw new Error(
    "GitHub governance readback is not satisfied. This verifier is read-only and does not create or weaken provider policy.",
  );
}
