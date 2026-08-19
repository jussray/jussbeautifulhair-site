import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);
const wrangler = readFileSync(
  new URL('../wrangler.toml', import.meta.url),
  'utf8',
);

test('uses the same provider-neutral build before every Wrangler upload', () => {
  assert.match(
    wrangler,
    /^\[build\]\ncommand = "npm run build"$/m,
  );
  assert.equal(pkg.scripts.quality, 'npm run build');
});

test('makes the ordinary provider build carry the non-browser proof bundle', () => {
  assert.equal(pkg.scripts['build:app'], 'vite build');

  const prebuild = pkg.scripts['verify:prebuild'];
  assert.match(prebuild, /npm run verify:cookies/);
  assert.match(prebuild, /npm run verify:ai-skills/);
  assert.match(prebuild, /npm run lint/);
  assert.match(prebuild, /npm test/);
  assert.doesNotMatch(prebuild, /\bwrangler\b|npm run build(?:\b|:)|npm run quality/);

  const build = pkg.scripts.build;
  const prebuildIndex = build.indexOf('npm run verify:prebuild');
  const appIndex = build.indexOf('npm run build:app');
  const commerceIndex = build.indexOf('npm run verify:commerce-seam');
  const receiptIndex = build.indexOf('node scripts/write-public-build-receipt.mjs');
  const boundaryIndex = build.indexOf('npm run security:deploy-boundary');

  assert.ok(prebuildIndex >= 0);
  assert.ok(appIndex > prebuildIndex);
  assert.ok(commerceIndex > appIndex);
  assert.ok(receiptIndex > commerceIndex);
  assert.ok(boundaryIndex > receiptIndex);
  assert.doesNotMatch(build, /\bwrangler\b|npm run quality/);

  const legacyDeployVerifier = pkg.scripts['verify:deploy'];
  assert.match(legacyDeployVerifier, /npm run build/);
  assert.match(legacyDeployVerifier, /npm run verify:commerce-seam/);
  assert.match(legacyDeployVerifier, /npm run security:deploy-boundary/);
  assert.doesNotMatch(legacyDeployVerifier, /\bwrangler\b/);
});
