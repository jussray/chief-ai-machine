import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const contract = JSON.parse(readFileSync(
  new URL('../config/founder-execution-kernel.consumer.json', import.meta.url),
  'utf8',
));

describe('Founder Execution Kernel consumer contract', () => {
  it('keeps Founder Control Room canonical and Chief proposal-only', () => {
    expect(contract.contract).toBe('juss/founder-execution-kernel-consumer@v1');
    expect(contract.kernelContract).toBe('juss/founder-execution-kernel@v1');
    expect(contract.canonicalSource).toEqual({
      repository: 'jussray/founder-control-room',
      path: 'docs/FOUNDER_ADAPTIVE_KERNEL_V0.md',
      role: 'canonical-governance-source',
    });
    expect(contract.consumer.repository).toBe('jussray/chief-ai-machine');
    expect(contract.consumer.role).toBe('reason-plan-propose');

    for (const field of [
      'mayGrantFounderAuthority',
      'mayGrantActionAuthority',
      'mayMerge',
      'mayDeploy',
      'mayPublish',
    ]) {
      expect(contract.consumer[field]).toBe(false);
    }
  });

  it('binds proof to exact fingerprints and keeps continuity non-authorizing', () => {
    expect(contract.fingerprintLaw).toEqual({
      evidenceBoundToExactFingerprint: true,
      headOrScopeMovementExpiresDependentProof: true,
      continuityIsDescriptiveOnly: true,
      continuityMayAuthorizeActions: false,
    });
    expect(contract.truthVocabulary).toEqual([
      'VERIFIED',
      'INFERRED',
      'UNKNOWN',
      'BLOCKED',
      'STALE',
    ]);
  });

  it('keeps any Gist mirror distribution-only', () => {
    expect(contract.portableMirror.kind).toBe('github-gist');
    expect(contract.portableMirror.distributionOnly).toBe(true);
    expect(contract.portableMirror.authority).toBe(false);
    expect(contract.portableMirror.mayPersistRuntimeState).toBe(false);
    expect(contract.portableMirror.mayCarryFounderApproval).toBe(false);
  });

  it('preserves the shared adaptive and reporting grammar', () => {
    expect(contract.adaptiveSignals).toEqual([
      'STRONGER_THAN_EXPECTED',
      'AS_EXPECTED',
      'WEAKER_THAN_EXPECTED',
      'UNEXPECTED_DIRECTION',
      'UNKNOWN',
    ]);
    expect(contract.adaptiveActions).toEqual([
      'ACCELERATE',
      'CONTINUE',
      'REPAIR',
      'REORIENT',
      'HOLD',
      'STOP',
    ]);
    expect(contract.report).toEqual([
      'REALITY',
      'FIX',
      'PROOF',
      'RISK',
      'ROLLBACK',
      'ADAPTIVE SIGNAL',
      'NEXT GATE',
    ]);
  });
});
