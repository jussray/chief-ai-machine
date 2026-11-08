import { discoverTrustedChiefPreview } from './chief-trusted-preview-admission.mjs';

export const TRUSTED_PROOF_NAME = 'Chief Authenticated Preview Proof (trusted main)';

export async function publishTrustedChiefPreviewReceipt(env, fetchImpl = globalThis.fetch) {
  if (env.PROOF_RESULT !== 'success') {
    throw new Error('Protected authenticated browser proof has not passed');
  }
  const runId = String(env.GITHUB_RUN_ID || '');
  if (!/^[1-9]\d*$/.test(runId)) throw new Error('Trusted proof run ID required');

  // Independent post-proof admission closes moved-PR and moved-main races.
  const { previewOrigin, trustedMain, expectedHead } =
    await discoverTrustedChiefPreview(env, fetchImpl);
  const repo = env.GITHUB_REPOSITORY;
  const response = await fetchImpl('https://api.github.com/repos/' + repo + '/check-runs', {
    method: 'POST',
    redirect: 'error',
    headers: {
      Authorization: 'Bearer ' + env.GH_TOKEN,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      name: TRUSTED_PROOF_NAME,
      head_sha: expectedHead,
      status: 'completed',
      conclusion: 'success',
      details_url: 'https://github.com/' + repo + '/actions/runs/' + runId,
      output: {
        title: 'Protected exact-head browser proof passed',
        summary: 'Trusted main: ' + trustedMain
          + '\nPR head: ' + expectedHead
          + '\nImmutable preview: ' + previewOrigin
          + '\nAuthorized browser-proof run: ' + runId
          + '\nSupplementary evidence only; not the required runtime gate.',
      },
    }),
  });
  if (!response.ok) throw new Error('GitHub receipt publication failed with HTTP ' + response.status);
  const created = await response.json();
  if (created.name !== TRUSTED_PROOF_NAME
      || created.head_sha !== expectedHead
      || created.conclusion !== 'success'
      || created.status !== 'completed') {
    throw new Error('Published proof receipt did not match the bound exact-head result');
  }
  return { expectedHead, checkId: created.id };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  publishTrustedChiefPreviewReceipt(process.env).then(({ expectedHead, checkId }) => {
    console.log('Published non-required trusted preview proof receipt ' + checkId
      + ' for exact head ' + expectedHead);
  }).catch(error => {
    console.error('Trusted preview proof publication rejected: ' + (error.message || 'unknown'));
    process.exitCode = 1;
  });
}
