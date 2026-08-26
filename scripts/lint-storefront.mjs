import { execFile } from "node:child_process";
import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const execFileAsync = promisify(execFile);
const failures = [];
const ignoredDirectories = new Set([
  ".git",
  ".wrangler",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const sourceRoots = ["client/src", "shared", "worker", ".github/workflows"];
const textExtensions = new Set([
  ".cjs",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sh",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function isTrackedRepositoryPath(relativePath) {
  try {
    const { stdout } = await execFileAsync("git", ["ls-files", "--", relativePath], {
      cwd: root,
      encoding: "utf8",
    });
    return stdout.trim().length > 0;
  } catch {
    // Some packaged/build environments omit Git metadata entirely. Preserve the
    // previous fail-closed behavior there rather than silently weakening the guard.
    return exists(relativePath);
  }
}

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function collectFiles(relativePath) {
  if (!(await exists(relativePath))) return [];
  const absolute = path.join(root, relativePath);
  const info = await stat(absolute);
  if (info.isFile()) return [relativePath];

  const result = [];
  for (const entry of await readdir(absolute, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) result.push(...(await collectFiles(child)));
    if (entry.isFile()) result.push(child);
  }
  return result;
}

function requireMatch(text, pattern, message) {
  if (!pattern.test(text)) failures.push(message);
}

function forbidMatch(text, pattern, message) {
  if (pattern.test(text)) failures.push(message);
}

const files = (await Promise.all(sourceRoots.map(collectFiles))).flat();
const forbiddenPatterns = [
  {
    pattern: /sk_(?:live|test)_[A-Za-z0-9]{12,}/i,
    label: "Stripe secret-looking value",
  },
  {
    pattern: /whsec_[A-Za-z0-9]{12,}/i,
    label: "webhook secret-looking value",
  },
  {
    pattern: /VITE_[A-Z0-9_]*(?:SECRET|TOKEN|PRIVATE|PASSWORD|API_KEY)\b/,
    label: "client-exposed secret variable",
  },
  {
    pattern: /(?:^|["'`/])(vendor-docs|admin-local)(?:["'`/]|$)/i,
    label: "private control-layer path",
  },
];

for (const relativePath of files) {
  if (!textExtensions.has(path.extname(relativePath).toLowerCase())) continue;
  const text = await read(relativePath);
  for (const { pattern, label } of forbiddenPatterns) {
    if (pattern.test(text)) failures.push(`${relativePath} contains a forbidden ${label}.`);
  }
  if (
    relativePath.startsWith(".github/workflows/") &&
    /uses:\s*[^\s]+@master\b/i.test(text)
  ) {
    failures.push(`${relativePath} uses an unpinned @master GitHub Action.`);
  }
  if (
    /console\.(?:log|error|warn)\([^\n]*(?:rawBody|request\.body|req\.body|Stripe-Signature|STRIPE_WEBHOOK_SECRET|STRIPE_SECRET_KEY)/i.test(
      text,
    )
  ) {
    failures.push(`${relativePath} appears to log a sensitive payment or webhook value.`);
  }
}

const catalogBridge = await read("client/src/lib/catalog.ts");
requireMatch(
  catalogBridge,
  /export \* from "\.\.\/\.\.\/\.\.\/shared\/catalog";/,
  "Client catalog bridge must resolve to the repository shared catalog.",
);
forbidMatch(
  catalogBridge,
  /\.\.\/\.\.\/\.\.\/\.\.\/shared\/catalog/,
  "Client catalog bridge must not escape above the repository root.",
);

const worker = await read("worker/index.ts");
requireMatch(
  worker,
  /from "\.\.\/shared\/catalog"/,
  "Cloudflare Worker must import the shared catalog directly.",
);
forbidMatch(
  worker,
  /client\/src\/lib\/catalog/,
  "Cloudflare Worker must not depend on the client catalog bridge.",
);

const expectedStripeVersion = "2025-02-24.acacia";
requireMatch(
  worker,
  new RegExp(`apiVersion:\\s*"${expectedStripeVersion.replaceAll(".", "\\.")}"`),
  "worker/index.ts must use the Stripe API version pinned by the installed Stripe SDK.",
);

for (const forbiddenPath of [
  "api",
  "vercel.json",
  "drizzle.config.ts",
  "shared/schema.ts",
  "client/src/pages/Confirmation.tsx",
]) {
  if (await isTrackedRepositoryPath(forbiddenPath)) {
    failures.push(`Public repository contains a forbidden alternate server/data path: ${forbiddenPath}`);
  }
}

if (failures.length) {
  console.error("JBH storefront static analysis failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "JBH storefront static analysis passed: catalog, single Cloudflare payment entry, workflow pinning, and sensitive-log boundaries verified.",
);
