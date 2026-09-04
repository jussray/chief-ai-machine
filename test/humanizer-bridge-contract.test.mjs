import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const skill = readFileSync('.agents/skills/humanizer/SKILL.md', 'utf8');
const source = JSON.parse(readFileSync('.agents/skills/humanizer/SOURCE.json', 'utf8'));

describe('Humanizer donor bridge contract', () => {
  it('pins the founder-approved Blader source exactly', () => {
    expect(source).toMatchObject({
      contract: 'juss/donor-skill-source@v1',
      skillId: 'humanizer',
      role: 'execution-bridge',
      upstreamRepository: 'blader/humanizer',
      upstreamCommit: 'e2e92e7b4b8229253ed5c8e81dc65463fdeddda5',
      upstreamPath: 'SKILL.md',
      upstreamBlobSha: 'c9c22422f822f07767ad1b6e79eedccbfe4e9f63',
      upstreamVersion: '2.11.2',
      license: 'MIT',
    });
  });

  it('fails closed instead of following donor drift', () => {
    expect(skill).toContain('Require GitHub\'s returned blob SHA');
    expect(skill).toContain('stop as `BLOCKED`');
    expect(skill).toContain('Never fall forward to upstream `main`');
    expect(skill).toContain('Do not claim Humanizer ran unless the pinned source was actually retrieved and matched.');
  });

  it('keeps Humanizer inside a text-only authority ceiling', () => {
    expect(source.authority).toEqual({
      mode: 'text-transform-only',
      repositoryWrite: false,
      externalCommunication: false,
      publish: false,
      providerMutation: false,
      authorityExpansion: false,
    });
    expect(skill).toContain('Preserve the upstream skill\'s claim-preservation and no-invented-facts rules.');
    expect(skill).toContain('Neither this bridge nor the donor may authorize repository writes');
  });
});
