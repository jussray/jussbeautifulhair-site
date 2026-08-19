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

test('runs the storefront quality bundle before every Wrangler upload', () => {
  assert.match(
    wrangler,
    /^\[build\]\ncommand = "npm run quality"$/m,
  );

  const quality = pkg.scripts.quality;
  assert.equal(typeof quality, 'string');
  assert.match(quality, /npm run verify:cookies/);
  assert.match(quality, /npm run verify:ai-skills/);
  assert.match(quality, /npm run lint/);
  assert.match(quality, /npm test/);
  assert.match(quality, /npm run verify:deploy/);
  assert.doesNotMatch(quality, /\bwrangler\b/);
});

test('keeps the repo build path provider-neutral and non-recursive', () => {
  assert.equal(pkg.scripts.build, 'vite build');
  assert.doesNotMatch(pkg.scripts['verify:deploy'], /\bwrangler\b/);
  assert.match(pkg.scripts['verify:deploy'], /npm run build/);
  assert.match(pkg.scripts['verify:deploy'], /npm run verify:commerce-seam/);
  assert.match(pkg.scripts['verify:deploy'], /npm run security:deploy-boundary/);
});
