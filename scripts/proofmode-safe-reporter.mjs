import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const testStatuses = new Set(['passed', 'failed', 'timedOut', 'skipped', 'interrupted']);
const runStatuses = new Set(['passed', 'failed', 'timedout', 'interrupted']);
const natural = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;

// Allowlist outcome fields. Never serialize Playwright's config, errors,
// request headers, stdout, paths, titles, or attachments: they can hold secrets.
export function buildProofReceipt(suite, result, expectedHead) {
  return {
    schema: 'proofmode-safe-playwright-receipt/v1',
    expectedHeadSha: /^[a-f0-9]{40}$/.test(expectedHead || '') ? expectedHead : null,
    status: runStatuses.has(result.status) ? result.status : 'unknown',
    tests: suite.allTests().map((test, index) => ({
      index,
      line: natural(test.location.line),
      expectedStatus: testStatuses.has(test.expectedStatus) ? test.expectedStatus : 'unknown',
      attempts: test.results.map((attempt) => ({
        status: testStatuses.has(attempt.status) ? attempt.status : 'unknown',
        durationMs: natural(attempt.duration),
      })),
    })),
  };
}

export default class ProofModeSafeReporter {
  constructor(options = {}) {
    this.outputFile = options.outputFile || './artifacts/proofmode-safe.json';
  }

  onBegin(_config, suite) {
    this.suite = suite;
  }

  onEnd(result) {
    const receipt = buildProofReceipt(this.suite, result, process.env.EXPECTED_HEAD_SHA);
    mkdirSync(dirname(this.outputFile), { recursive: true });
    writeFileSync(this.outputFile, JSON.stringify(receipt, null, 2) + '\n');
  }
}
