import {mkdir, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const SHA_RE = /^[0-9a-f]{40}$/;
export const PUBLIC_BUILD_RECEIPT_PATH = 'dist/public/.well-known/jbh-build-proof.json';

export function buildPublicBuildReceipt(env = process.env) {
  const pagesSha = String(env.CF_PAGES_COMMIT_SHA ?? '').toLowerCase();
  const workersSha = String(env.WORKERS_CI_COMMIT_SHA ?? '').toLowerCase();

  const provider = env.CF_PAGES === '1'
    ? 'cloudflare-pages'
    : env.WORKERS_CI === '1'
      ? 'cloudflare-workers-builds'
      : 'local';

  const candidateSha = provider === 'cloudflare-pages'
    ? pagesSha
    : provider === 'cloudflare-workers-builds'
      ? workersSha
      : '';

  return {
    version: 1,
    contract: 'jbh-public-build-proof-v1',
    provider,
    sourceCommitSha: SHA_RE.test(candidateSha) ? candidateSha : null,
    proofBundle: 'repository-non-browser-build-contracts-passed',
    publicSafe: true,
  };
}

export async function writePublicBuildReceipt(env = process.env) {
  const receipt = buildPublicBuildReceipt(env);
  await mkdir('dist/public/.well-known', {recursive: true});
  await writeFile(PUBLIC_BUILD_RECEIPT_PATH, `${JSON.stringify(receipt)}\n`, 'utf8');
  return receipt;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const receipt = await writePublicBuildReceipt();
  console.log(`Public build receipt written: ${receipt.contract} provider=${receipt.provider}`);
}
