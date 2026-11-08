import { writeFile } from 'node:fs/promises';

const FULL_SHA = /^[0-9a-f]{40}$/i;
const explicitReleaseSha = process.env.RELEASE_SHA?.trim();
const githubRef = process.env.GITHUB_REF?.trim() || '';
const githubEventName = process.env.GITHUB_EVENT_NAME?.trim() || '';
const syntheticPullRequestMergeSha =
  githubEventName === 'pull_request'
  && /^refs\/pull\/\d+\/merge$/.test(githubRef)
  && Boolean(explicitReleaseSha);

// On GitHub pull_request runners, GITHUB_SHA identifies the synthetic merge
// wrapper, not the checked-out candidate commit. When the proof workflow
// explicitly binds RELEASE_SHA to the candidate, exclude only that wrapper.
// WORKERS_CI_COMMIT_SHA remains authoritative and any real disagreement still
// fails closed below.
const candidates = [
  ...(syntheticPullRequestMergeSha ? [] : [['GITHUB_SHA', process.env.GITHUB_SHA]]),
  ['WORKERS_CI_COMMIT_SHA', process.env.WORKERS_CI_COMMIT_SHA],
  ['RELEASE_SHA', explicitReleaseSha],
]
  .map(([name, value]) => [name, value?.trim()])
  .filter(([, value]) => Boolean(value));

for (const [name, value] of candidates) {
  if (!FULL_SHA.test(value)) {
    throw new Error(`${name} must be a full 40-character commit SHA when provided`);
  }
}

const distinctShas = [...new Set(candidates.map(([, value]) => value.toLowerCase()))];
if (distinctShas.length > 1) {
  throw new Error('Release SHA inputs disagree; refusing to bake ambiguous artifact identity');
}

// Local Wrangler development may legitimately have no provider commit metadata.
// Production/CI builds are expected to provide exactly one unambiguous SHA.
const releaseSha = distinctShas[0] || 'unknown';

const target = new URL('../worker/release-sha.js', import.meta.url);
await writeFile(
  target,
  `export const BUILD_RELEASE_SHA = ${JSON.stringify(releaseSha)};\n`,
  'utf8',
);
