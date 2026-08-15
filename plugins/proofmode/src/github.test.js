import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  loadPublicRepositoryEvidence,
  parseTarArchive,
  ProofModeGitHubError,
} from './github.js';

const SHA = '0123456789abcdef0123456789abcdef01234567';

function writeString(buffer, offset, length, value) {
  Buffer.from(value, 'utf8').copy(buffer, offset, 0, length);
}

function tarEntry(path, content) {
  const body = Buffer.from(content, 'utf8');
  const header = Buffer.alloc(512);
  writeString(header, 0, 100, path);
  writeString(header, 124, 12, `${body.length.toString(8).padStart(11, '0')}\0`);
  header[156] = '0'.charCodeAt(0);
  const padding = Buffer.alloc(Math.ceil(body.length / 512) * 512 - body.length);
  return Buffer.concat([header, body, padding]);
}

function tarArchive(entries) {
  return Buffer.concat([
    ...entries.map(([path, content]) => tarEntry(path, content)),
    Buffer.alloc(1024),
  ]);
}

describe('ProofMode GitHub evidence loading', () => {
  it('falls back to a bounded exact-SHA archive when the public API is rate-limited', async () => {
    const root = `chief-ai-machine-${SHA}`;
    const tar = tarArchive([
      [`${root}/README.md`, '# Chief AI\nProduction claims remain evidence-gated.'],
      [`${root}/package.json`, '{"name":"chief-ai-machine"}'],
      [`${root}/worker/index.js`, 'export default {};'],
      [`${root}/worker/proofmode-mcp.js`, 'export const proof = true;'],
      [`${root}/e2e/proofmode-mcp.pw.mjs`, 'export const test = true;'],
      [`${root}/wrangler.jsonc`, '{}'],
    ]);

    const fetchImpl = async (url) => {
      if (url.startsWith('https://api.github.com/')) {
        return new Response('rate limited', { status: 429 });
      }
      if (url.startsWith('https://codeload.github.com/')) {
        return new Response(gzipSync(tar), { status: 200 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const evidence = await loadPublicRepositoryEvidence(
      { owner: 'jussray', repo: 'chief-ai-machine', ref: SHA },
      { fetchImpl },
    );

    expect(evidence.sourceMode).toBe('exact_sha_archive_fallback');
    expect(evidence.headSha).toBe(SHA);
    expect(evidence.ref).toBe(SHA);
    expect(evidence.readme).toContain('# Chief AI');
    expect(evidence.paths).toContain('worker/proofmode-mcp.js');
    expect(evidence.workflows).toEqual([]);
    expect(evidence.deployments).toEqual([]);
  });

  it('does not use archive fallback for a moving branch ref', async () => {
    const fetchImpl = async () => new Response('rate limited', { status: 429 });

    await expect(
      loadPublicRepositoryEvidence(
        { owner: 'jussray', repo: 'chief-ai-machine', ref: 'main' },
        { fetchImpl },
      ),
    ).rejects.toMatchObject({
      name: 'ProofModeGitHubError',
      code: 'source_rate_limited',
    });
  });

  it('drops traversal-shaped archive paths instead of treating them as repository evidence', () => {
    const root = `chief-ai-machine-${SHA}`;
    const parsed = parseTarArchive(
      tarArchive([
        [`${root}/README.md`, '# Safe'],
        [`${root}/../secret.txt`, 'nope'],
        [`${root}/src/index.js`, 'export {};'],
      ]),
    );

    expect(parsed.paths).toContain('README.md');
    expect(parsed.paths).toContain('src/index.js');
    expect(parsed.paths).not.toContain('../secret.txt');
  });
});
