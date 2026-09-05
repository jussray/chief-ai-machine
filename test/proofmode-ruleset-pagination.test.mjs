import { describe, expect, it } from 'vitest';
import { observeRepositoryRulesets } from '../scripts/verify-proofmode-ruleset.mjs';

function detailedRuleset(id) {
  return {
    id,
    name: `ruleset-${id}`,
    target: 'branch',
    enforcement: 'active',
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
    bypass_actors: [],
    rules: [],
  };
}

describe('ProofMode ruleset observation pagination', () => {
  it('follows page two so an additional ruleset cannot hide beyond the first 100 summaries', async () => {
    const pageOne = Array.from({ length: 100 }, (_, index) => ({ id: index + 1 }));
    const pageTwo = [{ id: 101 }];
    const requestedUrls = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (url) => {
      const value = String(url);
      requestedUrls.push(value);
      const parsed = new URL(value);

      if (parsed.pathname.endsWith('/rulesets')) {
        const page = parsed.searchParams.get('page');
        return {
          ok: true,
          async json() {
            return page === '1' ? pageOne : pageTwo;
          },
        };
      }

      const id = Number(parsed.pathname.split('/').pop());
      return {
        ok: true,
        async json() { return detailedRuleset(id); },
      };
    };

    try {
      const rulesets = await observeRepositoryRulesets({
        repository: 'jussray/chief-ai-machine',
      });

      expect(rulesets).toHaveLength(101);
      expect(rulesets.at(-1)?.id).toBe(101);
      const listRequests = requestedUrls.filter((url) => new URL(url).pathname.endsWith('/rulesets'));
      expect(listRequests).toHaveLength(2);
      expect(new URL(listRequests[0]).searchParams.get('page')).toBe('1');
      expect(new URL(listRequests[0]).searchParams.get('per_page')).toBe('100');
      expect(new URL(listRequests[0]).searchParams.get('includes_parents')).toBe('true');
      expect(new URL(listRequests[1]).searchParams.get('page')).toBe('2');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('fails closed when pagination returns the same ruleset id twice', async () => {
    const pageOne = Array.from({ length: 100 }, (_, index) => ({ id: index + 1 }));
    const pageTwo = [{ id: 100 }];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (url) => {
      const parsed = new URL(String(url));
      if (parsed.pathname.endsWith('/rulesets')) {
        return {
          ok: true,
          async json() {
            return parsed.searchParams.get('page') === '1' ? pageOne : pageTwo;
          },
        };
      }
      const id = Number(parsed.pathname.split('/').pop());
      return {
        ok: true,
        async json() { return detailedRuleset(id); },
      };
    };

    try {
      await expect(observeRepositoryRulesets({
        repository: 'jussray/chief-ai-machine',
      })).rejects.toThrow('duplicate ruleset id 100');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
