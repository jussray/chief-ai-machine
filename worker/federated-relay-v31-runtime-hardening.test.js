import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  handleFederatedRelayV31Runtime,
  sourceReachabilityFetchV31,
  verifySourceCommitReachabilityV31,
} from './federated-relay-v31-runtime.js';

const SOURCE_SHA = '1'.repeat(40);
const BRANCH_SHA = '2'.repeat(40);
const source = {
  member: 'founder-control-room',
  repository: 'jussray/founder-control-room',
  branch: 'fix/relay-v3-exact-base-successor-20260913',
  headSha: SOURCE_SHA,
};

function json(body, status = 200) {
  return Response.json(body, { status });
}

describe('federated relay v3.1 runtime hardening', () => {
  it('accepts a historical source commit only when the claimed branch still descends from it', async () => {
    const seen = [];
    const fetchImpl = async (input) => {
      const url = typeof input === 'string' ? input : input.url;
      seen.push(url);
      if (url.includes('/branches/')) return json({ commit: { sha: BRANCH_SHA } });
      if (url.includes(`/commits/${SOURCE_SHA}`)) return json({ sha: SOURCE_SHA });
      if (url.includes(`/compare/${SOURCE_SHA}...${BRANCH_SHA}`)) return json({ status: 'ahead' });
      throw new Error(`unexpected fetch ${url}`);
    };

    const result = await verifySourceCommitReachabilityV31(source, fetchImpl);
    expect(result).toEqual({ branchHead: BRANCH_SHA, state: 'reachable_at_acceptance' });
    expect(seen.some((url) => url.includes('/compare/'))).toBe(true);

    const verifiedFetch = sourceReachabilityFetchV31(fetchImpl, source);
    const branch = await verifiedFetch(
      `https://api.github.com/repos/${source.repository}/branches/${encodeURIComponent(source.branch)}`,
    );
    expect((await branch.json()).commit.sha).toBe(SOURCE_SHA);
  });

  it('rejects a detached or rewritten source commit instead of treating branch movement as proof', async () => {
    const fetchImpl = async (input) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/branches/')) return json({ commit: { sha: BRANCH_SHA } });
      if (url.includes(`/commits/${SOURCE_SHA}`)) return json({ sha: SOURCE_SHA });
      if (url.includes('/compare/')) return json({ status: 'diverged' });
      throw new Error(`unexpected fetch ${url}`);
    };

    await expect(verifySourceCommitReachabilityV31(source, fetchImpl))
      .rejects.toThrowError(/relay_source_history_unreachable/);
  });

  it('serves a non-revoked historical Chief signing key from the durable registry', async () => {
    const keyId = 'chief-ai-machine:relay-v3.1:retiring:old';
    const validFrom = '2026-09-13T20:00:00.000Z';
    const validUntil = '2026-09-13T21:00:00.000Z';
    const fetchImpl = async (input) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/rest/v1/federated_relay_v31_public_keys?')) {
        return json([{
          member: 'chief-ai-machine',
          key_id: keyId,
          public_key_jwk: { kty: 'OKP', crv: 'Ed25519', x: 'historical-public-key' },
          state: 'retiring',
          valid_from: validFrom,
          valid_until: validUntil,
          revoked_at: null,
        }]);
      }
      throw new Error(`unexpected fetch ${url}`);
    };
    const env = {
      RELAY_SUPABASE_URL: 'https://relay.supabase.test',
      RELAY_SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
    };
    const response = await handleFederatedRelayV31Runtime(new Request('https://chief.test/api/federated-relay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contract: 'juss/federated-agent-relay-key-query@v3.1',
        member: 'chief-ai-machine',
        keyId,
      }),
    }), env, fetchImpl);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.key.keyId).toBe(keyId);
    expect(body.key.state).toBe('retiring');
    expect(body.executionAuthorized).toBe(false);
    expect(body.authorityTransferred).toBe(false);
    expect(body.approvalCarriedForward).toBe(false);
  });

  it('keeps the source-history provider shim scoped to the exact verified source branch URL', async () => {
    const passthrough = [];
    const fetchImpl = async (input) => {
      const url = typeof input === 'string' ? input : input.url;
      passthrough.push(url);
      return json({ commit: { sha: BRANCH_SHA } });
    };
    const verifiedFetch = sourceReachabilityFetchV31(fetchImpl, source);

    const targetUrl = 'https://api.github.com/repos/jussray/chief-ai-machine/branches/main';
    const response = await verifiedFetch(targetUrl);
    expect((await response.json()).commit.sha).toBe(BRANCH_SHA);
    expect(passthrough).toEqual([targetUrl]);
  });
});

describe('federated relay v3.1 database successor contract', () => {
  const migration = readFileSync(new URL(
    '../supabase/migrations/20260913234500_federated_relay_v31_parent_reservation_hardening.sql',
    import.meta.url,
  ), 'utf8');

  it('requires reconcile before continuing from an expired outbound parent', () => {
    expect(migration).toContain('federated_relay_v31_outbound_parent_expiry_guard');
    expect(migration).toContain("new.relation_type = 'reconcile'");
    expect(migration).toContain("v_parent_envelope->>'expiresAt'");
    expect(migration).toContain('relay_parent_expired_requires_reconcile');
  });

  it('serializes draft reply reservation and reclaims only stale unsigned drafts', () => {
    const cursorLock = migration.indexOf('from public.federated_relay_outbound_cursors');
    const chainLock = migration.indexOf('from public.federated_relay_chain_cursors');
    const parentLock = migration.indexOf('from public.federated_relay_messages\n  where message_id = p_parent_message_id\n  for update');
    expect(cursorLock).toBeGreaterThan(-1);
    expect(chainLock).toBeGreaterThan(cursorLock);
    expect(parentLock).toBeGreaterThan(chainLock);
    expect(migration).toContain("v_existing.delivery_status <> 'draft'");
    expect(migration).toContain("interval '2 minutes'");
    expect(migration).toContain('relay_reply_draft_pending');
    expect(migration).toContain('delete from public.federated_relay_outbox');
    expect(migration).toContain('v_cursor.last_resolved_sequence + 1');
  });
});
