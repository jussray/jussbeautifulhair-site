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

async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function isTrackedRepositoryPath(relativePath) {
  if (relativePath !== "vercel.json") return exists(relativePath);

  try {
    const { stdout } = await execFileAsync("git", ["ls-files", "--", relativePath], {
      cwd: root,
      encoding: "utf8",
    });
    return stdout.trim().length > 0;
  } catch {
    // Preserve fail-closed behavior when a packaged environment removes Git
    // metadata entirely. Only Vercel's workspace control file may rely on Git
    // source authority; all other forbidden paths are checked by filesystem.
    return exists(relativePath);
  }
}

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function collectFiles(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!(await exists(relativePath))) return [];

  const result = [];
  const info = await stat(absolute);
  if (info.isFile()) return [relativePath];

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

function readSingleTomlArrayTable(text, tableName) {
  const marker = new RegExp(`^\\s*\\[\\[${tableName}\\]\\]\\s*$`, "gm");
  const matches = [...text.matchAll(marker)];
  if (matches.length !== 1) return { count: matches.length, entries: [] };

  const start = (matches[0].index ?? 0) + matches[0][0].length;
  const tail = text.slice(start);
  const nextTableIndex = tail.search(/^\s*\[[^\]]+\]\s*$/m);
  const block = nextTableIndex >= 0 ? tail.slice(0, nextTableIndex) : tail;
  const entries = block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  return { count: 1, entries };
}

const wrangler = await read("wrangler.toml");
requireMatch(
  wrangler,
  /^workers_dev\s*=\s*false\s*$/m,
  "wrangler.toml must explicitly set workers_dev = false.",
);
requireMatch(
  wrangler,
  /^preview_urls\s*=\s*false\s*$/m,
  "wrangler.toml must explicitly set preview_urls = false.",
);
requireMatch(
  wrangler,
  /^STORE_ORIGIN\s*=\s*"https:\/\/[^\"]+"\s*$/m,
  "STORE_ORIGIN must be an explicit HTTPS production origin.",
);
forbidMatch(
  wrangler,
  /workers\.dev/i,
  "wrangler.toml must not route the storefront through workers.dev.",
);
forbidMatch(
  wrangler,
  /^\s*\[\[routes\]\]/m,
  "wrangler.toml must remain route-free so automatic deploys cannot claim the branded hostname.",
);

const frontdoorConfig = await read("wrangler.frontdoor.toml");
requireMatch(
  frontdoorConfig,
  /^name\s*=\s*"jussbeautifulhair-site"\s*$/m,
  "wrangler.frontdoor.toml must target the canonical storefront Worker.",
);
requireMatch(
  frontdoorConfig,
  /^workers_dev\s*=\s*false\s*$/m,
  "wrangler.frontdoor.toml must explicitly set workers_dev = false.",
);
requireMatch(
  frontdoorConfig,
  /^preview_urls\s*=\s*false\s*$/m,
  "wrangler.frontdoor.toml must explicitly set preview_urls = false.",
);
requireMatch(
  frontdoorConfig,
  /^STORE_ORIGIN\s*=\s*"https:\/\/jussbeautifulhair\.com"\s*$/m,
  "Front-door STORE_ORIGIN must remain https://jussbeautifulhair.com.",
);
forbidMatch(
  frontdoorConfig,
  /custom_domain\s*=\s*true/i,
  "Front-door staging must use a Worker Route in front of the existing Shopify origin, not a Custom Domain takeover.",
);
forbidMatch(
  frontdoorConfig,
  /workers\.dev/i,
  "wrangler.frontdoor.toml must not route the storefront through workers.dev.",
);

const frontdoorRoute = readSingleTomlArrayTable(frontdoorConfig, "routes");
if (frontdoorRoute.count !== 1) {
  failures.push("wrangler.frontdoor.toml must contain exactly one [[routes]] block.");
} else {
  const expectedRouteEntries = new Set([
    'pattern = "jussbeautifulhair.com/*"',
    'zone_name = "jussbeautifulhair.com"',
  ]);
  const exactRoute =
    frontdoorRoute.entries.length === expectedRouteEntries.size &&
    frontdoorRoute.entries.every((entry) => expectedRouteEntries.has(entry));
  if (!exactRoute) {
    failures.push(
      "The sole front-door route must contain only pattern = \"jussbeautifulhair.com/*\" and zone_name = \"jussbeautifulhair.com\".",
    );
  }
}

