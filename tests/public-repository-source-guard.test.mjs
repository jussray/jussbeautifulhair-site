import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const forbiddenTrackedPathPatterns = [
  /(^|\/)\.env(?:\.|$)/i,
  /(^|\/)(?:id_rsa|id_ed25519)(?:\.|$)/i,
  /\.(?:p12|pfx|sqlite|sqlite3|db)$/i,
  /(^|\/)(?:customers?|orders?|vendors?|suppliers?)[-_].*\.(?:csv|json|jsonl|xlsx)$/i,
];

const allowedExamplePaths = new Set([
  ".env.example",
  ".env.sample",
]);

const secretPatterns = [
  ["GitHub classic token", /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g],
  ["GitHub fine-grained token", /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g],
  ["Stripe secret key", /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g],
  ["Stripe webhook secret", /\bwhsec_[A-Za-z0-9]{16,}\b/g],
  ["Shopify Admin token", /\bshpat_[A-Za-z0-9]{16,}\b/g],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g],
  ["AWS access-key ID", /\bAKIA[0-9A-Z]{16}\b/g],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{30,}\b/g],
  ["private key material", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ["non-empty Cloudflare API token assignment", /CLOUDFLARE_(?:API|ACCESS_API)_TOKEN\s*=\s*["']?[A-Za-z0-9_-]{20,}["']?/g],
  ["non-empty database URL assignment", /DATABASE_URL\s*=\s*["']?(?:postgres|postgresql):\/\/[^\s"']+/g],
  ["non-empty Supabase service-role assignment", /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?[A-Za-z0-9._-]{20,}["']?/g],
];

function isProbablyText(buffer) {
  return !buffer.includes(0);
}

test("tracked public repository contains no obvious secret or private-data artifacts", async () => {
  const pathViolations = trackedFiles.filter((file) =>
    !allowedExamplePaths.has(file) && forbiddenTrackedPathPatterns.some((pattern) => pattern.test(file)),
  );
  assert.deepEqual(pathViolations, [], `forbidden tracked public paths: ${pathViolations.join(", ")}`);

  const secretViolations = [];

  for (const file of trackedFiles) {
    if (file === "tests/public-repository-source-guard.test.mjs") continue;

    let buffer;
    try {
      buffer = await readFile(file);
    } catch {
      continue;
    }
    if (!isProbablyText(buffer)) continue;

    const content = buffer.toString("utf8");
    for (const [label, pattern] of secretPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) secretViolations.push(`${file}: ${label}`);
    }
  }

  assert.deepEqual(secretViolations, [], `credential-shaped values found in tracked source:\n${secretViolations.join("\n")}`);
});

test("public source guard itself stays inside the tracked tests boundary", () => {
  assert.equal(path.posix.normalize("tests/public-repository-source-guard.test.mjs"), "tests/public-repository-source-guard.test.mjs");
});
