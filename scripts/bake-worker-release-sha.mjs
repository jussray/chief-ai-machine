import { writeFile } from 'node:fs/promises';

const releaseSha = [
  process.env.RELEASE_SHA,
  process.env.GITHUB_SHA,
  process.env.WORKERS_CI_COMMIT_SHA,
]
  .map((value) => value?.trim())
  .find(Boolean) || 'unknown';

const releaseBranch = [
  process.env.RELEASE_BRANCH,
  process.env.WORKERS_CI_BRANCH,
  process.env.GITHUB_REF_NAME,
]
  .map((value) => value?.trim())
  .find(Boolean) || 'unknown';

const target = new URL('../worker/release-sha.js', import.meta.url);
await writeFile(
  target,
  `export const BUILD_RELEASE_SHA = ${JSON.stringify(releaseSha)};\nexport const BUILD_RELEASE_BRANCH = ${JSON.stringify(releaseBranch)};\n`,
  'utf8',
);
