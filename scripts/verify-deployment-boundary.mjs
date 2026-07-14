import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
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

for (const privatePath of [
  "vendor-docs",
  "jbh-private",
  "admin-local",
  "jbh-admin.html",
]) {
  if (await exists(privatePath)) {
    failures.push(`Private path must not exist in the public repository: ${privatePath}`);
  }
}

const distFiles = await collectFiles("dist/public");
const textExtensions = new Set([".html", ".js", ".css", ".json", ".map", ".txt"]);
const forbiddenBuildMarkers = [
  /JBH_ADMIN_PASSWORD/i,
  /VITE_ADMIN_PASSWORD/i,
  /CF_ACCESS_AUD/i,
  /jbh\.admin\.auth/i,
  /vendor sourcing master/i,
  /gatekept factory/i,
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
      failures.push(`Private marker ${marker} found in public build file ${normalized}`);
    }
  }
}

if (failures.length) {
  console.error("JBH deployment boundary verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("JBH deployment boundary verified: public host only, previews disabled, no private artifacts detected.");
