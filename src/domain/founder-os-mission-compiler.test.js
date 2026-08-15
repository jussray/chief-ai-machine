import { describe, expect, it } from 'vitest';
import { compileFounderMission } from './founder-os-mission-compiler.js';

describe('Founder OS mission compiler', () => {
  it('compiles UI + analytics work into proof-bearing protocols without claiming execution', () => {
    const mission = compileFounderMission({
      intent: 'Improve the Se’kret Bip onboarding UX and measure completion conversion',
      project: 'jussray/Sekret-Bip',
      constraints: ['preserve Supabase auth behavior'],
    });

    expect(mission.version).toBe('founder-os-mission-v1');
    expect(mission.authorityCeiling).toBe('L4');
    expect(mission.protocols).toContain('product-design');
    expect(mission.protocols).toContain('data-analytics');
    expect(mission.requiredEvidence).toContain('playwright');
    expect(mission.requiredEvidence).toContain('metric-baseline');
    expect(mission.requiredEvidence).toContain('post-change-metric');
    expect(mission.compiledPrompt).toMatch(/never claim success/i);
  });

  it('raises production/provider work to L6 with rollback and provider read-back', () => {
    const mission = compileFounderMission({
      intent: 'Repair production Cloudflare routing and deploy the verified release',
      project: 'jussray/Sekret-Bip',
      providers: ['cloudflare', 'github'],
    });

    expect(mission.risk).toBe('critical');
    expect(mission.authorityCeiling).toBe('L6');
    expect(mission.protocols).toContain('redteam');
    expect(mission.requiredEvidence).toEqual(expect.arrayContaining([
      'provider-readback',
      'rollback-path',
      'production-readback',
    ]));
    expect(mission.stopConditions.join('\n')).toMatch(/never self-expand authority/i);
  });

  it('marks project resolution as required when the founder has not named a project', () => {
    const mission = compileFounderMission({ intent: 'Fix the highest-confidence launch blocker' });

    expect(mission.project).toBeNull();
    expect(mission.projectResolution).toBe('required-before-execution');
    expect(mission.compiledPrompt).toContain('Project: UNRESOLVED_PROJECT');
  });

  it('rejects an empty founder intent', () => {
    expect(() => compileFounderMission({ intent: '   ' })).toThrow(/Founder intent is required/);
  });
});
