import { mkdir, writeFile } from "node:fs/promises";

const DATASET = "jbh_funnel_v1";
const FUNNEL_INDEX = "jbh";
const REQUIRED_EVENTS = [
  "product_view",
  "add_to_cart",
  "checkout_start",
  "shopify_handoff",
];
const EXACT_SHA = /^[0-9a-f]{40}$/i;
const ACCOUNT_ID = /^[0-9a-f]{32}$/i;
const MAX_ATTEMPTS = 20;
const RETRY_DELAY_MS = 2_000;
const OUTPUT_DIR = "artifacts/founder-funnel-readback";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Founder Funnel readback.`);
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeRows(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.data)) return [];
  return payload.data;
}

const expectedHead = requiredEnv("EXPECTED_HEAD_SHA").toLowerCase();
if (!EXACT_SHA.test(expectedHead)) {
  throw new Error("EXPECTED_HEAD_SHA must be an exact 40-character commit SHA.");
}

const accountId = requiredEnv("CLOUDFLARE_ACCOUNT_ID");
if (!ACCOUNT_ID.test(accountId)) {
  throw new Error("CLOUDFLARE_ACCOUNT_ID must be a 32-character hexadecimal account ID.");
}

const apiToken = requiredEnv("CLOUDFLARE_API_TOKEN");
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`;
const eventList = REQUIRED_EVENTS.map((event) => `'${event}'`).join(", ");
const query = `
SELECT
  blob1 AS event,
  SUM(_sample_interval) AS observations
FROM ${DATASET}
WHERE timestamp > NOW() - INTERVAL '30' MINUTE
  AND index1 = '${FUNNEL_INDEX}'
  AND blob5 = 'proof'
  AND blob6 = '${expectedHead}'
  AND blob1 IN (${eventList})
GROUP BY event
ORDER BY event
FORMAT JSON`;

let lastObserved = {};

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "text/plain; charset=utf-8",
    },
    body: query,
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Cloudflare Analytics Engine readback is unauthorized. The CI token must have Account Analytics Read for the JBH account.",
      );
    }

    if (attempt === MAX_ATTEMPTS) {
      throw new Error(`Cloudflare Analytics Engine SQL failed with HTTP ${response.status}.`);
    }

    await response.text().catch(() => "");
    await sleep(RETRY_DELAY_MS);
    continue;
  }

  const payload = await response.json();
  const rows = normalizeRows(payload);
  lastObserved = Object.fromEntries(
    rows
      .filter((row) => row && typeof row.event === "string")
      .map((row) => [row.event, Number(row.observations) || 0]),
  );

  const missing = REQUIRED_EVENTS.filter((event) => (lastObserved[event] || 0) < 1);
  if (missing.length === 0) {
    const receipt = {
      contract: "jbh-founder-funnel-readback-v1",
      dataset: DATASET,
      expectedHead,
      trafficClass: "proof",
      verifiedAt: new Date().toISOString(),
      source: "cloudflare-analytics-engine-sql",
      observed: lastObserved,
    };

    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(
      `${OUTPUT_DIR}/receipt.json`,
      `${JSON.stringify(receipt, null, 2)}\n`,
      "utf8",
    );
    console.log(
      `Founder Funnel readback verified for ${expectedHead}: ${REQUIRED_EVENTS.join(", ")}`,
    );
    process.exit(0);
  }

  if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
}

const missing = REQUIRED_EVENTS.filter((event) => (lastObserved[event] || 0) < 1);
throw new Error(
  `Founder Funnel readback did not observe all exact-release proof events. Missing: ${missing.join(", ")}`,
);
