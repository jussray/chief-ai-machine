import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateGmailResolveContract } from '../scripts/run-gmail-resolve-evals.mjs';

const skill = readFileSync(new URL('../skills/gmail-resolve/SKILL.md', import.meta.url), 'utf8');
const evalSuite = readFileSync(new URL('../skills/gmail-resolve/references/eval-suite.md', import.meta.url), 'utf8');
const fixtures = JSON.parse(
  readFileSync(new URL('../skills/gmail-resolve/evals/scenarios.json', import.meta.url), 'utf8'),
);

describe('Gmail Resolve executable contract evals', () => {
  it('covers every documented scenario exactly once', () => {
    const documentedTitles = [...evalSuite.matchAll(/^### \d+\.\s+(.+)$/gm)]
      .map((match) => match[1].trim());
    const fixtureTitles = fixtures.scenarios.map((scenario) => scenario.title);

    expect(fixtureTitles).toEqual(documentedTitles);
    expect(new Set(fixtures.scenarios.map((scenario) => scenario.id)).size).toBe(fixtures.scenarios.length);
    expect(fixtures.scenarios).toHaveLength(12);
  });

  it('passes every current contract scenario and assertion', () => {
    const scorecard = evaluateGmailResolveContract({ skill, evalSuite, fixtures });

    expect(scorecard.scope).toBe('contract');
    expect(scorecard.status).toBe('pass');
    expect(scorecard.summary.scenarios).toBe(12);
    expect(scorecard.summary.failedScenarios).toBe(0);
    expect(scorecard.summary.failedAssertions).toBe(0);
    expect(scorecard.summary.scenarioPassRate).toBe(1);
  });

  it('fails closed when a real recipient guardrail is weakened', () => {
    const weakenedSkill = skill.replace(
      'Never invent a recipient.',
      'A recipient may be inferred when the name looks familiar.',
    );
    const scorecard = evaluateGmailResolveContract({
      skill: weakenedSkill,
      evalSuite,
      fixtures,
    });
    const scenario = scorecard.scenarios.find(
      (candidate) => candidate.id === 'same-name-recipient-ambiguity',
    );

    expect(scorecard.status).toBe('fail');
    expect(scenario?.passed).toBe(false);
    expect(
      scenario?.assertions.some(
        (assertion) => assertion.value === 'Never invent a recipient.' && !assertion.passed,
      ),
    ).toBe(true);
  });

  it('refuses to relabel contract coverage as live Gmail evidence', () => {
    const mislabeledFixtures = { ...fixtures, scope: 'live-gmail' };
    const scorecard = evaluateGmailResolveContract({
      skill,
      evalSuite,
      fixtures: mislabeledFixtures,
    });

    expect(scorecard.status).toBe('fail');
    expect(scorecard.configurationErrors).toContain(
      'Fixture scope must remain "contract" until live Gmail execution is actually measured.',
    );
  });
});
