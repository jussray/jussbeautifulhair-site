/* global process, fetch */

import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseURL = process.env.JBH_EDGE_BASE_URL;
if (!baseURL) throw new Error("JBH_EDGE_BASE_URL is required");

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();

  // Exercise the real Worker + asset path first. Storefront traffic is routed
  // through worker/entry.ts for headers, but it is outside the dynamic limiter.
  const staticResponse = await page.goto(`${baseURL}/`);
  assert.equal(staticResponse?.status(), 200, "storefront request must remain available");

  const result = await page.evaluate(async () => {
    const statuses = [];
    let retryAfter = null;
    let denialBody = null;

    // Cloudflare's Worker Rate Limiting binding is intentionally permissive
    // around enforcement timing. Prove eventual rejection rather than assuming
    // the exact request that crosses the threshold.
    for (let i = 0; i < 160; i += 1) {
      const response = await fetch("/version", { cache: "no-store" });
      statuses.push(response.status);
      if (response.status === 429) {
        retryAfter = response.headers.get("retry-after");
        denialBody = await response.json();
        break;
      }
    }

    // Exact /api must share the exhausted dynamic ingress boundary. A static
    // storefront route must remain available after the API bucket is exhausted.
    const exactApi = await fetch("/api", { cache: "no-store" });
    const staticAfterExhaustion = await fetch("/", { cache: "no-store" });

    return {
      statuses,
      retryAfter,
      denialBody,
      exactApiStatus: exactApi.status,
      staticStatus: staticAfterExhaustion.status,
    };
  });

  assert.ok(result.statuses.includes(429), "real Worker limiter must eventually reject dynamic traffic");
  assert.equal(result.retryAfter, "60");
  assert.deepEqual(result.denialBody, { error: "rate_limit_exceeded" });
  assert.equal(result.exactApiStatus, 429, "exact /api must not bypass the exhausted dynamic bucket");
  assert.equal(result.staticStatus, 200, "storefront assets must not consume the API limiter");

  console.log(JSON.stringify({
    contract: "jbh/api-rate-limit-browser-proof@v2",
    engine: "playwright+wrangler",
    staticBypass: true,
    observedDynamicStatuses: result.statuses,
    exactApiStatus: result.exactApiStatus,
    retryAfter: result.retryAfter,
    verifiedOutcome: true,
  }));
} finally {
  await browser.close();
}
