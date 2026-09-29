// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import { createHash } from 'node:crypto';
import { validateGithubAuthorityReceipt } from './github-authority-receipt.js';

export const GITHUB_AUTHORITY_PROVENANCE_CONTRACT = 'juss-v10/github-authority-provenance@v1';
export const GITHUB_AUTHORITY_PROVENANCE_COOKIE_CONTRACT = 'juss-v10/provenance-cookie@v1';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalSeed(receipt) {
  return JSON.stringify([
    GITHUB_AUTHORITY_PROVENANCE_CONTRACT,
    receipt.repository,
    receipt.branch,
    receipt.defaultBranch,
    receipt.sourceSha,
    receipt.observedAt,
    [...receipt.sourceRefs].sort(),
    receipt.effective,
  ]);
}

export function githubAuthorityFingerprint(receipt) {
  const validation = validateGithubAuthorityReceipt(receipt);
  if (!validation.valid) {
    throw new Error(`GitHub authority receipt is invalid: ${validation.errors.join('; ')}`);
  }
  return sha256(canonicalSeed(receipt));
}

export function createGithubAuthorityProvenance(receipt) {
  const fingerprint = githubAuthorityFingerprint(receipt);

  return Object.freeze({
    contract: GITHUB_AUTHORITY_PROVENANCE_CONTRACT,
    fingerprint,
    sourceSha: receipt.sourceSha,
    sourceRefs: Object.freeze([...receipt.sourceRefs].sort()),
    cookie: Object.freeze({
      contract: GITHUB_AUTHORITY_PROVENANCE_COOKIE_CONTRACT,
      value: `chief-github-authority-v1.${fingerprint}`,
      fingerprint,
      browserCookie: false,
      secretMaterial: false,
      actionAuthority: false,
      mergeAuthority: false,
      providerMutationAuthority: false,
      approvalAuthority: false,
      boundedToSourceSha: receipt.sourceSha,
      invalidatesOnSourceMove: true,
      invalidatesOnProviderPolicyMove: true,
      provenanceOnly: true,
    }),
  });
}
