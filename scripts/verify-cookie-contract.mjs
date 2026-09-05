import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(resolve(root, '.security/cookies.json'), 'utf8'));
const errors = [];
const requireValue = (condition, message) => { if (!condition) errors.push(message); };

requireValue(manifest.schemaVersion === 1, 'schemaVersion must be 1');
requireValue(manifest.defaultPolicy === 'deny-undeclared', 'defaultPolicy must be deny-undeclared');
requireValue(Array.isArray(manifest.cookies) && manifest.cookies.length === 1, 'the storefront must declare exactly one functional preference cookie');
const cookie = manifest.cookies?.[0] ?? {};
requireValue(cookie.name === 'sidebar_state', 'the only first-party cookie must be sidebar_state');
requireValue(cookie.classification === 'functional_preference', 'sidebar_state must remain a functional preference');
requireValue(cookie.sensitive === false, 'sidebar_state must remain non-sensitive');
requireValue(cookie.maxAgeSeconds === 604800, 'sidebar_state lifetime must remain seven days');
requireValue(Array.isArray(manifest.allowedCookieWriters) && manifest.allowedCookieWriters.length === 1, 'exactly one cookie writer must be declared');

const ignored = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.wrangler']);
const extensions = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.html']);
const writerPatterns = [/document\.cookie\s*=/, /setHeader\(\s*['"]Set-Cookie['"]/, /headers\.append\(\s*['"]Set-Cookie['"]/, /createCookieSessionStorage\s*</, /serializeCookieHeader\s*\(/, /\bsetCookie\s*\(/];
const ext = (path) => path.slice(path.lastIndexOf('.'));
async function walk(path) {
  const info = await stat(path);
  if (info.isDirectory()) {
    if (ignored.has(path.split('/').at(-1))) return [];
    return (await Promise.all((await readdir(path)).map((child) => walk(resolve(path, child))))).flat();
  }
  return extensions.has(ext(path)) ? [path] : [];
}

const allowed = new Set((manifest.allowedCookieWriters ?? []).map((path) => path.replaceAll('\\', '/')));
requireValue(allowed.has('client/src/components/ui/sidebar.tsx'), 'the only allowed cookie writer must be the sidebar primitive');
for (const scanRoot of manifest.scanRoots ?? []) {
  let files = [];
  try { files = await walk(resolve(root, scanRoot)); } catch { errors.push(`scan root does not exist: ${scanRoot}`); continue; }
  for (const file of files) {
    const repoPath = relative(root, file).replaceAll('\\', '/');
    if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(repoPath) || repoPath.includes('/__tests__/')) continue;
    const source = await readFile(file, 'utf8');
    if (writerPatterns.some((pattern) => pattern.test(source)) && !allowed.has(repoPath)) {
      errors.push(`undeclared cookie writer: ${repoPath}`);
    }
  }
}

const sidebarSource = await readFile(resolve(root, 'client/src/components/ui/sidebar.tsx'), 'utf8');
requireValue(sidebarSource.includes('SIDEBAR_COOKIE_NAME = "sidebar_state"'), 'sidebar writer must use the declared name');
requireValue(sidebarSource.includes('SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7'), 'sidebar writer must retain the declared seven-day lifetime');
requireValue(!sidebarSource.includes('customer'), 'sidebar cookie writer must not handle customer data');
requireValue(!sidebarSource.includes('checkout'), 'sidebar cookie writer must not handle checkout data');

const workerSource = await readFile(resolve(root, 'worker/index.ts'), 'utf8');
requireValue(workerSource.includes('"Cache-Control": "no-store"'), 'checkout Worker responses must remain no-store');
requireValue(workerSource.includes('Vary: "Origin"'), 'checkout Worker must vary API responses by Origin');
const wrangler = await readFile(resolve(root, 'wrangler.toml'), 'utf8');
requireValue(
  wrangler.includes('run_worker_first = true'),
  'Worker-first routing must cover public assets so storefront security headers cannot be bypassed',
);

if (errors.length) {
  console.error('Cookie contract verification failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`Cookie contract verified for ${manifest.repository}.`);
console.log('Declared first-party cookies: 1 functional preference');
console.log('Checkout API cache policy: no-store');
console.log('Worker-first routing: all public storefront asset responses');
