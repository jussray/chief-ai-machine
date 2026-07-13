import { describe, it, expect } from 'vitest';
import { BENCHMARKS } from './benchmarks.js';

describe('BENCHMARKS data integrity', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(BENCHMARKS)).toBe(true);
    expect(BENCHMARKS.length).toBeGreaterThan(0);
  });

  it('has task, chatgpt, claude, perplexity, and best on every row', () => {
    for (const row of BENCHMARKS) {
      for (const key of ['task', 'chatgpt', 'claude', 'perplexity', 'best']) {
        expect(typeof row[key], `row "${row.task}" field "${key}"`).toBe('string');
        expect(row[key].length, `row "${row.task}" field "${key}" non-empty`).toBeGreaterThan(0);
      }
    }
  });

  it('star-rating columns only use star glyphs', () => {
    const starPattern = /^[★☆]{1,5}$/;
    for (const row of BENCHMARKS) {
      for (const key of ['chatgpt', 'claude', 'perplexity']) {
        expect(starPattern.test(row[key]), `row "${row.task}" field "${key}" is a star rating`).toBe(true);
      }
    }
  });
});
