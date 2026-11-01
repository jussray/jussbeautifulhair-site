import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {aggregateTestLedger, buildTestLedger, mapCheckState, selectLatestChecks} from '../scripts/control-room-test-ledger.mjs';

const SHA = 'fbaf7550e6597a25070e72f6dc1f023f0de8346f';
const workflow = readFileSync(new URL('../.github/workflows/control-room-test-ledger.yml', import.meta.url), 'utf8');
const run = (overrides = {}) => ({id: 1, name: 'Storefront Contracts', status: 'completed', conclusion: 'success', head_sha: SHA, started_at: '2026-08-04T20:00:00Z', completed_at: '2026-08-04T20:01:00Z', details_url: 'https://github.com/jussray/jussbeautifulhair-site/actions/runs/1', app: {slug: 'github-actions'}, ...overrides});

test('maps provider states without false green', () => {
  assert.equal(mapCheckState(run()), 'passed');
  assert.equal(mapCheckState(run({conclusion: 'skipped'})), 'skipped');
  assert.equal(mapCheckState(run({conclusion: 'failure'})), 'failed');
  assert.equal(mapCheckState(run({status: 'in_progress', conclusion: null})), 'running');
  assert.equal(mapCheckState(run({status: 'completed', conclusion: null})), 'unknown');
});

test('keeps every latest exact-head lane', () => {
  const checks = selectLatestChecks([
    run({id: 1, completed_at: '2026-08-04T20:01:00Z'}),
    run({id: 2, conclusion: 'failure', completed_at: '2026-08-04T20:02:00Z'}),
    run({id: 3, name: 'Hair Match Playwright'}),
    run({id: 4, name: 'Cloudflare Pages', app: {slug: 'cloudflare-pages'}}),
    run({id: 5, name: 'Verify test-ledger contract'}),
  ], SHA, 'Verify test-ledger contract');
  assert.deepEqual(checks.map((item) => item.name), ['Cloudflare Pages', 'Hair Match Playwright', 'Storefront Contracts']);
  assert.equal(checks.find((item) => item.name === 'Storefront Contracts')?.state, 'failed');
});

test('preserves aggregate states', () => {
  assert.equal(aggregateTestLedger([]).state, 'unknown');
  assert.equal(aggregateTestLedger([{state: 'passed'}]).state, 'passed');
  assert.equal(aggregateTestLedger([{state: 'skipped'}]).state, 'warning');
  assert.equal(aggregateTestLedger([{state: 'running'}]).state, 'pending');
  assert.equal(aggregateTestLedger([{state: 'failed'}]).state, 'failed');
});

test('builds sanitized exact-SHA evidence', () => {
  const ledger = buildTestLedger({repository: 'jussray/jussbeautifulhair-site', sha: SHA, branch: 'main', runId: '1', checks: selectLatestChecks([run()], SHA)});
  assert.equal(ledger.commitSha, SHA);
  assert.equal(ledger.source.includesAllDiscoveredChecks, true);
  assert.equal(JSON.stringify(ledger).includes('token'), false);
});

test('gates the always-on ledger on independent exact-head runtime proof', () => {
  const jobs = workflow.split('\njobs:\n')[1];
  assert.ok(jobs, 'workflow must define jobs');
  assert.deepEqual(
    [...jobs.matchAll(/^  ([a-z][a-z0-9-]*):\s*$/gm)].map((match) => match[1]),
    ['runtime-state-contract', 'ledger'],
  );
  assert.equal((jobs.match(/^    runs-on:/gm) ?? []).length, 2);
  const runtimeJob = workflow.match(/  runtime-state-contract:\n([\s\S]*?)(?=\n  ledger:)/)?.[1];
  assert.ok(runtimeJob, 'stable runtime-state proof job must remain available');
  assert.match(runtimeJob, /name: Runtime-state proof contract/);
  assert.match(runtimeJob, /ref: \$\{\{ env\.EXPECTED_HEAD_SHA \}\}/);
  assert.match(runtimeJob, /persist-credentials: false/);
  assert.match(runtimeJob, /run: node --test test\/control-room-runtime-state\.test\.mjs/);
  assert.match(jobs, /^  ledger:\n    needs: runtime-state-contract$/m);
  assert.match(workflow, /CONTROL_ROOM_LEDGER_SELF_CHECK: Verify test-ledger contract/);
  assert.match(workflow, /name: Verify test-ledger contract/);
  assert.doesNotMatch(workflow, /publish-ledger:/);

  const contractIndex = workflow.indexOf('Run Control Room test-ledger contracts');
  const observeIndex = workflow.indexOf('Observe every exact-head check lane');
  assert.ok(contractIndex >= 0 && observeIndex > contractIndex);
});
