import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// This is the Cloudflare-account-owned route for the existing production Worker.
// It is not a second storefront, redirect, WAF exception, or authorization token.
export const WORKER_RUNTIME_ORIGIN = "https://jussbeautifulhair-site.mcgill-raylene.workers.dev";
export const BRANDED_ORIGIN = "https://jussbeautifulhair.com";
export const REPORT_PATH = "artifacts/free-plan-runtime/manifest.json";
const SHA = /^[0-9a-f]{40}$/i;
const RAY = /^[0-9a-f]{16}(?:-[a-z0-9]+)?$/i;

export function classifyBrandedResponse(response, payload, expectedSha) {
  if (response.ok) {
    assert.equal(payload?.ok, true, "Branded version must return ok=true.");
    assert.equal(payload?.sha, expectedSha, "Branded version must match current main SHA.");
    return { state: "VERSION_VERIFIED", rayId: null };
  }
  const headers = response.headers;
  const mitigated = headers.get("cf-mitigated");
  const rayId = headers.get("cf-ray");
  assert.equal(response.status, 403, `Unexpected branded version HTTP ${response.status}.`);
  assert.equal(headers.get("server")?.toLowerCase(), "cloudflare");
  assert.equal(mitigated, "challenge", "Only a known Cloudflare challenge can defer the branded browser witness.");
  assert.match(rayId || "", RAY, "Branded challenge is missing a valid Cloudflare Ray ID.");
  return { state: "CLOUDFLARE_CHALLENGED", rayId };
}

function validateVersion(payload, expectedSha) {
  assert.equal(payload?.ok, true, "Worker runtime /version must return ok=true.");
  assert.equal(payload?.sha, expectedSha, "Live Worker runtime must match current main SHA.");
  assert.ok(
    payload?.identitySource === "runtime-binding" || payload?.identitySource === "asset-build-proof",
    "Worker runtime SHA must have a declared source.",
  );
  assert.equal(payload?.evidenceRole, "identity-observation");
  assert.equal(payload?.authority, "none");
}

export async function checkFreePlanRuntime(expectedSha, request = fetch) {
  assert.match(expectedSha || "", SHA, "Expected current main full 40-character SHA.");

  // Probe the branded front door, preserving the actual challenge as evidence.
  const branded = await request(`${BRANDED_ORIGIN}/version`, {
    headers: { accept: "application/json" },
    redirect: "manual",
    cache: "no-store",
  });
  const brandedPayload = branded.ok ? await branded.json() : null;
  const brand = classifyBrandedResponse(branded, brandedPayload, expectedSha);

  // Independently prove the already-deployed Worker, avoiding the zone's Bot Fight Mode.
  // Do not claim this is evidence that the branded customer-facing hostname renders.
  const worker = await request(`${WORKER_RUNTIME_ORIGIN}/version`, {
    headers: { accept: "application/json" },
    redirect: "manual",
    cache: "no-store",
  });
  assert.equal(worker.status, 200, `Workers.dev runtime /version returned HTTP ${worker.status}.`);
  assert.ok(
    (worker.headers.get("content-type") || "").toLowerCase().includes("application/json"),
    "Workers.dev runtime returned a non-JSON response.",
  );
  const payload = await worker.json();
  validateVersion(payload, expectedSha);

  return {
    schema: "jbh/free-plan-runtime-witness@v1",
    observedAt: new Date().toISOString(),
    expectedMainSha: expectedSha,
    brandedOrigin: BRANDED_ORIGIN,
    brandVersionState: brand.state,
    cloudflareRayId: brand.rayId,
    workerRuntimeOrigin: WORKER_RUNTIME_ORIGIN,
    workerRuntimeSha: payload.sha,
    workerRuntimeIdentitySource: payload.identitySource,
    workerRuntimeVerified: true,
    brandedVersionVerified: brand.state === "VERSION_VERIFIED",
    brandedBrowserVerified: false,
    purchaseVerified: false,
    productionReleaseVerified: false,
    authority: "none",
    evidenceRole: "candidate-readiness-only",
    assertions: [
      "Worker runtime SHA matches the exact current main SHA",
      "Worker runtime explicitly reports identity observation without authorization",
      "Branded URL is either version-matched or explicitly challenged by Cloudflare",
      "No WAF setting, DNS, checkout, payment, or customer data was changed",
      "No production release or branded browser receipt may be inferred from this probe",
    ],
  };
}

export async function runFreePlanProof(env = process.env, request = fetch) {
  const report = await checkFreePlanRuntime(env.EXPECTED_HEAD_SHA || "", request);
  await mkdir("artifacts/free-plan-runtime", { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    state: report.brandVersionState,
    workerRuntimeVerified: report.workerRuntimeVerified,
    brandedBrowserVerified: report.brandedBrowserVerified,
    productionReleaseVerified: report.productionReleaseVerified,
  }));
  return report;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await runFreePlanProof();
}
