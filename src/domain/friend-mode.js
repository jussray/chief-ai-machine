// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

export const FRIEND_MODE_RULE_VERSION = 'friend-mode-shell-v1';

const DOMAIN_RULES = [
  {
    domain: 'life',
    weight: 100,
    pattern: /\b(kid|kids|child|children|school|daycare|doctor|health|safe|safety|rent|housing|home|eviction|food)\b/i,
    action: 'Handle the immediate real-world constraint first.',
  },
  {
    domain: 'money',
    weight: 85,
    pattern: /\b(money|cash|bill|bills|invoice|paid|pay|payment|revenue|runway|debt|bank|client)\b/i,
    action: 'Protect cash flow and reduce the nearest financial pressure.',
  },
  {
    domain: 'builds',
    weight: 70,
    pattern: /\b(build|ship|feature|code|launch|repo|bug|product|deploy|design|customer|offer)\b/i,
    action: 'Ship the smallest valuable build move.',
  },
  {
    domain: 'relationship',
    weight: 50,
    pattern: /\b(ex|partner|friend|family|team|cofounder|relationship|argument|reply|message)\b/i,
    action: 'Address the human thread directly and briefly.',
  },
];

const ENERGY_ADJUSTMENTS = {
  low: { builds: -15, relationship: 5 },
  medium: {},
  high: { builds: 10 },
};

function scoreDomains(text, energy) {
  const scores = {
    life: 0,
    money: 0,
    builds: 0,
    relationship: 0,
    noise: 10,
  };

  const matched = [];
  for (const rule of DOMAIN_RULES) {
    if (rule.pattern.test(text)) {
      scores[rule.domain] = rule.weight;
      matched.push(rule.domain);
    }
  }

  const adjustments = ENERGY_ADJUSTMENTS[energy] || ENERGY_ADJUSTMENTS.medium;
  for (const [domain, adjustment] of Object.entries(adjustments)) {
    scores[domain] += adjustment;
  }

  return { scores, matched };
}

function actionFor(domain, energy) {
  const rule = DOMAIN_RULES.find(item => item.domain === domain);
  const base = rule?.action || 'Compress the noise and name the next decision.';
  const energyNote = energy === 'low'
    ? ' Keep it under five minutes and avoid deep work.'
    : energy === 'high'
      ? ' Use the available energy, but keep the move reversible.'
      : ' Keep it under fifteen minutes.';
  return `${base}${energyNote}`;
}

export function resolveFriendInput(rawText, energy = 'medium') {
  const text = String(rawText || '').trim();
  const safeEnergy = Object.hasOwn(ENERGY_ADJUSTMENTS, energy) ? energy : 'medium';

  if (!text) {
    return {
      status: 'empty',
      headline: 'Tell Chief AI what is competing for your attention.',
      dominantDomain: null,
      competingDomains: [],
      action: 'Add one honest sentence. The local resolver will compress it into one move.',
      confidence: 0,
      truth: {
        verified: [],
        inferred: [],
        unknown: ['No input has been supplied.'],
        conflicted: [],
      },
      provenance: {
        ruleVersion: FRIEND_MODE_RULE_VERSION,
        providerCalls: 0,
        toolCalls: 0,
      },
    };
  }

  const { scores, matched } = scoreDomains(text, safeEnergy);
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [dominantDomain, topScore] = ranked[0];
  const competingDomains = ranked
    .slice(1)
    .filter(([, score]) => score > 10)
    .map(([domain]) => domain);
  const evidenceCount = matched.length;
  const confidence = Math.min(0.9, 0.55 + evidenceCount * 0.1);

  return {
    status: 'resolved',
    headline: `Priority resolved: ${dominantDomain}`,
    dominantDomain,
    competingDomains,
    action: actionFor(dominantDomain, safeEnergy),
    confidence,
    truth: {
      verified: ['Your exact input was captured locally for this preview.'],
      inferred: [`The rule-based resolver ranked ${dominantDomain} highest.`, `Energy was set to ${safeEnergy}.`],
      unknown: ['External facts, deadlines, balances, and prior thread state were not checked.'],
      conflicted: competingDomains.length
        ? [`${competingDomains.join(', ')} also appeared relevant but did not outrank ${dominantDomain}.`]
        : [],
    },
    provenance: {
      ruleVersion: FRIEND_MODE_RULE_VERSION,
      providerCalls: 0,
      toolCalls: 0,
      matchedDomains: matched,
      scores,
    },
  };
}
