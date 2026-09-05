import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const config = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
const app = await readFile(new URL("../client/src/App.tsx", import.meta.url), "utf8");
const workerEntry = await readFile(new URL("../worker/entry.ts", import.meta.url), "utf8");
const storefrontWorker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

test("automatic Worker build runs storefront middleware before every static asset", () => {
  assert.match(config, /not_found_handling\s*=\s*"single-page-application"/);
  assert.match(config, /run_worker_first\s*=\s*true/);
});

test("production analytics matches the Cloudflare storefront runtime", () => {
  assert.doesNotMatch(app, /@vercel\/speed-insights|<SpeedInsights\s*\/>/);
  assert.match(workerEntry, /https:\/\/static\.cloudflareinsights\.com/);
  assert.match(workerEntry, /allowCloudflareWebAnalytics\(await worker\.fetch\(request, env\)\)/);
  assert.match(storefrontWorker, /const connectSources = \[\s*"'self'"/);
});
