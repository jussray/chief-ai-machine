// Advisory-only NVIDIA skill planner for the Chief AI development workflow.
// This file deliberately has no model, filesystem, credential, or network access.
// Do NOT treat caller-provided text as authentication or execution permission.
const ROUTES = Object.freeze({
  'jussray/Sekret-Bip': Object.freeze({
    'speech-evaluation': Object.freeze({
      providerSkills: Object.freeze(['nemotron-speech']),
      localSkills: Object.freeze([
        '.agents/skills/bip-repo-truth/SKILL.md',
        '.agents/skills/bip-voice-guard/SKILL.md',
        '.agents/skills/bip-ai-review/SKILL.md',
        '.agents/skills/bip-privacy-redteam/SKILL.md',
        '.agents/skills/bip-worker-guardian/SKILL.md',
        '.agents/skills/bip-typescript-behavior-tests/SKILL.md',
        '.agents/skills/bip-sekret-identity/SKILL.md',
        '.agents/skills/bip-nvidia-speech-evaluation/SKILL.md',
      ]),
      evaluation: 'Synthetic speech samples only. Compare STT/TTS quality, latency, cost, and safe fallback behavior.',
    }),
    'policy-review': Object.freeze({
      providerSkills: Object.freeze(['nemotron-policy-generator']),
      localSkills: Object.freeze([
        '.agents/skills/bip-repo-truth/SKILL.md',
        '.agents/skills/bip-sekret-identity/SKILL.md',
        '.agents/skills/bip-voice-guard/SKILL.md',
        '.agents/skills/bip-privacy-redteam/SKILL.md',
        '.agents/skills/bip-ai-review/SKILL.md',
        '.agents/skills/bip-worker-guardian/SKILL.md',
        '.agents/skills/bip-typescript-behavior-tests/SKILL.md',
        '.agents/skills/bip-nvidia-speech-evaluation/SKILL.md',
      ]),
      evaluation: 'Evaluate proposed policies with synthetic cases. Never replace existing teen or parent safeguards.',
    }),
  }),
  'jussray/chief-ai-machine': Object.freeze({
    'retrieval-evaluation': Object.freeze({
      providerSkills: Object.freeze(['nemo-retriever', 'rag-eval']),
      localSkills: Object.freeze([
        '.agents/skills/goalfix/SKILL.md',
        '.claude/skills/juss-chief-ai/SKILL.md',
        '.claude/skills/repo-truth/SKILL.md',
        '.claude/skills/evidence-decision-loop/SKILL.md',
        '.agents/skills/nvidia-capability-evaluation/SKILL.md',
      ]),
      evaluation: 'Compare retrieval quality on invented, non-sensitive documents. No company-brain sync or provider traffic by default.',
    }),
  }),
});

const NO_ROUTE = Object.freeze({
  status: 'NO_MATCH',
  integrationState: 'ABSENT',
  executionAuthority: 'none',
  providerEnabled: false,
  maySendPrivateData: false,
});

// Avoid evaluating getters or inherited properties from untrusted inputs.
function ownDataValue(object, key) {
  if (object === null || typeof object !== 'object' || Array.isArray(object)) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
  } catch { return undefined; } // hostile Proxy: fail closed
}

export function planNvidiaSkillEvaluation(input) {
  const repository = ownDataValue(input, 'repository');
  const objective = ownDataValue(input, 'objective');
  if (typeof repository !== 'string' || typeof objective !== 'string') return NO_ROUTE;
  if (!Object.hasOwn(ROUTES, repository)) return NO_ROUTE;
  const goals = ROUTES[repository];
  if (!Object.hasOwn(goals, objective)) return NO_ROUTE;
  const definition = goals[objective];
  return Object.freeze({
    status: 'ADVISORY_ONLY',
    // Founder provider-state enum: ABSENT until a separately approved, real-path
    // proof promotes it. This planner can never promote its own state.
    integrationState: 'ABSENT',
    repository,
    objective,
    executionAuthority: 'none',
    providerEnabled: false,
    maySendPrivateData: false,
    dataPolicy: 'invented-or-explicitly-approved-test-data-only',
    providerSkills: definition.providerSkills,
    localSkills: definition.localSkills,
    evaluation: definition.evaluation,
    requiredGates: Object.freeze([
      'founder exact-scope approval before installation or source changes',
      'privacy, safety, and consent review before provider transmission',
      'separate approval before credentials, paid services, production deployment, or publication',
      'tests and exact-head evidence before merge or release claims',
    ]),
  });
}
