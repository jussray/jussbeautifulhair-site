import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const limiter = await readFile(new URL("../worker/rate-limit.ts", import.meta.url), "utf8");
const entry = await readFile(new URL("../worker/entry.ts", import.meta.url), "utf8");
const defaultConfig = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
const frontdoorConfig = await readFile(new URL("../wrangler.frontdoor.toml", import.meta.url), "utf8");

test("JBH rate-limit scope covers every API route and version without counting static assets", () => {
  assert.match(limiter, /pathname === "\/version"/);
  assert.match(limiter, /pathname === "\/api"/);
  assert.match(limiter, /pathname\.startsWith\("\/api\/"\)/);
  assert.match(limiter, /if \(!isJbhDynamicPath\(pathname\)\) return null/);
});

test("canonical Worker edge enforces the limiter before route dispatch", () => {
  assert.match(entry, /import \{ enforceJbhRateLimit, type RateLimitBinding \} from "\.\/rate-limit"/);
  assert.match(entry, /JBH_RATE_LIMITER\?: RateLimitBinding/);
  const limiterCall = entry.indexOf("enforceJbhRateLimit(request, env)");
  const versionDispatch = entry.indexOf("if (pathname === VERSION_PATH)");
  const providerDispatch = entry.indexOf("providerResponse(request, env, pathname)");
  assert.ok(limiterCall >= 0 && limiterCall < versionDispatch && limiterCall < providerDispatch);
});

test("missing rate-limit binding fails closed and denial returns retry guidance", () => {
  assert.match(limiter, /rate_limit_unavailable/);
  assert.match(limiter, /rate_limit_exceeded/);
  assert.match(limiter, /"Retry-After"/);
  assert.doesNotMatch(limiter, /if \(!limiter\) return null/);
});

test("limiter identity trusts Cloudflare edge IP and never X-Forwarded-For", () => {
  assert.match(limiter, /CF-Connecting-IP/);
  assert.doesNotMatch(limiter, /get\("X-Forwarded-For"\)/);
  assert.match(limiter, /"ip:unknown"/);
});

test("both JBH deploy configs bind the same first-class Cloudflare limiter", () => {
  for (const config of [defaultConfig, frontdoorConfig]) {
    assert.match(config, /\[\[ratelimits\]\]/);
    assert.match(config, /name = "JBH_RATE_LIMITER"/);
    assert.match(config, /namespace_id = "1003"/);
    assert.match(config, /simple = \{ limit = 120, period = 60 \}/);
  }
});
