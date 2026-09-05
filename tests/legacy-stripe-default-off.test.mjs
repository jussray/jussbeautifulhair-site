import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function read(relativePath) {
  return readFile(path.join(process.cwd(), ...relativePath.split("/")), "utf8");
}

test("all Cloudflare deploy configs route through the legacy Stripe default-off entry gate", async () => {
  for (const configPath of ["wrangler.toml", "wrangler.frontdoor.toml"]) {
    const config = await read(configPath);
    assert.match(config, /^main\s*=\s*"worker\/entry\.ts"\s*$/m);
    assert.match(config, /^ENABLE_LEGACY_STRIPE_CHECKOUT\s*=\s*"false"\s*$/m);
  }
});

test("legacy Stripe checkout and verification routes return 404 unless explicitly enabled", async () => {
  const entry = await read("worker/entry.ts");

  assert.match(entry, /pathname === "\/api\/checkout"/);
  assert.match(entry, /pathname\.startsWith\(LEGACY_STRIPE_SESSION_PREFIX\)/);
  assert.match(entry, /ENABLE_LEGACY_STRIPE_CHECKOUT\?\.trim\(\)\.toLowerCase\(\) === "true"/);
  assert.match(entry, /isLegacyStripeCheckout\(pathname\) && !legacyStripeEnabled\(env\)/);
  assert.match(entry, /status: 404/);
  assert.match(entry, /worker\.fetch\(request, env\)/);
});
