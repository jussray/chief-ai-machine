import { writeFile } from 'node:fs/promises';

const FULL_SHA = /^[0-9a-f]{40}$/i;
const candidates = [
  ['GITHUB_SHA', process.env.GITHUB_SHA],
  ['WORKERS_CI_COMMIT_SHA', process.env.WORKERS_CI_COMMIT_SHA],
  ['RELEASE_SHA', process.env.RELEASE_SHA],
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
