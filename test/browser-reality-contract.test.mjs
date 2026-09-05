import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BROWSER_REALITY_CONTRACT_ID,
  BROWSER_REALITY_FINGERPRINT_CONTRACT,
  canonicalizeBrowserRealityEvidence,
  createBrowserRealityEvidenceReceipt,
} from '../src/domain/browser-reality-evidence.js';
import { canonicalFamilies } from '../src/promptos/catalog/families.js';

const contract = JSON.parse(readFileSync(
  new URL('../config/browser-reality.contract.json', import.meta.url),
  'utf8',
));
const skill = readFileSync(
  new URL('../.agents/skills/browser-reality-inspector/SKILL.md', import.meta.url),
  'utf8',
);
const agentsContract = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8');
const cookieManifest = JSON.parse(readFileSync(
  new URL('../.security/cookies.json', import.meta.url),
  'utf8',
));
const pairContract = JSON.parse(readFileSync(
  new URL('../config/founder-chief-pair.contract.json', import.meta.url),
  'utf8',
));

const CONFORMANCE_INPUT = Object.freeze({
  contractId: 'juss/browser-reality@v1',
  authorizedInputUrl: 'HTTPS://viewer:drop-me@Example.COM:443/share/item?utm_source=chat&mibextid=track&token=drop-me&b=two&a=one#private-fragment',
  finalUrl: 'https://www.Facebook.com:443/marketplace/item/2144661676265222/?sessionid=drop-me&rdid=track&b=two&a=one#details',
  observedAt: '2026-08-29T01:02:03-04:00',
  scope: '  user-authorized target only  ',
  observations: [
    { state: 'BLOCKED', statement: 'Login required.' },
    { state: 'VERIFIED', statement: 'Marketplace redirect rendered.' },
    { state: 'INFERRED', statement: 'Target appears to be a listing.' },
    { state: 'VERIFIED', statement: 'Marketplace redirect rendered.' },
  ],
  screenshotSha256: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
});
const CONFORMANCE_CANONICAL_JSON = '{"authorizedInputUrl":"https://example.com/share/item?a=one&b=two&token=REDACTED","contractId":"juss/browser-reality@v1","finalUrl":"https://www.facebook.com/marketplace/item/2144661676265222/?a=one&b=two&sessionid=REDACTED","observations":[{"state":"VERIFIED","statement":"Marketplace redirect rendered."},{"state":"INFERRED","statement":"Target appears to be a listing."},{"state":"BLOCKED","statement":"Login required."}],"observedAt":"2026-08-29T05:02:03.000Z","scope":"user-authorized target only","screenshotSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}';
const CONFORMANCE_DIGEST = 'b638320661652bab6398f45e2b35bc343ac963bb0eb8b926462db6aea8cb1ab4';

