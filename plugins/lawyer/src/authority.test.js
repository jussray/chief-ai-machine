import { describe, expect, it } from 'vitest';
import {
  assertVerifiedLawPromotion,
  classifyLegalSource,
  evaluateLegalFinding,
  rankSourcesForResearch,
  sourceCanVerifyLaw,
} from './authority.js';

const officialStatute = {
  id: 'statute-1',
  name: 'Example Statute',
  sourceType: 'statute',
  sourceRole: 'primary',
  jurisdictionId: 'jurisdiction-1',
  citation: 'Example Code § 1',
  official: true,
  authentic: true,
  currentnessStatus: 'verified',
};

const treatise = {
  id: 'book-1',
  name: 'Example Treatise',
  sourceType: 'treatise',
  sourceRole: 'secondary',
  jurisdictionId: 'jurisdiction-1',
  citation: 'Example Treatise 12',
  official: false,
  authentic: false,
  currentnessStatus: 'verified',
};

describe('legal authority guard', () => {
  it('classifies books as secondary rather than governing law', () => {
    expect(classifyLegalSource(treatise)).toBe('secondary');
    expect(sourceCanVerifyLaw(treatise)).toBe(false);
  });

  it('fails closed when jurisdiction is unknown', () => {
    expect(
      evaluateLegalFinding({
        jurisdictionId: '',
        sources: [officialStatute],
      })
    ).toMatchObject({
      truthState: 'JURISDICTION UNKNOWN',
      verifiedLaw: false,
    });
  });

  it('does not allow a secondary source alone to create VERIFIED LAW', () => {
    expect(
      evaluateLegalFinding({
        jurisdictionId: 'jurisdiction-1',
        sources: [treatise],
      })
    ).toMatchObject({
      truthState: 'UNVERIFIED LAW',
      verifiedLaw: false,
    });
  });

  it('blocks primary authority that has not passed currentness verification', () => {
    const staleStatute = { ...officialStatute, currentnessStatus: 'unknown' };
    expect(sourceCanVerifyLaw(staleStatute)).toBe(false);
    expect(
      evaluateLegalFinding({
        jurisdictionId: 'jurisdiction-1',
        sources: [staleStatute],
      })
    ).toMatchObject({ truthState: 'SUPPORTED', verifiedLaw: false });
  });

  it('permits VERIFIED LAW only with qualifying current primary authority', () => {
    expect(sourceCanVerifyLaw(officialStatute)).toBe(true);
    expect(
      assertVerifiedLawPromotion({
        jurisdictionId: 'jurisdiction-1',
        sources: [officialStatute, treatise],
      })
    ).toMatchObject({
      truthState: 'VERIFIED LAW',
      verifiedLaw: true,
      authoritySourceIds: ['statute-1'],
    });
  });

  it('downgrades a proposition when unresolved contrary primary authority exists', () => {
    const contrary = {
      ...officialStatute,
      id: 'contrary-1',
      citation: 'Example Code § 2',
      resolved: false,
    };

    expect(
      evaluateLegalFinding({
        jurisdictionId: 'jurisdiction-1',
        sources: [officialStatute],
        contrarySources: [contrary],
      })
    ).toMatchObject({ truthState: 'SUPPORTED', verifiedLaw: false });
  });

  it('ranks primary authority ahead of books and discovery sources', () => {
    const discovery = {
      id: 'guide-1',
      name: 'Discovery Guide',
      sourceRole: 'discovery',
      sourceType: 'research_guide',
    };
    const ranked = rankSourcesForResearch([discovery, treatise, officialStatute]);
    expect(ranked.map((source) => source.id)).toEqual(['statute-1', 'book-1', 'guide-1']);
  });
});
