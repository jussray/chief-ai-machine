import { writeFile } from 'node:fs/promises';

// Provider-owned exact git identity wins over mutable release variables.
// Cloudflare Workers Builds exposes both WORKERS_CI_COMMIT_SHA and
// WORKERS_CI_BRANCH for the candidate it actually built. GitHub-hosted build
// paths expose GITHUB_SHA/GITHUB_REF_NAME. RELEASE_* values are fallbacks for
// explicit/manual release flows only.
const releaseSha = [
  process.env.WORKERS_CI_COMMIT_SHA,
  process.env.GITHUB_SHA,
  process.env.RELEASE_SHA,
]
  .map((value) => value?.trim())
  .find(Boolean) || 'unknown';

const releaseBranch = [
  process.env.WORKERS_CI_BRANCH,
  process.env.GITHUB_REF_NAME,
  process.env.RELEASE_BRANCH,
]
  .map((value) => value?.trim())
  .find(Boolean) || 'unknown';

const target = new URL('../worker/release-sha.js', import.meta.url);
await writeFile(
  target,
  [
    `export const BUILD_RELEASE_SHA = ${JSON.stringify(releaseSha)};`,
    `export const BUILD_RELEASE_BRANCH = ${JSON.stringify(releaseBranch)};`,
    '',
  ].join('\n'),
  'utf8',
);