-- Recover a Chief -> FCR v3.1 reply only after FCR has explicitly observed
-- the stored signed envelope as expired and asks Chief to reopen that exact
-- reservation. The message id, source sequence and chain position are never
-- changed, so refresh cannot mint a parallel history.
-- SOURCE ONLY: this migration does not represent a production apply.

alter table public.federated_relay_outbox
  add column if not exists resign_count integer not null default 0;

alter table public.federated_relay_outbox
  drop constraint if exists federated_relay_outbox_resign_count_check;
alter table public.federated_relay_outbox
  add constraint federated_relay_outbox_resign_count_check
  check (resign_count >= 0 and resign_count <= 3);

create or replace function public.federated_relay_refresh_expired_reply_v31(
  p_parent_message_id uuid,
  p_message_id uuid,
  p_expected_delivery_fingerprint char(64)
) returns table(
  message_id uuid,
  source_sequence bigint,
  predecessor_proof_cookie text,
  resign_count integer
) language plpgsql security definer set search_path = '' as $$
declare
  v_parent public.federated_relay_messages%rowtype;
  v_outbox public.federated_relay_outbox%rowtype;
  v_cursor public.federated_relay_outbound_cursors%rowtype;
  v_chain public.federated_relay_chain_cursors%rowtype;
  v_expires_at timestamptz;
begin
  select * into v_parent
  from public.federated_relay_messages
  where message_id = p_parent_message_id
  for update;
  if not found or v_parent.status <> 'accepted' then
    raise exception 'relay_reply_refresh_parent_invalid';
  end if;

  select * into v_outbox
  from public.federated_relay_outbox
  where message_id = p_message_id
    and parent_message_id = p_parent_message_id
    and relation_type = 'reply'
  for update;
  if not found then raise exception 'relay_reply_refresh_outbox_missing'; end if;
  if v_outbox.delivery_status <> 'signed' or v_outbox.receipt is not null or v_outbox.envelope is null then
    raise exception 'relay_reply_refresh_not_pending';
  end if;
  if v_outbox.delivery_fingerprint is distinct from p_expected_delivery_fingerprint then
    raise exception 'relay_reply_refresh_fingerprint_mismatch';
  end if;
  if v_outbox.resign_count >= 3 then raise exception 'relay_reply_refresh_limit'; end if;

  begin
    v_expires_at := (v_outbox.envelope->>'expiresAt')::timestamptz;
  exception when others then
    raise exception 'relay_reply_refresh_expiry_invalid';
  end;
  if v_expires_at is null or v_expires_at >= clock_timestamp() then
    raise exception 'relay_reply_refresh_not_expired';
  end if;

  select * into v_cursor
  from public.federated_relay_outbound_cursors
  where source_member = v_outbox.source_member
    and source_key_id = v_outbox.source_key_id
    and target_member = v_outbox.target_member
  for update;
  if not found
     or v_cursor.pending_message_id is distinct from v_outbox.message_id
     or v_cursor.pending_sequence is distinct from v_outbox.source_sequence then
    raise exception 'relay_reply_refresh_cursor_mismatch';
  end if;

  select * into v_chain
  from public.federated_relay_chain_cursors
  where chain_id = v_outbox.chain_id
  for update;
  if not found
     or v_chain.last_origin <> 'outbound'
     or v_chain.last_message_id is distinct from v_outbox.message_id
     or v_chain.last_position <> v_outbox.chain_position
     or v_chain.last_successor_cookie is distinct from v_outbox.successor_proof_cookie then
    raise exception 'relay_reply_refresh_chain_mismatch';
  end if;

  -- The caller has already received an authenticated relay_expired result from
  -- FCR. Reopen only this exact reservation and rewind the local chain tip to
  -- its accepted parent. No cursor sequence is released or incremented.
  update public.federated_relay_chain_cursors
  set last_position = v_parent.chain_position,
      last_message_id = v_parent.message_id,
      last_successor_cookie = v_parent.successor_proof_cookie,
      last_origin = 'inbound',
      updated_at = clock_timestamp()
  where chain_id = v_outbox.chain_id;

  update public.federated_relay_outbox
  set semantic_fingerprint = null,
      delivery_fingerprint = null,
      successor_proof_cookie = null,
      envelope = null,
      delivery_status = 'draft',
      signed_at = null,
      resign_count = v_outbox.resign_count + 1
  where message_id = v_outbox.message_id;

  return query
  select v_outbox.message_id,
         v_outbox.source_sequence,
         v_outbox.predecessor_proof_cookie,
         v_outbox.resign_count + 1;
end;
$$;

revoke all on function public.federated_relay_refresh_expired_reply_v31(uuid,uuid,char) from public,anon,authenticated;
grant execute on function public.federated_relay_refresh_expired_reply_v31(uuid,uuid,char) to service_role;
