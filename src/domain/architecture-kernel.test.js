import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const REQUIRED_CORE = [
  'intent', 'north-star', 'truth', 'authority', 'state', 'continuity',
  'capability-routing', 'verification', 'proof', 'rollback', 'task-accuracy', 'outcome-learning',
];

describe('self-sufficient architecture kernel', () => {
  it('keeps Chief primary while providers remain removable plugins', () => {
    const kernel = JSON.parse(readFileSync('.control-room/architecture-kernel.json', 'utf8'));
    expect(kernel.contract).toBe('juss/self-sufficient-architecture@v1');
    expect(kernel.project).toBe('chief-ai-machine');
    expect(kernel.coreOwner).toBe('project');
    expect(new Set(kernel.coreCapabilities).size).toBe(kernel.coreCapabilities.length);
    expect(kernel.coreCapabilities).toEqual(expect.arrayContaining(REQUIRED_CORE));
    expect(kernel.externalSystems).toMatchObject({
      role: 'plugin',
      requiredForCoreBoot: false,
      mayOwnCoreCapability: false,
      mayIncreaseAuthority: false,
      silentSubstitutionAllowed: false,
      identityMustBeReceipted: true,
      failurePolicy: 'scoped-blocker',
      selectionPolicy: 'capability-fit',
      purpose: 'extend-or-accelerate',
    });
  });
});
