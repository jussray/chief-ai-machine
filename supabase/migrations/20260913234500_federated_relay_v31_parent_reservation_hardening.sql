-- Harden federated relay v3.1 outbound-parent freshness and concurrent reply reservation.
-- SOURCE ONLY: this migration does not represent a production apply.

create or replace function public.federated_relay_v31_outbound_parent_expiry_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_envelope jsonb;
  v_expires_at timestamptz;
begin
  if new.parent_message_id is null or new.relation_type = 'reconcile' then
    return new;
  end if;

  select envelope into v_parent_envelope
  from public.federated_relay_outbox
  where message_id = new.parent_message_id;

  if not found then
    return new;
  end if;
  if v_parent_envelope is null or v_parent_envelope->>'expiresAt' is null then
    raise exception 'relay_parent_expiry_missing';
  end if;

  begin
    v_expires_at := (v_parent_envelope->>'expiresAt')::timestamptz;
  exception when others then
    raise exception 'relay_parent_expiry_invalid';
  end;

  if v_expires_at < clock_timestamp() then
    raise exception 'relay_parent_expired_requires_reconcile';
  end if;
  return new;
end;
$$;

revoke all on function public.federated_relay_v31_outbound_parent_expiry_guard() from public, anon, authenticated, service_role;

drop trigger if exists federated_relay_v31_outbound_parent_expiry_guard
  on public.federated_relay_messages;
create trigger federated_relay_v31_outbound_parent_expiry_guard
before insert on public.federated_relay_messages
for each row execute function public.federated_relay_v31_outbound_parent_expiry_guard();

