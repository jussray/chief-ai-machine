import { describe, expect, it } from 'vitest';
import {
  createControlRoomEvidenceIngestion,
  createControlRoomEvidenceReceipt,
} from './control-room-evidence.js';
import {
  createSpecialistReportsFromFcrCouncil,
  synthesizeFcrCouncilRound,
} from './fcr-council-bridge.js';

const NOW = new Date('2026-11-01T20:30:00.000Z');

function ingestion() {
  const receipt = createControlRoomEvidenceReceipt({
    id: 'receipt-current-main',
    workspaceId: 'juss',
    projectId: 'founder-control-room',
    sourceRecordId: 'github-main',
    sourceRevision: 'sha-current',
    kind: 'repository',
    subjectType: 'git-ref',
    subjectId: 'founder-control-room-main',
    subjectRef: 'main@sha-current',
    state: 'verified',
    statement: 'Founder Control Room main resolves to the observed exact SHA.',
    sourceRefs: ['github:main@sha-current'],
    observedAt: NOW.toISOString(),
  }, NOW);

  return createControlRoomEvidenceIngestion({
    id: 'ingestion-council-1',
    receipts: [receipt],
  }, NOW);
}

function contribution(role, domain, position = 'support') {
  return {
    contract: 'fcr.council-specialist-contribution.v1',
    role,
    domain,
    position,
    conclusion: `${role} found the bounded architecture coherent.`,
    recommendation: `${role} recommends one reversible next gate.`,
    assumptions: ['The bound ingestion is current.'],
    confidence: 84,
    risks: ['Provider output can still be wrong.'],
    dependencies: position === 'conditional' ? ['Refresh provider evidence.'] : [],
  };
}

function transcript(sourceRef, options = {}) {
  const live = options.live !== false;
  const secondDomain = options.secondDomain ?? 'cross-provider-drift';
  return {
    contract: 'fcr.council-round.v1',
    goal: 'Evaluate the Council/report bridge.',
    initiator: 'fcr',
    sourceRef,
    seedSha256: 'a'.repeat(64),
    humanRelay: false,
    state: 'complete',
    nextSeatIndex: 2,
    interruption: null,
    hops: [
      {
        index: 0,
        relayId: 'relay-1',
        fromOperator: 'fcr',
        toOperator: 'codex',
        capability: 'propose',
        requestHash: 'b'.repeat(64),
        responseHash: 'c'.repeat(64),
        status: 'completed',
        inputSha256: 'a'.repeat(64),
        answerSha256: 'd'.repeat(64),
        answer: '{}',
        evidenceRefs: live ? ['provider:openai:resp-1'] : ['simulated:codex'],
        liveProviderEvidence: live,
        completedAt: NOW.toISOString(),
        specialistContribution: contribution('Engineering Chief', 'engineering'),
      },
      {
        index: 1,
        relayId: 'relay-2',
        fromOperator: 'codex',
        toOperator: 'muse',
        capability: 'propose',
        requestHash: 'e'.repeat(64),
        responseHash: 'f'.repeat(64),
        status: 'completed',
        inputSha256: 'd'.repeat(64),
        answerSha256: '1'.repeat(64),
        answer: '{}',
        evidenceRefs: live ? ['provider:meta:resp-2'] : ['simulated:muse'],
        liveProviderEvidence: live,
        completedAt: NOW.toISOString(),
        specialistContribution: contribution('Evidence Challenger', secondDomain, 'conditional'),
      },
    ],
  };
}

describe('FCR Council to Chief specialist-report bridge', () => {
  it('turns live Council contributions into native reports while taking reality only from FCR ingestion', () => {
    const evidence = ingestion();
    const reports = createSpecialistReportsFromFcrCouncil({
      ingestion: evidence,
      transcript: transcript(`chief-ingestion:${evidence.id}`),
      status: 'reviewed',
    }, NOW);

    expect(reports).toHaveLength(2);
    expect(reports.map((report) => report.domain)).toEqual(['engineering', 'cross-provider-drift']);
    expect(reports[0].reality).toEqual([{
      state: 'verified',
      statement: 'Founder Control Room main resolves to the observed exact SHA.',
      sourceRefs: ['github:main@sha-current'],
      receiptIds: ['receipt-current-main'],
    }]);
    expect(reports[0].source).toContain('provider:openai:resp-1');
    expect(reports[1].source).toContain('provider:meta:resp-2');
  });

  it('feeds those native reports into the existing deterministic Executive Council', () => {
    const evidence = ingestion();
    const result = synthesizeFcrCouncilRound({
      ingestion: evidence,
      transcript: transcript(`chief-ingestion:${evidence.id}`),
      decision: 'Use the native report chain for Council synthesis.',
      nextGate: 'Verify the deployed FCR-to-Chief transport separately.',
      status: 'reviewed',
    }, NOW);

    expect(result.synthesis.reportIds).toEqual(result.reports.map((report) => report.id));
    expect(result.synthesis.positions.conditional).toEqual(['Evidence Challenger']);
    expect(result.synthesis.receiptIds).toEqual(['receipt-current-main']);
    expect(result.synthesis.brief.dissent).toHaveLength(1);
  });

  it('fails closed when the Council round is not bound to the supplied ingestion', () => {
    const evidence = ingestion();
    expect(() => createSpecialistReportsFromFcrCouncil({
      ingestion: evidence,
      transcript: transcript('mission:unbound'),
      status: 'reviewed',
    }, NOW)).toThrow('not bound to the supplied Chief ingestion');
  });

  it('does not promote simulated provider participation to reviewed report status', () => {
    const evidence = ingestion();
    expect(() => createSpecialistReportsFromFcrCouncil({
      ingestion: evidence,
      transcript: transcript(`chief-ingestion:${evidence.id}`, { live: false }),
      status: 'reviewed',
    }, NOW)).toThrow('require live provider evidence');

    expect(createSpecialistReportsFromFcrCouncil({
      ingestion: evidence,
      transcript: transcript(`chief-ingestion:${evidence.id}`, { live: false }),
      status: 'draft',
    }, NOW)).toHaveLength(2);
  });

  it('rejects duplicate specialist domains before Executive Council can flatten them', () => {
    const evidence = ingestion();
    expect(() => createSpecialistReportsFromFcrCouncil({
      ingestion: evidence,
      transcript: transcript(`chief-ingestion:${evidence.id}`, { secondDomain: 'engineering' }),
      status: 'draft',
    }, NOW)).toThrow('one specialist contribution per domain');
  });

  it('rejects model attempts to smuggle operational reality into a specialist contribution', () => {
    const evidence = ingestion();
    const bad = transcript(`chief-ingestion:${evidence.id}`);
    bad.hops[0].specialistContribution.reality = [{
      state: 'verified',
      statement: 'Model-authored reality must not become evidence.',
    }];

    expect(() => createSpecialistReportsFromFcrCouncil({
      ingestion: evidence,
      transcript: bad,
      status: 'reviewed',
    }, NOW)).toThrow('cannot carry reality');
  });
});