describe('juss/browser-reality@v1', () => {
  it('defines one fail-closed read-only live-page authority contract', () => {
    expect(contract.contractId).toBe('juss/browser-reality@v1');
    expect(contract.capabilityName).toBe('browser-reality-inspector');
    expect(contract.authority).toBe('read-only');
    expect(contract.sourcePolicy.requiredSource).toBe('live-rendered-page');
    expect(contract.sourcePolicy.followNormalRedirects).toBe(true);
    expect(contract.sourcePolicy.captureFinalUrl).toBe(true);
    expect(contract.sourcePolicy.searchSnippetsAreProof).toBe(false);
    expect(contract.sourcePolicy.hiddenContentMayBeInferred).toBe(false);
    expect(contract.truthStates).toEqual(['VERIFIED', 'INFERRED', 'UNKNOWN', 'BLOCKED']);
    expect(contract.mutationPolicy.allowed).toEqual([]);
    expect(contract.stopBoundaries).toEqual([
      'login-required-without-an-existing-authenticated-session',
      'authentication-step',
      'captcha',
      'permission-prompt',
      'provider-boundary',
      'mutation-required',
      'scope-expansion-required',
    ]);
    expect(contract.evidencePolicy.captureWhenVisible).toEqual([
      'screenshots',
      'rendered-page-text',
      'content-type',
      'account-or-page-name',
      'media-description',
      'date-or-time',
      'price-or-location',
      'engagement-counts',
      'external-links',
    ]);
    expect(contract.evidenceFingerprint.fields).toEqual([
      'contractId',
      'authorizedInputUrl',
      'finalUrl',
      'observedAt',
      'scope',
      'observations',
      'screenshotSha256',
    ]);
    expect(contract.evidenceFingerprint.conformanceSha256).toBe(CONFORMANCE_DIGEST);
  });

  it('preserves first-party continuity without adding tracking or a cookie writer', () => {
    const continuity = contract.continuityPolicy;
    expect(continuity.cookies.policy).toBe('browser-held-first-party-session-only');
    expect(continuity.cookies.reuseWhenAppropriate).toBe(true);
    for (const key of [
      'inspectContents',
      'extractContents',
      'exportContents',
      'copyContents',
      'logContents',
      'alterContents',
      'synthesizeContents',
    ]) {
      expect(continuity.cookies[key]).toBe(false);
    }
    expect(continuity.cookies.crossSiteTracking).toBe(false);
    expect(cookieManifest.cookies).toEqual([]);
    expect(cookieManifest.allowedCookieWriters).toEqual([]);

    expect(continuity.pseudonymousId.createByDefault).toBe(false);
    expect(continuity.pseudonymousId.generation).toBe('cryptographically-random');
    expect(continuity.pseudonymousId.deviceDerived).toBe(false);
    expect(continuity.pseudonymousId.crossSiteCorrelation).toBe(false);
    expect(continuity.pseudonymousId.requiredProperties).toEqual(expect.arrayContaining([
      'cryptographically-random',
      'first-party',
      'purpose-limited',
      'resettable',
      'disclosed',
      'consent-aware',
    ]));

    expect(continuity.deviceFingerprinting.allowed).toBe(false);
    expect(continuity.deviceFingerprinting.alterationAllowed).toBe(false);
    expect(continuity.deviceFingerprinting.crossSiteTrackingAllowed).toBe(false);
    expect(continuity.deviceFingerprinting.prohibitedEntropySources).toEqual([
      'canvas',
      'webgl',
      'audio',
      'fonts',
      'user-agent',
      'hardware-signal-aggregation',
    ]);
  });

  it('matches the cross-repository canonical JSON and SHA-256 conformance vector', () => {
    const result = canonicalizeBrowserRealityEvidence(CONFORMANCE_INPUT);
    expect(result.canonicalJson).toBe(CONFORMANCE_CANONICAL_JSON);
    expect(result.digest).toBe(CONFORMANCE_DIGEST);
    expect(result.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(result.canonical.observations).toEqual([
      { state: 'VERIFIED', statement: 'Marketplace redirect rendered.' },
      { state: 'INFERRED', statement: 'Target appears to be a listing.' },
      { state: 'BLOCKED', statement: 'Login required.' },
    ]);
  });

  it('is stable across input ordering and sensitive URL material', () => {
    const reordered = {
      observations: [...CONFORMANCE_INPUT.observations].reverse(),
      scope: CONFORMANCE_INPUT.scope,
      observedAt: CONFORMANCE_INPUT.observedAt,
      finalUrl: CONFORMANCE_INPUT.finalUrl,
      authorizedInputUrl: CONFORMANCE_INPUT.authorizedInputUrl,
      screenshotSha256: CONFORMANCE_INPUT.screenshotSha256,
      contractId: CONFORMANCE_INPUT.contractId,
    };
    const result = canonicalizeBrowserRealityEvidence(reordered);
    expect(result.digest).toBe(CONFORMANCE_DIGEST);
    expect(result.canonical.authorizedInputUrl).toBe(
      'https://example.com/share/item?a=one&b=two&token=REDACTED',
    );
    expect(result.canonical.finalUrl).toBe(
      'https://www.facebook.com/marketplace/item/2144661676265222/?a=one&b=two&sessionid=REDACTED',
    );
    for (const forbiddenValue of [
      'viewer',
      'drop-me',
      'private-fragment',
      'details',
      'utm_source',
      'mibextid',
      'rdid',
    ]) {
      expect(result.canonicalJson).not.toContain(forbiddenValue);
    }
  });

  it('sanitizes every shared sensitive key and preserves IPv6 host brackets', () => {
    const sensitiveKeys = [
      'accesstoken', 'apikey', 'auth', 'authorization', 'clientsecret', 'code',
      'connectsid', 'cookie', 'cookies', 'credential', 'credentials', 'csrftoken',
      'encryptedcontext', 'idtoken', 'jsessionid', 'jwt', 'key', 'oauth', 'oauthtoken', 'password',
      'phpsessid', 'refreshtoken', 'secret', 'session', 'sessionid', 'sid', 'sig',
      'signature', 'state', 'token', 'xsrftoken',
    ];
    const query = sensitiveKeys.map((key) => `${key}=private`).join('&');
    const result = canonicalizeBrowserRealityEvidence({
      ...CONFORMANCE_INPUT,
      authorizedInputUrl: `https://[2001:db8::1]:443/path?${query}&share_url=drop&utm_medium=drop&safe=keep#drop`,
    });
    expect(result.canonical.authorizedInputUrl).toContain('https://[2001:db8::1]/path?');
    expect(result.canonical.authorizedInputUrl).toContain('safe=keep');
    expect(result.canonical.authorizedInputUrl).not.toContain('share_url');
    expect(result.canonical.authorizedInputUrl).not.toContain('utm_medium');
    expect(result.canonical.authorizedInputUrl).not.toContain('private');
    for (const key of sensitiveKeys) {
      expect(result.canonical.authorizedInputUrl).toContain(`${key}=REDACTED`);
    }
  });

  it('redacts provider encrypted_context values without changing the evidence hash', () => {
    const first = canonicalizeBrowserRealityEvidence({
      ...CONFORMANCE_INPUT,
      finalUrl: 'https://www.facebook.com/two_step_verification/authentication/?encrypted_context=provider-secret-one',
    });
    const second = canonicalizeBrowserRealityEvidence({
      ...CONFORMANCE_INPUT,
      finalUrl: 'https://www.facebook.com/two_step_verification/authentication/?encrypted_context=provider-secret-two',
    });
    expect(first.canonical.finalUrl).toContain('encrypted_context=REDACTED');
    expect(first.canonicalJson).not.toContain('provider-secret-one');
    expect(second.canonicalJson).not.toContain('provider-secret-two');
    expect(first.digest).toBe(second.digest);
  });

  it('recursively sanitizes nested redirect URLs and redacts beyond depth three', () => {
    const nestedOne = 'https://viewer:first-secret@inner.example/path?token=provider-one&utm_source=drop#private';
    const nestedTwo = 'https://viewer:second-secret@inner.example/path?token=provider-two&utm_source=other#different';
    const first = canonicalizeBrowserRealityEvidence({
      ...CONFORMANCE_INPUT,
      authorizedInputUrl: `https://outer.example/?next=${encodeURIComponent(nestedOne)}`,
    });
    const second = canonicalizeBrowserRealityEvidence({
      ...CONFORMANCE_INPUT,
      authorizedInputUrl: `https://outer.example/?next=${encodeURIComponent(nestedTwo)}`,
    });
    expect(first.digest).toBe(second.digest);
    expect(first.canonical.authorizedInputUrl).toContain(
      'next=https%3A%2F%2Finner.example%2Fpath%3Ftoken%3DREDACTED',
    );
    for (const secret of ['first-secret', 'provider-one', 'private']) {
      expect(first.canonicalJson).not.toContain(secret);
    }

    const levelFour = 'https://level-four.example/?token=deep-secret';
    const levelThree = `https://level-three.example/?next=${encodeURIComponent(levelFour)}`;
    const levelTwo = `https://level-two.example/?next=${encodeURIComponent(levelThree)}`;
    const levelOne = `https://level-one.example/?next=${encodeURIComponent(levelTwo)}`;
    const bounded = canonicalizeBrowserRealityEvidence({
      ...CONFORMANCE_INPUT,
      authorizedInputUrl: `https://outer.example/?next=${encodeURIComponent(levelOne)}`,
    });
    expect(decodeURIComponent(bounded.canonical.authorizedInputUrl)).toContain('REDACTED_NESTED_URL');
    expect(bounded.canonicalJson).not.toContain('deep-secret');
  });

  it('changes the digest when any variable load-bearing field changes', () => {
    const variants = [
      { authorizedInputUrl: 'https://example.com/share/item?a=changed' },
      { finalUrl: 'https://www.facebook.com/marketplace/item/different/' },
      { observedAt: '2026-08-29T05:02:04.000Z' },
      { scope: 'different authorized scope' },
      { observations: [{ state: 'VERIFIED', statement: 'Different rendered state.' }] },
      { screenshotSha256: 'b'.repeat(64) },
    ];
    for (const change of variants) {
      expect(canonicalizeBrowserRealityEvidence({ ...CONFORMANCE_INPUT, ...change }).digest)
        .not.toBe(CONFORMANCE_DIGEST);
    }
    expect(() => canonicalizeBrowserRealityEvidence({
      ...CONFORMANCE_INPUT,
      contractId: 'juss/browser-reality@v2',
    })).toThrow(/contractId must be juss\/browser-reality@v1/);
  });

  it('normalizes NFC text and query material before hashing', () => {
    const decomposed = canonicalizeBrowserRealityEvidence({
      ...CONFORMANCE_INPUT,
      authorizedInputUrl: 'https://example.com/?na%CC%88me=cafe%CC%81',
      scope: 'purpose cafe\u0301',
      observations: [{ state: 'VERIFIED', statement: 'Rendered cafe\u0301.' }],
    });
    const composed = canonicalizeBrowserRealityEvidence({
      ...CONFORMANCE_INPUT,
      authorizedInputUrl: 'https://example.com/?n%C3%A4me=caf%C3%A9',
      scope: 'purpose café',
      observations: [{ state: 'VERIFIED', statement: 'Rendered café.' }],
    });
    expect(decomposed.canonical).toEqual(composed.canonical);
    expect(decomposed.digest).toBe(composed.digest);
  });

  it('enforces strict plain objects, uppercase states, and shared bounds', () => {
    const inherited = Object.assign(Object.create({ inherited: true }), CONFORMANCE_INPUT);
    expect(() => canonicalizeBrowserRealityEvidence(inherited)).toThrow(/plain object/);
    expect(() => canonicalizeBrowserRealityEvidence({
      ...CONFORMANCE_INPUT,
      observations: [{ state: 'verified', statement: 'Wrong case.' }],
    })).toThrow(/state is unsupported/);
    expect(() => canonicalizeBrowserRealityEvidence({
      ...CONFORMANCE_INPUT,
      observations: [{ state: ' VERIFIED ', statement: 'Whitespace must not normalize the state.' }],
    })).toThrow(/state is unsupported/);
    expect(() => canonicalizeBrowserRealityEvidence({
      ...CONFORMANCE_INPUT,
      observations: [{ state: 'VE\u0301RIFIED', statement: 'NFC must not normalize the state.' }],
    })).toThrow(/state is unsupported/);
    const parserWhitespace = canonicalizeBrowserRealityEvidence({
      ...CONFORMANCE_INPUT,
      authorizedInputUrl: ` ${CONFORMANCE_INPUT.authorizedInputUrl} `,
    });
    expect(parserWhitespace.canonical.authorizedInputUrl).toBe(
      'https://example.com/share/item?a=one&b=two&token=REDACTED',
    );
    expect(() => canonicalizeBrowserRealityEvidence({
      ...CONFORMANCE_INPUT,
      authorizedInputUrl: `https://example.com/?q=${'a'.repeat(4096)}`,
    })).toThrow(/no longer than 4096/);
    expect(() => canonicalizeBrowserRealityEvidence({
      ...CONFORMANCE_INPUT,
      observedAt: ` ${CONFORMANCE_INPUT.observedAt} `,
    })).toThrow(/valid timestamp/);
    expect(() => canonicalizeBrowserRealityEvidence({
      ...CONFORMANCE_INPUT,
      scope: 'a'.repeat(161),
    })).toThrow(/scope exceeds 160/);
    expect(() => canonicalizeBrowserRealityEvidence({
      ...CONFORMANCE_INPUT,
      observations: Array.from({ length: 65 }, (_, index) => ({
        state: 'VERIFIED',
        statement: `Observation ${index}`,
      })),
    })).toThrow(/observations exceeds 64/);
    expect(() => canonicalizeBrowserRealityEvidence({
      ...CONFORMANCE_INPUT,
      observations: [{ state: 'VERIFIED', statement: 'a'.repeat(1001) }],
    })).toThrow(/statement exceeds 1000/);
  });

  it('NFC-normalizes query material without trimming or collapsing it', () => {
    const result = canonicalizeBrowserRealityEvidence({
      ...CONFORMANCE_INPUT,
      authorizedInputUrl: 'https://example.com/?note=%20cafe%CC%81%20%20value%20',
    });
    expect(result.canonical.authorizedInputUrl).toBe(
      'https://example.com/?note=+caf%C3%A9++value+',
    );
  });

  it('fails closed on forbidden identity/session fields and malformed screenshots', () => {
    for (const field of [
      'cookieValues',
      'accessToken',
      'deviceEntropy',
      'userId',
      'unrelatedPrivateData',
    ]) {
      expect(() => canonicalizeBrowserRealityEvidence({
        ...CONFORMANCE_INPUT,
        [field]: 'must-not-enter-the-receipt',
      })).toThrow(/forbidden field/);
    }
    expect(() => canonicalizeBrowserRealityEvidence({
      ...CONFORMANCE_INPUT,
      observations: [{ state: 'VERIFIED', statement: 'Rendered.', userId: 'nope' }],
    })).toThrow(/forbidden field/);
    expect(() => canonicalizeBrowserRealityEvidence({
      ...CONFORMANCE_INPUT,
      screenshotSha256: 'not-a-sha256',
    })).toThrow(/64-character SHA-256/);
    expect(() => canonicalizeBrowserRealityEvidence({
      ...CONFORMANCE_INPUT,
      screenshotSha256: ` ${'a'.repeat(64)} `,
    })).toThrow(/64-character SHA-256/);
    expect(() => canonicalizeBrowserRealityEvidence({
      ...CONFORMANCE_INPUT,
      screenshotSha256: undefined,
    })).toThrow(/64-character SHA-256/);
    const missingRequired = { ...CONFORMANCE_INPUT };
    delete missingRequired.finalUrl;
    expect(() => canonicalizeBrowserRealityEvidence(missingRequired)).toThrow(/finalUrl is required/);
  });

  it('creates an evidence-only fingerprint receipt, never an identity', () => {
    const receipt = createBrowserRealityEvidenceReceipt(CONFORMANCE_INPUT);
    expect(receipt.contractId).toBe(BROWSER_REALITY_CONTRACT_ID);
    expect(receipt.evidenceFingerprint).toEqual({
      contract: BROWSER_REALITY_FINGERPRINT_CONTRACT,
      algorithm: 'sha256',
      digest: CONFORMANCE_DIGEST,
      purpose: 'evidence-binding-not-person-or-device-identity',
      identityUse: 'forbidden',
      crossSiteCorrelation: false,
    });
  });

  it('keeps browser-reality authority in its dedicated contract without widening the shared pair contract', () => {
    expect(pairContract.contractVersion).toBe('2026-08-09.1');
    expect(pairContract.browserReality).toBeUndefined();
    expect(contract.contractId).toBe('juss/browser-reality@v1');
    expect(contract.capabilityName).toBe('browser-reality-inspector');
    expect(contract.authority).toBe('read-only');
    expect(contract.truthStates).toEqual(['VERIFIED', 'INFERRED', 'UNKNOWN', 'BLOCKED']);
    expect(contract.stopBoundaries).toEqual([
      'login-required-without-an-existing-authenticated-session',
      'authentication-step',
      'captcha',
      'permission-prompt',
      'provider-boundary',
      'mutation-required',
      'scope-expansion-required',
    ]);
    expect(contract.evidenceFingerprint.conformanceSha256).toBe(CONFORMANCE_DIGEST);
  });

  it('keeps the repo skill and PromptOS family bound to the same contract', () => {
    expect(skill).toContain('name: browser-reality-inspector');
    expect(skill).toContain('contract: "juss/browser-reality@v1"');
    expect(skill).toContain('../../../config/browser-reality.contract.json');
    expect(skill).toContain('Stop and report the exact blocker');
    expect(agentsContract).toContain('.agents/skills/browser-reality-inspector/SKILL.md');
    expect(agentsContract).toContain('juss-browser-reality-canonical-json-v1');

    const family = canonicalFamilies['browser.reality.inspector'];
    expect(family).toBeDefined();
    expect(family.pack).toBe('browser-evidence');
    expect(family.baseClauseIds).toEqual(expect.arrayContaining([
      'role.browser-reality-inspector',
      'method.browser-reality-inspection',
      'guardrail.browser-reality-privacy',
      'evidence.browser-reality-fingerprint',
      'output.browser-reality-report',
    ]));
    expect(contract.outputSections).toEqual([
      'REALITY',
      'TARGET',
      'CONTENT',
      'PROOF',
      'RED TEAM',
      'BLOCKERS',
      'NEXT GATE',
    ]);
  });
});
