import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Contract for the isolated JBH sandbox storefront config. Only Cloudflare
// preview URLs are enabled, protected by the account's All preview URLs Access
// application. It must never expose workers.dev or live commerce, and must not
// share production bindings (service, rate-limit namespace, production origin).
const sandbox = await readFile(new URL("../wrangler.sandbox.toml", import.meta.url), "utf8");

const topLevel = sandbox.split("[vars]")[0];
const vars = sandbox.split("[vars]")[1]?.split(/\n\[/)[0] ?? "";

test("sandbox Worker uses Access-protected preview URLs, never a public workers.dev host", () => {
  assert.match(topLevel, /^workers_dev\s*=\s*false\s*$/m);
  assert.match(topLevel, /^preview_urls\s*=\s*true\s*$/m);
});

test("sandbox never enables live or legacy commerce", () => {
  assert.match(vars, /^JBH_JUSSPAY_LIVE_ENABLED\s*=\s*"false"\s*$/m);
  assert.match(vars, /^JBH_JUSSPAY_SANDBOX_ENABLED\s*=\s*"true"\s*$/m);
  assert.match(vars, /^JBH_STRIPE_COMMERCE_MODE\s*=\s*"test"\s*$/m);
  assert.match(vars, /^ENABLE_LEGACY_STRIPE_CHECKOUT\s*=\s*"false"\s*$/m);
});

test("sandbox binds the isolated JussPay sandbox Worker, not production", () => {
  assert.match(sandbox, /\[\[services\]\]\s*\nbinding = "JBH_JUSSPAY"\s*\nservice = "jusspay-jbh-sandbox"/);
  assert.doesNotMatch(sandbox, /service = "jusspay"\s*$/m);
});

test("sandbox uses its own rate-limit namespace, not production's 1003", () => {
  const ns = sandbox.match(/namespace_id = "(\d+)"/)?.[1];
  assert.ok(ns, "rate-limit namespace_id must be set");
  assert.notEqual(ns, "1003");
});

// Cloudflare account inventory checked 2026-11-21: 1003 is JBH production,
// 1004 belongs to Protect Me Model Two. Re-audit account bindings before
// changing the reserved sandbox namespace (11004).
test("sandbox namespace cannot reuse Protect Me Model Two rate-limit counters", () => {
  const ns = sandbox.match(/namespace_id = "(\d+)"/)?.[1];
  assert.notEqual(ns, "1004", "1004 belongs to juss-protect-me-2");
  assert.equal(ns, "11004", "changing 11004 requires a fresh account-wide namespace audit");
});

test("sandbox origin is not a public workers.dev hostname", () => {
  const origin = vars.match(/^STORE_ORIGIN\s*=\s*"([^"]+)"/m)?.[1] ?? "";
  assert.ok(origin, "STORE_ORIGIN must be set");
  assert.doesNotMatch(new URL(origin).hostname, /\.workers\.dev$/);
});

test("sandbox Worker name is distinct from production", () => {
  assert.match(topLevel, /^name = "jussbeautifulhair-jbh-sandbox"\s*$/m);
  assert.doesNotMatch(topLevel, /^name = "jussbeautifulhair-site"\s*$/m);
});
