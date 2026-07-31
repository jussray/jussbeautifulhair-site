import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { access, readFile, writeFile } from "node:fs/promises";

const MANIFEST_PATH = ".control-room/repository.manifest.json";
const EXPECTED_SCHEMA = "1.0";
const EXPECTED_PROJECT = "juss-beautiful-hair";
const EXPECTED_REPOSITORY = "jussray/jussbeautifulhair-site";
const EXPECTED_SIGNAL_NAME = "Verify current-main storefront contract";
const ALLOWED_STATUSES = new Set(["active", "planned", "retired"]);

function fail(errors, message) {
  errors.push(message);
}

function currentCommit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function currentBranch() {
  if (process.env.GITHUB_HEAD_REF) return process.env.GITHUB_HEAD_REF;
  if (process.env.GITHUB_REF_NAME) return process.env.GITHUB_REF_NAME;
  try {
    return execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim() || "unknown";
  } catch {
    return "unknown";
  }
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const rawManifest = await readFile(MANIFEST_PATH, "utf8");
const manifestHash = createHash("sha256").update(rawManifest).digest("hex");
let manifest;
const errors = [];

try {
  manifest = JSON.parse(rawManifest);
} catch (error) {
  console.error(`Control Room manifest is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

if (manifest.schemaVersion !== EXPECTED_SCHEMA) {
  fail(errors, `schemaVersion must be ${EXPECTED_SCHEMA}`);
}
if (manifest.projectId !== EXPECTED_PROJECT) {
  fail(errors, `projectId must be ${EXPECTED_PROJECT}`);
}
if (manifest.repository?.provider !== "github") {
  fail(errors, "repository.provider must be github");
}
if (manifest.repository?.identifier !== EXPECTED_REPOSITORY) {
  fail(errors, `repository.identifier must be ${EXPECTED_REPOSITORY}`);
}
if (manifest.repository?.defaultBranch !== "main") {
  fail(errors, "repository.defaultBranch must be main");
}

const requiredSignals = manifest.verification?.requiredSignals;
if (!Array.isArray(requiredSignals) || requiredSignals.length === 0) {
  fail(errors, "verification.requiredSignals must contain at least one signal");
}

const signalIds = new Set();
let hasExpectedSignal = false;
for (const signal of Array.isArray(requiredSignals) ? requiredSignals : []) {
  if (!signal?.id || !signal?.name) {
    fail(errors, "each required signal must include id and name");
    continue;
  }
  if (signalIds.has(signal.id)) fail(errors, `duplicate signal id: ${signal.id}`);
  signalIds.add(signal.id);
  if (signal.name === EXPECTED_SIGNAL_NAME && signal.required === true) {
    hasExpectedSignal = true;
  }
}
if (!hasExpectedSignal) {
  fail(errors, `required signal must include exact provider check name: ${EXPECTED_SIGNAL_NAME}`);
}

const capabilityIds = new Set();
const observations = [];
for (const capability of Array.isArray(manifest.capabilities) ? manifest.capabilities : []) {
  const capabilityErrors = [];
  if (!capability?.id || !capability?.description) {
    fail(capabilityErrors, "capability must include id and description");
  }
  if (capabilityIds.has(capability.id)) fail(capabilityErrors, `duplicate capability id: ${capability.id}`);
  capabilityIds.add(capability.id);
  if (!ALLOWED_STATUSES.has(capability.status)) {
    fail(capabilityErrors, `unsupported status: ${capability.status}`);
  }

  const evidencePaths = Array.isArray(capability.evidencePaths) ? capability.evidencePaths : [];
  const requiredSignalIds = Array.isArray(capability.requiredSignals) ? capability.requiredSignals : [];
  const assertions = Array.isArray(capability.usageAssertions) ? capability.usageAssertions : [];
  const missingEvidencePaths = [];
  const failedUsageAssertionIds = [];

  if (capability.status === "active") {
    if (evidencePaths.length === 0) fail(capabilityErrors, "active capability has no evidence paths");
    if (requiredSignalIds.length === 0) fail(capabilityErrors, "active capability has no required signal");
    if (assertions.length === 0) fail(capabilityErrors, "active capability has no usage assertions");
  }

  for (const signalId of requiredSignalIds) {
    if (!signalIds.has(signalId)) fail(capabilityErrors, `unknown required signal: ${signalId}`);
  }

  for (const path of evidencePaths) {
    if (!(await fileExists(path))) missingEvidencePaths.push(path);
  }

  const assertionIds = new Set();
  for (const assertion of assertions) {
    if (!assertion?.id || !assertion?.path || typeof assertion?.marker !== "string" || !assertion.marker) {
      fail(capabilityErrors, "usage assertion must include id, path, and a non-empty marker");
      continue;
    }
    if (assertionIds.has(assertion.id)) fail(capabilityErrors, `duplicate usage assertion id: ${assertion.id}`);
    assertionIds.add(assertion.id);

    if (!(await fileExists(assertion.path))) {
      failedUsageAssertionIds.push(assertion.id);
      continue;
    }
    const source = await readFile(assertion.path, "utf8");
    if (!source.includes(assertion.marker)) failedUsageAssertionIds.push(assertion.id);
  }

  if (missingEvidencePaths.length > 0) {
    fail(capabilityErrors, `missing evidence paths: ${missingEvidencePaths.join(", ")}`);
  }
  if (failedUsageAssertionIds.length > 0) {
    fail(capabilityErrors, `failed usage assertions: ${failedUsageAssertionIds.join(", ")}`);
  }

  const observedStatus =
    capability.status === "retired"
      ? "retired"
      : capability.status === "planned"
        ? "unverified"
        : capabilityErrors.length === 0
          ? "verified"
          : "drifted";

  observations.push({
    id: capability.id,
    claimedStatus: capability.status,
    observedStatus,
    evidencePaths,
    usageAssertionIds: assertions.map((assertion) => assertion.id).filter(Boolean),
    failedUsageAssertionIds,
    reason: capabilityErrors.length > 0 ? capabilityErrors.join("; ") : undefined,
  });

  for (const error of capabilityErrors) fail(errors, `${capability.id}: ${error}`);
}

if (!Array.isArray(manifest.capabilities) || manifest.capabilities.length === 0) {
  fail(errors, "capabilities must not be empty");
}
if (!Array.isArray(manifest.privacy?.allowlistedPacketFields) || manifest.privacy.allowlistedPacketFields.length === 0) {
  fail(errors, "privacy.allowlistedPacketFields must not be empty");
}
if (!Array.isArray(manifest.privacy?.forbiddenData) || manifest.privacy.forbiddenData.length === 0) {
  fail(errors, "privacy.forbiddenData must not be empty");
}

const passed = errors.length === 0;
const packet = {
  schemaVersion: EXPECTED_SCHEMA,
  projectId: manifest.projectId,
  repository: {
    provider: manifest.repository?.provider,
    identifier: manifest.repository?.identifier,
  },
  commitSha: currentCommit(),
  branch: currentBranch(),
  manifestHash,
  generatedAt: new Date().toISOString(),
  runner: {
    provider: process.env.GITHUB_ACTIONS === "true" ? "github-actions" : "local",
    ...(process.env.GITHUB_RUN_ID ? { runId: process.env.GITHUB_RUN_ID } : {}),
    ...(process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? { detailsUrl: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` }
      : {}),
  },
  checks: [
    {
      id: "current-main-storefront-contract",
      name: EXPECTED_SIGNAL_NAME,
      required: true,
      status: passed ? "passed" : "failed",
    },
  ],
  capabilities: observations,
};

if (process.env.CONTROL_ROOM_REPORT_PATH) {
  await writeFile(process.env.CONTROL_ROOM_REPORT_PATH, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
}

if (!passed) {
  console.error("Control Room manifest verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Control Room manifest verified: ${observations.filter((item) => item.observedStatus === "verified").length} active capabilities verified; ${observations.filter((item) => item.claimedStatus === "planned").length} planned capabilities held unverified.`);
