import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const checker = fileURLToPath(new URL('../systems/skills/local-runtime-kernel/scripts/check_receipt.py', import.meta.url));
const python = `
import importlib.util
import json
import sys
spec = importlib.util.spec_from_file_location("kernel_checker", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
print(json.dumps(module.check(json.load(sys.stdin))))
`;

function violations(receipt) {
  const output = execFileSync('python3', ['-c', python, checker], {
    input: JSON.stringify(receipt),
    encoding: 'utf8',
    timeout: 10000,
  });
  return JSON.parse(output);
}

const provenActor = (actor) => ({
  status: 'PROVEN',
  actor,
  identity: ['actor-bound'],
  action: ['action-bound'],
  authority: ['scope-bound'],
});

const receipt = () => ({
  phase: 'PROVE',
  state: 'VERIFIED',
  slots: { WHAT: { status: 'PROVEN', evidence: ['observation'] } },
  must: ['WHAT'],
  prospective_authority: { status: 'PROVEN', evidence: ['approved-permission'] },
  who: { EXECUTED: provenActor('executor'), VERIFIED: provenActor('independent-verifier') },
});

describe('runtime-kernel receipt authority fails closed', () => {
  it('requires prospective authority at PERMIT, not only ATTEMPT', () => {
    const candidate = { ...receipt(), phase: 'PERMIT', state: 'UNKNOWN', prospective_authority: { status: 'UNKNOWN' } };
    expect(violations(candidate)).toContain('phase>=PERMIT without PROVEN prospective authority -> BLOCKED');
  });

  it('does not require permission authority while merely DECLARE-ing', () => {
    const candidate = { ...receipt(), phase: 'DECLARE', state: 'UNKNOWN', prospective_authority: { status: 'UNKNOWN' } };
    expect(violations(candidate)).toEqual([]);
  });

  it('rejects VERIFIED receipts with missing executor attribution', () => {
    const candidate = receipt();
    delete candidate.who.EXECUTED;
    expect(violations(candidate)).toContain('VERIFIED but WHO.EXECUTED not PROVEN');
  });

  it('rejects VERIFIED receipts with an UNKNOWN executor', () => {
    const candidate = receipt();
    candidate.who.EXECUTED = { status: 'UNKNOWN' };
    expect(violations(candidate)).toContain('VERIFIED but WHO.EXECUTED not PROVEN');
  });

  it('rejects self-certification by the executor', () => {
    const candidate = receipt();
    candidate.who.VERIFIED = provenActor('executor');
    expect(violations(candidate)).toContain('self-certification: executor == sole verifier');
  });

  it('allows a proven, independently verified receipt with sufficient evidence', () => {
    expect(violations(receipt())).toEqual([]);
  });
});
