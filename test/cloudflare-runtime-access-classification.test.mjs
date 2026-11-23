import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
const expectedSha = '1c81a5b685cebc51a953b76bcec0aa4f0e902d42';
const expectedBranch = 'fix/chief-protect2-gate-pilot-20261120';
const versionId = 'bbabe675-5e8a-46b7-8177-bd17cfd9076c';

// No provider token or Cloudflare Access secret is read or sent in this test.
// Every fetch is replaced before the verifier starts, even GitHub check reads.
const syntheticFetch = `
let syntheticFetchCount = 0;
process.on('exit', () => console.error('SYNTHETIC_FETCH_COUNT=' + syntheticFetchCount));
globalThis.fetch = async (input) => {
  syntheticFetchCount += 1;
  const url = String(input);
  if (url.startsWith('https://api.github.com/repos/') && url.endsWith('/check-runs')) {
    return Response.json({check_runs:[{
      name:'Workers Builds: chief-ai',
      status:'completed', conclusion:'success',
      head_sha:process.env.EXPECTED_HEAD_SHA,
      app:{slug:'cloudflare-workers-and-pages'},
      output:{summary:'Version ID: bbabe675-5e8a-46b7-8177-bd17cfd9076c\\nPreview URL: https://synthetic-chief.workers.dev'
        + (process.env.SYNTHETIC_TWO_PREVIEWS === 'true' ? '\\nPreview Alias URL: https://synthetic-alias.workers.dev' : '')}
    }]});
  }
  if (url === 'https://synthetic-chief.workers.dev/version'
      || url === 'https://synthetic-alias.workers.dev/version') {
    if (process.env.SYNTHETIC_RUNTIME_MODE === 'success'
        || (process.env.SYNTHETIC_RUNTIME_MODE === 'mixed' && url.includes('synthetic-chief.workers.dev'))) {
      return Response.json({
        version_id: 'bbabe675-5e8a-46b7-8177-bd17cfd9076c',
        sha: process.env.EXPECTED_HEAD_SHA,
        branch: process.env.EXPECTED_HEAD_BRANCH,
      });
    }
    return new Response(null, {
      status:302,
      headers:{location:'https://jussray.cloudflareaccess.com/login'},
    });
  }
  throw Error('Unexpected network request in isolated verifier proof');
};
`;
const preload = 'data:text/javascript,' + encodeURIComponent(syntheticFetch);

function verify(mode, credentials = {}) {
  return spawnSync(process.execPath, [
    '--import', preload,
    'scripts/verify-cloudflare-runtime-identity.mjs',
  ], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10000,
    env: {
      ...process.env,
      GITHUB_TOKEN: 'synthetic-only-not-a-credential',
      GITHUB_REPOSITORY: 'jussray/chief-ai-machine',
      EXPECTED_HEAD_SHA: expectedSha,
      EXPECTED_HEAD_BRANCH: expectedBranch,
      CLOUDFLARE_RUNTIME_BASE_URL: '',
      CLOUDFLARE_RUNTIME_PROOF_ATTEMPTS: credentials.SYNTHETIC_ATTEMPTS || '1',
      CLOUDFLARE_RUNTIME_PROOF_SLEEP_MS: '0',
      CLOUDFLARE_ACCESS_CLIENT_ID: '',
      CLOUDFLARE_ACCESS_CLIENT_SECRET: '',
      SYNTHETIC_RUNTIME_MODE: mode,
      ...credentials,
    },
  });
}

describe('Chief exact-head runtime identity classified without loosening Access', () => {
  it('reports protected redirects as authentication-blocked, not a mismatched SHA', () => {
    const result = verify('redirect');
    expect(result.status).toBe(1);
    expect(result.error).toBeUndefined();
    expect(result.stderr).toContain('CLOUDFLARE_ACCESS_AUTH_NOT_AVAILABLE');
    expect(result.stderr).toContain('CLOUDFLARE_RUNTIME_PROOF_BLOCKED');
    expect(result.stderr).not.toContain('runtime identity did not match');
    expect(result.stderr).not.toContain('synthetic-only-not-a-credential');
  });

  it('stops after one blocked candidate round even if 30 retries are allowed', () => {
    const result = verify('redirect', {
      SYNTHETIC_ATTEMPTS: '30',
      SYNTHETIC_TWO_PREVIEWS: 'true',
    });
    expect(result.status).toBe(1);
    expect(result.error).toBeUndefined();
    expect(result.stderr).toContain('CLOUDFLARE_ACCESS_AUTH_NOT_AVAILABLE');
    // 1 trusted GitHub receipt read + 2 immutable preview URLs.
    // A retrying verifier would produce 61 calls rather than 3.
    expect(result.stderr).toContain('SYNTHETIC_FETCH_COUNT=3');
    expect(result.stderr).not.toContain('runtime identity did not match');
  });

  it('does not fail closed before inspecting a second candidate that actually serves the exact identity', () => {
    const result = verify('mixed', {
      SYNTHETIC_ATTEMPTS: '30',
      SYNTHETIC_TWO_PREVIEWS: 'true',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('CLOUDFLARE_RUNTIME_IDENTITY_VERIFIED');
  });

  it('identifies a rejected configured Access service token without exposing its value', () => {
    const result = verify('redirect', {
      CLOUDFLARE_ACCESS_CLIENT_ID: 'synthetic-id',
      CLOUDFLARE_ACCESS_CLIENT_SECRET: 'synthetic-secret-not-real',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('CLOUDFLARE_ACCESS_SERVICE_AUTH_REJECTED');
    expect(result.stderr).not.toContain('synthetic-secret-not-real');
  });

  it('still requires the real exact provider Version ID, SHA and branch contract', () => {
    const result = verify('success');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Cloudflare runtime identity verified for exact head ' + expectedSha);
    expect(result.stdout).toContain('CLOUDFLARE_RUNTIME_IDENTITY_VERIFIED');
  });
});
