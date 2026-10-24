import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const refreshSql = readFileSync(
  new URL('../supabase/migrations/20260913232000_federated_relay_v31_expired_reply_refresh.sql', import.meta.url),
  'utf8',
);
const reserveSql = readFileSync(
  new URL('../supabase/migrations/20260913205100_federated_relay_v31_reply_reservation_race.sql', import.meta.url),
  'utf8',
);

describe('federated relay v3.1 expired reply migration contract', () => {
  it('refreshes only the exact unresolved signed reply and never allocates a new identity', () => {
    expect(refreshSql).toContain("v_outbox.delivery_status <> 'signed'");
    expect(refreshSql).toContain('v_outbox.receipt is not null');
    expect(refreshSql).toContain('v_outbox.delivery_fingerprint is distinct from p_expected_delivery_fingerprint');
    expect(refreshSql).toContain('v_cursor.pending_message_id is distinct from v_outbox.message_id');
    expect(refreshSql).toContain('v_cursor.pending_sequence is distinct from v_outbox.source_sequence');
    expect(refreshSql).toContain('v_chain.last_message_id is distinct from v_outbox.message_id');
    expect(refreshSql).toContain('v_chain.last_position <> v_outbox.chain_position');
    expect(refreshSql).toContain("delivery_status = 'draft'");
    expect(refreshSql).toContain('resign_count = v_outbox.resign_count + 1');
    expect(refreshSql).not.toMatch(/insert\s+into\s+public\.federated_relay_outbox/i);
    expect(refreshSql).not.toMatch(/pending_sequence\s*=\s*[^,;]*\+/i);
  });

  it('reuses the refreshed outbox row before any new reply reservation can be created', () => {
    const firstExistingLookup = reserveSql.indexOf('select * into v_existing');
    const firstInsert = reserveSql.indexOf('insert into public.federated_relay_outbox');
    expect(firstExistingLookup).toBeGreaterThanOrEqual(0);
    expect(firstInsert).toBeGreaterThan(firstExistingLookup);
    expect(reserveSql.slice(firstExistingLookup, firstInsert)).toContain(
      'return query select v_existing.message_id, v_existing.source_sequence, v_existing.predecessor_proof_cookie, v_existing.delivery_status, v_existing.envelope',
    );
  });

  it('keeps refresh service-role-only and bounded', () => {
    expect(refreshSql).toContain('resign_count >= 0 and resign_count <= 3');
    expect(refreshSql).toContain('v_outbox.resign_count >= 3');
    expect(refreshSql).toContain('v_expires_at >= clock_timestamp()');
    expect(refreshSql).toContain('revoke all on function public.federated_relay_refresh_expired_reply_v31');
    expect(refreshSql).toContain('grant execute on function public.federated_relay_refresh_expired_reply_v31(uuid,uuid,char) to service_role');
  });
});
