import assert from 'node:assert/strict';
import test from 'node:test';
import {buildPublicBuildReceipt} from '../scripts/write-public-build-receipt.mjs';

const SHA = 'a'.repeat(40);

test('binds Cloudflare Pages receipts to its exact injected commit SHA', () => {
  assert.deepEqual(
    buildPublicBuildReceipt({
      CF_PAGES: '1',
      CF_PAGES_COMMIT_SHA: SHA,
      SECRET_TOKEN: 'must-not-leak',
    }),
    {
      version: 1,
      contract: 'jbh-public-build-proof-v1',
      provider: 'cloudflare-pages',
      sourceCommitSha: SHA,
      proofBundle: 'repository-non-browser-build-contracts-passed',
      publicSafe: true,
    },
  );
});

test('binds Workers Builds receipts without confusing them with Pages', () => {
  const receipt = buildPublicBuildReceipt({
    WORKERS_CI: '1',
    WORKERS_CI_COMMIT_SHA: SHA,
  });
  assert.equal(receipt.provider, 'cloudflare-workers-builds');
  assert.equal(receipt.sourceCommitSha, SHA);
});

test('fails closed on malformed or non-Cloudflare commit identity', () => {
  assert.equal(
    buildPublicBuildReceipt({CF_PAGES: '1', CF_PAGES_COMMIT_SHA: 'not-a-sha'}).sourceCommitSha,
    null,
  );
  assert.deepEqual(
    buildPublicBuildReceipt({VERCEL_GIT_COMMIT_SHA: SHA}),
    {
      version: 1,
      contract: 'jbh-public-build-proof-v1',
      provider: 'local',
      sourceCommitSha: null,
      proofBundle: 'repository-non-browser-build-contracts-passed',
      publicSafe: true,
    },
  );
});