const commandFiles = [
  "package.json",
  ...(await collectFiles(".github/workflows")),
];
for (const relativePath of commandFiles) {
  const text = await read(relativePath);
  forbidMatch(
    text,
    /--temporary\b/i,
    `${relativePath} contains a forbidden temporary deployment flag.`,
  );
  forbidMatch(
    text,
    /--preview-alias\b/i,
    `${relativePath} contains a forbidden public preview alias.`,
  );
}

// Cloudflare deprecated the legacy Workers KV namespace-management route on
// 2026-07-15. Runtime KV bindings are not affected, but any direct REST client,
// CI script, infrastructure helper, or documentation command must use the
// current storage/kv namespace-management route.
const repositoryTextExtensions = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sh",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);
const verifierPath = "scripts/verify-deployment-boundary.mjs";
const repositoryFiles = await collectFiles(".");
for (const relativePath of repositoryFiles) {
  const normalized = relativePath.replaceAll("\\", "/").replace(/^\.\//, "");
  if (normalized === verifierPath) continue;
  if (!repositoryTextExtensions.has(path.extname(normalized).toLowerCase())) continue;

  const text = await read(relativePath);
  if (/\/workers\/namespaces(?:\/|\b)/i.test(text)) {
    failures.push(
      `${normalized} uses the deprecated Workers KV namespace API route; use /storage/kv/namespaces instead.`,
    );
  }
}

// This repository is Cloudflare-only. Legacy Vercel handlers previously
// included an unauthenticated numeric order lookup and database code. Keep all
// alternate deployment/data paths out of the actual build workspace. The sole
// exception is Vercel's own untracked vercel.json control file, which is judged
// against canonical Git source so provider workspace materialization cannot
// impersonate repository authority.
for (const forbiddenPath of [
  "api",
  "vercel.json",
  "setup.sh",
  "drizzle.config.ts",
  "shared/schema.ts",
  "client/src/pages/Confirmation.tsx",
  "vendor-docs",
  "jbh-private",
  "admin-local",
  "jbh-admin.html",
]) {
  if (await isTrackedRepositoryPath(forbiddenPath)) {
    failures.push(`Forbidden public-repository path exists: ${forbiddenPath}`);
  }
}

const appRouter = await read("client/src/App.tsx");
forbidMatch(
  appRouter,
  /\/confirmation\/:id/i,
  "The public router must not restore an order-by-numeric-id confirmation route.",
);

const distFiles = await collectFiles("dist/public");
const textExtensions = new Set([".html", ".js", ".css", ".json", ".map", ".txt"]);
const forbiddenBuildMarkers = [
  /JBH_ADMIN_PASSWORD/i,
  /VITE_ADMIN_PASSWORD/i,
  /CF_ACCESS_AUD/i,
  /jbh\.admin\.auth/i,
  /vendor sourcing master/i,
  /gatekept factory/i,
  /\/api\/orders\//i,
  /\/confirmation\/:id/i,
];

for (const relativePath of distFiles) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (/\/(vendor-docs|admin-local)\//i.test(normalized) || /jbh-admin\.html$/i.test(normalized)) {
    failures.push(`Private-looking artifact found in public build: ${normalized}`);
    continue;
  }

  if (!textExtensions.has(path.extname(relativePath).toLowerCase())) continue;
  const text = await read(relativePath);
  for (const marker of forbiddenBuildMarkers) {
    if (marker.test(text)) {
      failures.push(`Private or legacy marker ${marker} found in public build file ${normalized}`);
    }
  }
}

if (failures.length) {
  console.error("JBH deployment boundary verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "JBH deployment boundary verified: default deploy cannot claim the branded hostname, explicit front-door route is pinned to jussbeautifulhair.com/*, previews disabled, current KV API routes only, and no private, Vercel, database, or numeric order-lookup artifacts detected.",
);