create or replace function public.federated_relay_reserve_reply_v31(
  p_parent_message_id uuid,
  p_proposed_message_id uuid,
  p_source_key_id text
) returns table(
  message_id uuid,
  source_sequence bigint,
  predecessor_proof_cookie text,
  delivery_status text,
  envelope jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent public.federated_relay_messages%rowtype;
  v_chain public.federated_relay_chain_cursors%rowtype;
  v_cursor public.federated_relay_outbound_cursors%rowtype;
  v_existing public.federated_relay_outbox%rowtype;
  v_sequence bigint;
begin
  -- Read the parent once without a lock only to determine the target-scoped cursor.
  -- All state is re-read after acquiring the canonical cursor -> chain -> parent locks.
  select * into v_parent
  from public.federated_relay_messages
  where message_id = p_parent_message_id;
  if not found then raise exception 'relay_reply_parent_invalid'; end if;
  if v_parent.target_member <> 'chief-ai-machine'
     or v_parent.target_repository <> 'jussray/chief-ai-machine' then
    raise exception 'relay_reply_parent_target_invalid';
  end if;
  if p_source_key_id !~ '^[A-Za-z0-9._:-]{3,200}$' then
    raise exception 'relay_reply_key_id_invalid';
  end if;

  insert into public.federated_relay_outbound_cursors(source_member, source_key_id, target_member)
  values ('chief-ai-machine', p_source_key_id, v_parent.source_member)
  on conflict do nothing;

  -- One target-scoped cursor serializes reply reservation and draft recovery.
  select * into v_cursor
  from public.federated_relay_outbound_cursors
  where source_member = 'chief-ai-machine'
    and source_key_id = p_source_key_id
    and target_member = v_parent.source_member
  for update;

  select * into v_chain
  from public.federated_relay_chain_cursors
  where chain_id = v_parent.chain_id
  for update;
  if not found then raise exception 'relay_reply_chain_unknown'; end if;

  select * into v_parent
  from public.federated_relay_messages
  where message_id = p_parent_message_id
  for update;
  if not found or v_parent.status <> 'accepted' then
    raise exception 'relay_reply_parent_invalid';
  end if;
  if v_parent.target_member <> 'chief-ai-machine'
     or v_parent.target_repository <> 'jussray/chief-ai-machine' then
    raise exception 'relay_reply_parent_target_invalid';
  end if;
  if v_chain.last_message_id is distinct from v_parent.message_id
     or v_chain.last_position <> v_parent.chain_position
     or v_chain.last_successor_cookie <> v_parent.successor_proof_cookie
     or v_chain.last_origin <> 'inbound' then
    raise exception 'relay_reply_chain_tip_moved';
  end if;
  if v_chain.logical_operation_id is null then
    update public.federated_relay_chain_cursors
      set logical_operation_id = v_parent.logical_operation_id
      where chain_id = v_parent.chain_id;
  elsif v_chain.logical_operation_id <> v_parent.logical_operation_id then
    raise exception 'relay_reply_logical_operation_mismatch';
  end if;

  select * into v_existing
  from public.federated_relay_outbox
  where parent_message_id = p_parent_message_id
    and relation_type = 'reply'
  for update;

  if found then
    if v_existing.envelope is not null or v_existing.delivery_status <> 'draft' then
      return query
      select v_existing.message_id, v_existing.source_sequence,
             v_existing.predecessor_proof_cookie, v_existing.delivery_status,
             v_existing.envelope;
      return;
    end if;

    -- A recent unsigned draft belongs to the in-flight reserver. A concurrent
    -- exact retry must not manufacture a second signed envelope for its message id.
    if v_existing.created_at > clock_timestamp() - interval '2 minutes' then
      raise exception 'relay_reply_draft_pending';
    end if;

    -- A stale unsigned draft was never externally observable. Reclaim it while
    -- retaining last_resolved_sequence so the replacement reuses the same next sequence.
    if v_cursor.pending_message_id is distinct from v_existing.message_id
       or v_cursor.pending_sequence is distinct from v_existing.source_sequence then
      raise exception 'relay_outbound_cursor_mismatch';
    end if;
    update public.federated_relay_outbound_cursors
      set pending_sequence = null,
          pending_message_id = null,
          updated_at = clock_timestamp()
      where source_member = v_cursor.source_member
        and source_key_id = v_cursor.source_key_id
        and target_member = v_cursor.target_member;
    delete from public.federated_relay_outbox
      where message_id = v_existing.message_id;
    v_cursor.pending_sequence := null;
    v_cursor.pending_message_id := null;
  end if;

  if v_cursor.pending_message_id is not null then
    raise exception 'relay_outbound_pending';
  end if;
  v_sequence := v_cursor.last_resolved_sequence + 1;

  insert into public.federated_relay_outbox(
    message_id, source_member, source_repository, source_branch, source_head_sha, source_key_id,
    target_member, target_repository, target_branch, target_head_sha, source_sequence,
    chain_id, chain_position, logical_operation_id, relation_type, parent_message_id,
    predecessor_proof_cookie
  ) values (
    p_proposed_message_id,
    'chief-ai-machine', 'jussray/chief-ai-machine', v_parent.target_branch,
    v_parent.target_head_sha, p_source_key_id,
    v_parent.source_member, v_parent.source_repository, v_parent.source_branch,
    v_parent.source_head_sha, v_sequence,
    v_parent.chain_id, v_parent.chain_position + 1, v_parent.logical_operation_id,
    'reply', v_parent.message_id, v_parent.successor_proof_cookie
  );

  update public.federated_relay_outbound_cursors
    set pending_sequence = v_sequence,
        pending_message_id = p_proposed_message_id,
        updated_at = clock_timestamp()
    where source_member = 'chief-ai-machine'
      and source_key_id = p_source_key_id
      and target_member = v_parent.source_member;

  return query
  select p_proposed_message_id, v_sequence, v_parent.successor_proof_cookie,
         'draft'::text, null::jsonb;
end;
$$;

revoke all on function public.federated_relay_reserve_reply_v31(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.federated_relay_reserve_reply_v31(uuid,uuid,text)
  to service_role;
