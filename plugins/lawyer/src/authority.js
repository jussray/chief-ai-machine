export const LEGAL_TRUTH_STATES = Object.freeze([
  'VERIFIED LAW',
  'SUPPORTED',
  'ALLEGED FACT',
  'INFERRED',
  'CONTRADICTED',
  'STALE',
  'JURISDICTION UNKNOWN',
  'UNVERIFIED LAW',
  'NOT APPLICABLE',
]);

const PRIMARY_SOURCE_TYPES = new Set([
  'constitution',
  'statute',
  'code',
  'enacted_act',
  'regulation',
  'rule',
  'official_gazette',
  'judicial_decision',
  'treaty',
  'international_instrument',
  'ordinance',
  'bylaw',
  'court_rule',
  'administrative_order',
  'administrative_decision',
  'other_primary',
]);

const SECONDARY_SOURCE_TYPES = new Set([
  'treatise',
  'hornbook',
  'practice_guide',
  'restatement',
  'legal_encyclopedia',
  'law_review',
  'commentary',
  'legal_textbook',
  'historical_legal_book',
  'article',
  'blog',
  'research_guide',
]);

function normalize(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function classifyLegalSource(source = {}) {
  const sourceType = normalize(source.sourceType).toLowerCase();
  const sourceRole = normalize(source.sourceRole).toLowerCase();

  if (sourceRole === 'primary' || PRIMARY_SOURCE_TYPES.has(sourceType)) {
    return 'primary';
  }
  if (sourceRole === 'secondary' || SECONDARY_SOURCE_TYPES.has(sourceType)) {
    return 'secondary';
  }
  if (sourceRole === 'discovery') {
    return 'discovery';
  }
  return 'unknown';
}

export function sourceCanVerifyLaw(source = {}) {
  if (classifyLegalSource(source) !== 'primary') return false;

  const jurisdictionId = normalize(source.jurisdictionId);
  const citation = normalize(source.citation || source.identifier);
  const currentness = normalize(source.currentnessStatus).toLowerCase();
  const officialOrAuthentic = source.official === true || source.authentic === true;

  return Boolean(
    jurisdictionId
      && citation
      && officialOrAuthentic
      && currentness === 'verified'
  );
}

export function evaluateLegalFinding(input = {}) {
  const jurisdictionId = normalize(input.jurisdictionId);
  const sources = Array.isArray(input.sources) ? input.sources : [];
  const contrarySources = Array.isArray(input.contrarySources) ? input.contrarySources : [];

  if (!jurisdictionId) {
    return {
      truthState: 'JURISDICTION UNKNOWN',
      verifiedLaw: false,
      reason: 'A governing jurisdiction must be resolved before law can be treated as verified.',
    };
  }

  const qualifyingPrimary = sources.filter(sourceCanVerifyLaw);
  const anyPrimary = sources.some((source) => classifyLegalSource(source) === 'primary');
  const unresolvedContraryPrimary = contrarySources.some(
    (source) => classifyLegalSource(source) === 'primary' && source.resolved !== true
  );

  if (qualifyingPrimary.length === 0) {
    return {
      truthState: anyPrimary ? 'SUPPORTED' : 'UNVERIFIED LAW',
      verifiedLaw: false,
      reason: anyPrimary
        ? 'Primary authority is present, but official/authentic status, citation, jurisdiction, or currentness is not fully verified.'
        : 'No qualifying primary-law authority supports this proposition. Secondary sources may explain or discover law but cannot verify it by themselves.',
    };
  }

  if (unresolvedContraryPrimary) {
    return {
      truthState: 'SUPPORTED',
      verifiedLaw: false,
      reason: 'Qualifying primary authority exists, but unresolved contrary primary authority prevents promotion to VERIFIED LAW.',
    };
  }

  return {
    truthState: 'VERIFIED LAW',
    verifiedLaw: true,
    reason: 'The proposition is supported by qualifying current primary authority for the resolved jurisdiction.',
    authoritySourceIds: qualifyingPrimary.map((source) => source.id).filter(Boolean),
  };
}

export function assertVerifiedLawPromotion(input = {}) {
  const result = evaluateLegalFinding(input);
  if (!result.verifiedLaw) {
    throw new Error(`VERIFIED LAW blocked: ${result.reason}`);
  }
  return result;
}

export function rankSourcesForResearch(sources = []) {
  const roleRank = { primary: 0, secondary: 1, discovery: 2, unknown: 3 };
  return [...sources].sort((a, b) => {
    const aRole = classifyLegalSource(a);
    const bRole = classifyLegalSource(b);
    if (roleRank[aRole] !== roleRank[bRole]) return roleRank[aRole] - roleRank[bRole];

    const aOfficial = a.official === true || a.authentic === true ? 0 : 1;
    const bOfficial = b.official === true || b.authentic === true ? 0 : 1;
    if (aOfficial !== bOfficial) return aOfficial - bOfficial;

    return normalize(a.name).localeCompare(normalize(b.name));
  });
}
