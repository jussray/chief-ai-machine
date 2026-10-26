import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { classifyProductionIdentity } from '../scripts/classify-production-identity.mjs';

const SHA = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), '../scripts/classify-production-identity.mjs');

describe('production identity evidence classification', () => {
  it('rejects HTTP errors before trusting a response body', () => {
    expect(classifyProductionIdentity('403', JSON.stringify({ sha: SHA }), SHA))
      .toBe('runtime_http_error');
  });
  it('classifies malformed and non-JSON HTTP 200 responses', () => {
    expect(classifyProductionIdentity('200', '<html>access denied</html>', SHA))
      .toBe('runtime_non_json');
    expect(classifyProductionIdentity('200', '{bad json', SHA))
      .toBe('runtime_non_json');
  });
  it('classifies missing or malformed identity fields', () => {
    expect(classifyProductionIdentity('200', '{}', SHA))
      .toBe('runtime_json_missing_sha');
    expect(classifyProductionIdentity('200', '{"sha":"not-a-sha"}', SHA))
      .toBe('runtime_json_missing_sha');
    expect(classifyProductionIdentity('200', 'null', SHA))
      .toBe('runtime_json_missing_sha');
  });
  it('rejects a valid but different commit identity', () => {
    expect(classifyProductionIdentity('200', JSON.stringify({ sha: OTHER }), SHA))
      .toBe('runtime_sha_mismatch');
  });
  it('only confirms the exact expected SHA', () => {
    expect(classifyProductionIdentity('200', JSON.stringify({ sha: SHA }), SHA))
      .toBe('exact_runtime_green');
  });
  it('rejects an invalid expected SHA without returning provider data', () => {
    expect(() => classifyProductionIdentity('200', JSON.stringify({ sha: SHA }), 'invalid'))
      .toThrow('INVALID_EXPECTED_SHA');
  });
  it('CLI emits only a fixed classification, never untrusted response contents', () => {
    const text = '<html>PRIVATE_RESPONSE_BODY secret=never-emit</html>';
    const child = spawnSync(process.execPath, [SCRIPT, '200', SHA], {
      input: text,
      encoding: 'utf8',
    });
    expect(child.status).toBe(0);
    expect(child.stdout.trim()).toBe('RUNTIME_NON_JSON');
    expect(child.stdout + child.stderr).not.toContain('PRIVATE_RESPONSE_BODY');
    expect(child.stdout + child.stderr).not.toContain('never-emit');
  });
  it('CLI fails closed when the expected head cannot be trusted', () => {
    const child = spawnSync(process.execPath, [SCRIPT, '200', 'invalid'], {
      input: JSON.stringify({ sha: SHA }),
      encoding: 'utf8',
    });
    expect(child.status).toBe(1);
    expect(child.stderr.trim()).toBe('RUNTIME_IDENTITY_CLASSIFICATION_FAILED');
  });
});
