import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { connectJbhProofBrowser } from "./jbh-live-browser.mjs";

const VERSION_URL = "https://jussbeautifulhair.com/version";
const EXACT_SHA = /^[a-f0-9]{40}$/i;

// Credential-and-transport preflight only. Never classify this as a release receipt.
export function validatePreflightObservation(payload) {
  assert.equal(payload?.ok, true, "Live version response must have ok=true.");
  assert.match(payload?.sha || "", EXACT_SHA, "Live version response must contain an exact commit SHA.");
  assert.ok(
    payload.identitySource === "runtime-binding" || payload.identitySource === "asset-build-proof",
    "Live version response must have an evidence-bound identity source.",
  );
  assert.equal(payload.evidenceRole, "identity-observation");
  assert.equal(payload.authority, "none");
  return { releaseShaObserved: payload.sha, source: payload.identitySource };
}

export async function checkBrowserRunPreflight(chromium, env = process.env) {
  if (env.JBH_PROOF_BROWSER_MODE !== "cloudflare-cdp") {
    throw new Error("Browser Run preflight requires cloudflare-cdp mode.");
  }
  const { browser, transport } = await connectJbhProofBrowser(chromium, env);
  try {
    assert.equal(transport, "cloudflare-cdp");
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      const response = await page.goto(VERSION_URL, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      assert.ok(response?.ok(), `Live version check returned HTTP ${response?.status() ?? "no response"}.`);
      const headers = await response.allHeaders();
      assert.match(headers["content-type"] || "", /application\/json/i);
      const observation = validatePreflightObservation(JSON.parse(await response.text()));
      return {
        ...observation,
        browserTransport: transport,
        preflightOnly: true,
        productionReceipt: false,
        checkoutSubmitted: false,
      };
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  const { chromium } = await import("playwright");
  const observation = await checkBrowserRunPreflight(chromium);
  // No credential value or sensitive CDP connection information is logged.
  process.stdout.write(`Browser Run token and live /version transport verified: ${observation.releaseShaObserved}. Preflight only; no production-release receipt.\n`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    const message = String(error?.message || "");
    // Never print underlying websocket handshake details that could contain secrets.
    const reason = message.includes("authorized account ID and API token")
      ? "dedicated secret or Cloudflare account ID is missing"
      : message.includes("cloudflare-cdp mode")
        ? "wrong proof mode"
        : "Browser Run connection or live identity observation failed; check token scope, browser access and CI job logs";
    process.stderr.write(`Browser Run preflight BLOCKED: ${reason}.\n`);
    process.exitCode = 1;
  });
}
