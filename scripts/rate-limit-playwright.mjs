import assert from "node:assert/strict";
import { createServer } from "node:http";
import { chromium } from "playwright";
import { enforceJbhRateLimit } from "../worker/rate-limit.ts";

function startServer() {
  const counts = new Map();
  const env = {
    JBH_RATE_LIMITER: {
      async limit({ key }) {
        const next = (counts.get(key) ?? 0) + 1;
        counts.set(key, next);
        return { success: next <= 2 };
      },
    },
  };

  const server = createServer(async (req, res) => {
    try {
      const request = new Request(`http://127.0.0.1${req.url}`, {
        method: req.method,
        headers: {
          ...req.headers,
          "CF-Connecting-IP": "203.0.113.44",
        },
      });

      const limited = await enforceJbhRateLimit(request, env);
      const response = limited ?? new Response(
        req.url === "/index.html"
          ? "<!doctype html><title>JBH rate-limit proof</title>"
          : JSON.stringify({ ok: true }),
        {
          status: 200,
          headers: {
            "content-type": req.url === "/index.html"
              ? "text/html; charset=utf-8"
              : "application/json; charset=utf-8",
          },
        },
      );

      res.statusCode = response.status;
      for (const [name, value] of response.headers) res.setHeader(name, value);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      res.statusCode = 500;
      res.end(String(error));
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, baseURL: `http://127.0.0.1:${address.port}` });
    });
  });
}

const { server, baseURL } = await startServer();
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();

  const staticResponse = await page.goto(`${baseURL}/index.html`);
  assert.equal(staticResponse?.status(), 200, "static storefront request must bypass API limiter");

  const result = await page.evaluate(async () => {
    const first = await fetch("/version");
    const second = await fetch("/api/shopify/catalog");
    const third = await fetch("/api/internal/providers");
    return {
      statuses: [first.status, second.status, third.status],
      retryAfter: third.headers.get("retry-after"),
      thirdBody: await third.json(),
    };
  });

  assert.deepEqual(result.statuses, [200, 200, 429]);
  assert.equal(result.retryAfter, "60");
  assert.deepEqual(result.thirdBody, { error: "rate_limit_exceeded" });

  console.log(JSON.stringify({
    contract: "jbh/api-rate-limit-browser-proof@v1",
    engine: "playwright",
    staticBypass: true,
    dynamicStatuses: result.statuses,
    retryAfter: result.retryAfter,
    verifiedOutcome: true,
  }));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
