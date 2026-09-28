import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('storefront keeps its canonical entry and mounts the bounded provider lane there', async () => {
  for (const path of ['wrangler.toml', 'wrangler.frontdoor.toml']) {
    const config = await read(path);
    assert.match(config, /^main\s*=\s*"worker\/entry\.ts"\s*$/m);
  }
  const entry = await read('worker/entry.ts');
  assert.match(entry, /JBH_AI_OPERATOR_KEY/);
  assert.match(entry, /providerResponse\(request, env, pathname\)/);
  assert.match(entry, /authority: "none"/);
});

test('provider runtime keeps all provider keys server-side', async () => {
  const runtime = await read('worker/provider-runtime.ts');
  assert.match(runtime, /OPENAI_API_KEY/);
  assert.match(runtime, /ANTHROPIC_API_KEY/);
  assert.match(runtime, /MODEL_API_KEY/);
  assert.match(runtime, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(runtime, /https:\/\/api\.anthropic\.com\/v1\/messages/);
  assert.match(runtime, /https:\/\/api\.meta\.ai\/v1\/responses/);
  assert.match(runtime, /restricted context is not authorized/);
  assert.doesNotMatch(runtime, /EXPO_PUBLIC_|VITE_[A-Z_]*API_KEY/);
});
