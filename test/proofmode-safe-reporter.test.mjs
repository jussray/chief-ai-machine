import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { buildProofReceipt } from '../scripts/proofmode-safe-reporter.mjs';

describe('credential-safe ProofMode evidence', () => {
  it('retains failure outcomes without credential-bearing Playwright data', () => {
    const secret = 'synthetic-access-secret-canary';
    const test = {
      title: secret,
      location: { file: secret, line: 12 },
      expectedStatus: 'passed',
      results: [{
        status: 'failed',
        duration: 25,
        error: { message: secret, stack: secret },
        errors: [{ message: secret }],
        stdout: [secret],
        attachments: [{ body: Buffer.from(secret), path: secret }],
        request: { headers: { 'CF-Access-Client-Secret': secret } },
      }],
    };
    const receipt = buildProofReceipt({ allTests: () => [test] }, {
      status: 'failed', errors: [{ message: secret }],
    }, 'a'.repeat(40));
    expect(receipt).toEqual({
      schema: 'proofmode-safe-playwright-receipt/v1',
      expectedHeadSha: 'a'.repeat(40),
      status: 'failed',
      tests: [{
        index: 0,
        line: 12,
        expectedStatus: 'passed',
        attempts: [{ status: 'failed', durationMs: 25 }],
      }],
    });
    expect(JSON.stringify(receipt)).not.toContain(secret);
  });

  it('rejects unexpected strings in the retained outcome fields', () => {
    const secret = 'synthetic-secret';
    const receipt = buildProofReceipt({ allTests: () => [{
      location: { line: secret }, expectedStatus: secret,
      results: [{ status: secret, duration: secret }],
    }] }, { status: secret }, secret);
    expect(receipt.expectedHeadSha).toBeNull();
    expect(receipt.status).toBe('unknown');
    expect(receipt.tests[0]).toEqual({
      index: 0, line: null, expectedStatus: 'unknown',
      attempts: [{ status: 'unknown', durationMs: null }],
    });
    expect(JSON.stringify(receipt)).not.toContain(secret);
  });
});
