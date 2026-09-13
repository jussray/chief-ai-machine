import { writeFile } from 'node:fs/promises';

// Provider-owned exact commit identity wins over mutable release variables.
// Cloudflare Workers Builds exposes WORKERS_CI_COMMIT_SHA for the candidate it
// actually built; GitHub-hosted build paths expose GITHUB_SHA. RELEASE_SHA is a
// fallback for explicit/manual release flows only.
const releaseSha = [
  process.env.WORKERS_CI_COMMIT_SHA,
  process.env.GITHUB_SHA,
  process.env.RELEASE_SHA,
]
  .map((value) => value?.trim())
  .find(Boolean) || 'unknown';

const target = new URL('../worker/release-sha.js', import.meta.url);
await writeFile(
  target,
  `export const BUILD_RELEASE_SHA = ${JSON.stringify(releaseSha)};\n`,
  'utf8',
);
