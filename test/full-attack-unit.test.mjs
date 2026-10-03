import test from 'node:test';
import assert from 'node:assert/strict';
import { ATTACK_UNIT_MEMBERS, runFullAttackUnit } from '../security/full-attack-unit.mjs';

function observation(overrides = {}) {
  return {
    verdict: 'HALLWAY',
    technicalIdentity: { actorFingerprint: 'fp', claimedCrawler: 'googlebot', verifiedBot: false },
    authorization: { state: 'NOT_EVALUATED', evidenceRefs: [], derivedFromRuntimeSignals: false },
    receipt: 'a'.repeat(64),
    hallway: {
      active: true,
      logicalExpansion: 48123,
      lazyMaterialization: true,
      productionExposure: 0,
      realCustomerData: false,
      realCredentials: false,
      crossSessionSharing: false,
    },
    boundaries: {
      ownedSurfaceOnly: true,
      authorizationInferred: false,
      externalCompromise: false,
      externalExploit: false,
      outboundRetaliation: false,
    },
    ...overrides,
  };
}

test('every member executes and suspicious traffic resolves to containment without creating authorization', () => {
  const unit = runFullAttackUnit(observation());
  assert.equal(unit.mode, 'executed');
  assert.equal(unit.allMembersAccountedFor, true);
  assert.equal(unit.expectedCount, ATTACK_UNIT_MEMBERS.length);
  assert.equal(unit.executedCount, ATTACK_UNIT_MEMBERS.length);
  assert.ok(unit.results.every((item) => item.executed === true));
  assert.equal(unit.unitVerdict, 'CONTAIN_ONLY');
  assert.equal(unit.authorization.state, 'NOT_EVALUATED');
  assert.equal(unit.authorization.derivedFromRuntimeSignals, false);
  assert.equal(unit.results.find((item) => item.flow === 'truthmode')?.status, 'CLAIMED');
  assert.equal(unit.results.find((item) => item.flow === 'attack-3000')?.status, 'CHALLENGE');
  assert.equal(unit.results.find((item) => item.flow === 'redteam-ii')?.status, 'SEPARATE_AUTHORITY_CHECK');
});

test('identical containment behavior preserves a separately supplied authorization state', () => {
  const authorized = runFullAttackUnit(observation({
    authorization: { state: 'AUTHORIZED', evidenceRefs: ['authority:review-001'] },
  }));
  const unauthorized = runFullAttackUnit(observation({
    authorization: { state: 'UNAUTHORIZED', evidenceRefs: ['authority:deny-001'] },
  }));
  assert.equal(authorized.unitVerdict, unauthorized.unitVerdict);
  assert.equal(authorized.authorization.state, 'AUTHORIZED');
  assert.equal(unauthorized.authorization.state, 'UNAUTHORIZED');
  assert.equal(authorized.authorization.derivedFromRuntimeSignals, false);
  assert.equal(unauthorized.authorization.derivedFromRuntimeSignals, false);
});

test('production isolation tamper forces fail-closed cascade', () => {
  const unit = runFullAttackUnit(observation({
    hallway: { ...observation().hallway, productionExposure: 1 },
  }));
  assert.equal(unit.unitVerdict, 'REPAIR_REQUIRED');
  assert.equal(unit.results.find((item) => item.flow === 'attack-48000')?.status, 'BLOCK');
  assert.equal(unit.results.find((item) => item.flow === 'l99')?.status, 'BLOCK');
  assert.equal(unit.results.find((item) => item.flow === 'goalfix')?.status, 'REPAIR_REQUIRED');
  assert.equal(unit.results.find((item) => item.flow === 'ultrathink')?.status, 'REPAIR_REQUIRED');
});
