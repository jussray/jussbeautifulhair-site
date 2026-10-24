import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import process from "node:process";

const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
const apiToken = (process.env.CLOUDFLARE_API_TOKEN || "").trim();
const expectedHead = (process.env.EXPECTED_HEAD_SHA || "").trim().toLowerCase();
const baseURL = process.env.LIVE_STOREFRONT_URL || "https://jussbeautifulhair.com";
const expectedOrigin = "https://jussbeautifulhair.com";
const outputDir = "artifacts/cloudflare-browser-production";

assert.match(accountId, /^[0-9a-f]{32}$/i, "CLOUDFLARE_ACCOUNT_ID must be a 32-character account ID.");
assert.ok(apiToken, "CLOUDFLARE_API_TOKEN is required for provider-owned browser proof.");
assert.match(expectedHead, /^[0-9a-f]{40}$/i, "EXPECTED_HEAD_SHA must be an exact 40-character commit SHA.");
assert.equal(new URL(baseURL).origin, expectedOrigin, `LIVE_STOREFRONT_URL must be exactly ${expectedOrigin}.`);

function namesFromTree(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (typeof node.name === "string" && node.name.trim()) out.push(node.name.trim());
  if (Array.isArray(node.children)) {
    for (const child of node.children) namesFromTree(child, out);
  }
  return out;
}

async function browserTree(url, waitForTimeout = 1200) {
  const endpoint = new URL(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/accessibilityTree`,
  );
  endpoint.searchParams.set("cacheTTL", "0");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      viewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
      gotoOptions: { waitUntil: "networkidle0", timeout: 60000 },
      waitForTimeout,
      actionTimeout: 60000,
      bestAttempt: true,
    }),
  });

  const body = await response.text();
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error(
      `Cloudflare Browser Rendering returned non-JSON for ${url}: HTTP ${response.status}; body=${JSON.stringify(body.slice(0, 160))}`,
    );
  }

  assert.equal(
    response.ok,
    true,
    `Cloudflare Browser Rendering returned HTTP ${response.status} for ${url}: ${JSON.stringify(payload.errors || payload)}`,
  );
  assert.equal(payload.success, true, `Cloudflare Browser Rendering did not report success for ${url}.`);

  const tree = payload.result?.accessibilityTree ?? payload.result?.result?.accessibilityTree;
  const meta = payload.meta ?? payload.result?.meta ?? {};
  assert.ok(tree, `Cloudflare Browser Rendering returned no accessibility tree for ${url}.`);
  return { tree, meta, names: namesFromTree(tree) };
}

function parseVersionObservation(observation) {
  const candidates = observation.names
    .map((name) => name.trim())
    .filter((name) => name.startsWith("{") && name.endsWith("}"));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && "ok" in parsed && "sha" in parsed) return parsed;
    } catch {
      // Ignore unrelated JSON-looking accessibility text.
    }
  }
  throw new Error("Runtime /version JSON was not observable through Cloudflare Browser Rendering.");
}

await mkdir(outputDir, { recursive: true });

const versionObservation = await browserTree(`${baseURL}/version`, 300);
assert.equal(versionObservation.meta.status, 200, `runtime /version returned HTTP ${versionObservation.meta.status ?? "unknown"}.`);
const version = parseVersionObservation(versionObservation);
assert.equal(version.ok, true, "runtime /version did not report ok=true.");
assert.equal(
  String(version.sha || "").toLowerCase(),
  expectedHead,
  `runtime SHA mismatch: expected ${expectedHead}, observed ${version.sha || "missing"}.`,
);
assert.ok(
  version.identitySource === "runtime-binding" || version.identitySource === "asset-build-proof",
  `runtime identity source is not evidence-bound: ${version.identitySource || "missing"}.`,
);
assert.equal(version.evidenceRole, "identity-observation", "runtime identity must remain observation evidence.");
assert.equal(version.authority, "none", "runtime identity observation must not claim authority.");

const home = await browserTree(baseURL, 1500);
assert.equal(home.meta.status, 200, `production storefront returned HTTP ${home.meta.status ?? "unknown"}.`);
assert.match(home.meta.title || "", /Juss Beautiful Hair/i, "production storefront title is missing.");
assert.ok(home.names.some((name) => /Shop Now/i.test(name)), "production storefront is missing the Shop Now action.");
assert.ok(home.names.some((name) => /Hair Match/i.test(name)), "production storefront is missing Hair Match.");

const shop = await browserTree(`${baseURL}/shop`, 1800);
assert.equal(shop.meta.status, 200, `production shop returned HTTP ${shop.meta.status ?? "unknown"}.`);
assert.ok(shop.names.some((name) => /All Products/i.test(name)), "production shop did not render All Products.");
assert.ok(
  shop.names.some((name) => /Live hair and beauty inventory/i.test(name)),
  "production shop did not render its live-inventory statement.",
);

const manifest = {
  schema: "juss/jbh-cloudflare-browser-production-proof@v1",
  verifiedAt: new Date().toISOString(),
  expectedHead,
  observedHead: String(version.sha).toLowerCase(),
  origin: expectedOrigin,
  provider: "cloudflare-browser-rendering",
  runtimeIdentity: {
    source: version.identitySource,
    evidenceRole: version.evidenceRole,
    authority: version.authority,
  },
  observations: {
    versionStatus: versionObservation.meta.status,
    homeStatus: home.meta.status,
    homeTitle: home.meta.title || "",
    shopStatus: shop.meta.status,
    shopTitle: shop.meta.title || "",
  },
  assertions: [
    "Cloudflare Browser Rendering observed the exact production runtime SHA",
    "the production root rendered the branded storefront and primary shopping actions",
    "the production shop rendered the customer-facing catalog surface",
    "runtime identity remained observation evidence with no authority claim",
    "no order or payment was submitted",
  ],
};

await writeFile(
  `${outputDir}/manifest.json`,
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(
  `Cloudflare production browser proof passed for ${expectedHead}; no order or payment submitted.`,
);
