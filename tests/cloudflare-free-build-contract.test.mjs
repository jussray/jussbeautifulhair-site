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
  assert.match(build, /npm run verify:prebuild/);
  assert.match(build, /npm run build:app/);
  assert.match(build, /npm run verify:commerce-seam/);
  assert.match(build, /npm run security:deploy-boundary/);
  assert.doesNotMatch(build, /\bwrangler\b|npm run quality/);

  assert.equal(pkg.scripts['verify:deploy'], 'npm run build');
});
