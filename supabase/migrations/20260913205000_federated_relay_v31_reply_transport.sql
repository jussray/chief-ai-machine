-- Chief federated relay v3.1 durable outbound reply support.
-- SOURCE ONLY: this migration does not represent a production apply.

alter table public.federated_relay_chain_cursors
  add column if not exists logical_operation_id uuid,
  add column if not exists last_origin text;

alter table public.federated_relay_chain_cursors
  drop constraint if exists federated_relay_chain_cursors_last_origin_check;
alter table public.federated_relay_chain_cursors
  add constraint federated_relay_chain_cursors_last_origin_check
  check (last_origin is null or last_origin in ('inbound','outbound'));

update public.federated_relay_chain_cursors c
set logical_operation_id = m.logical_operation_id,
    last_origin = case when c.last_message_id is null then null else 'inbound' end
from public.federated_relay_messages m
where c.last_message_id = m.message_id
  and (c.logical_operation_id is null or c.last_origin is null);

alter table public.federated_relay_messages
  drop constraint if exists federated_relay_messages_parent_message_id_fkey,
  drop constraint if exists federated_relay_messages_reply_to_message_id_fkey;

create table if not exists public.federated_relay_outbound_cursors (
  source_member text not null,
  source_key_id text not null,
  target_member text not null,
  last_resolved_sequence bigint not null default -1,
  pending_sequence bigint,
  pending_message_id uuid,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (source_member, source_key_id, target_member),
  constraint federated_relay_outbound_cursor_nonnegative check (last_resolved_sequence >= -1),
  constraint federated_relay_outbound_pending_pair check ((pending_sequence is null) = (pending_message_id is null))
);

create table if not exists public.federated_relay_outbox (
  message_id uuid primary key,
  source_member text not null,
  source_repository text not null,
  source_branch text not null,
  source_head_sha char(40) not null,
  source_key_id text not null,
  target_member text not null,
  target_repository text not null,
  target_branch text not null,
  target_head_sha char(40) not null,
  source_sequence bigint not null,
  chain_id uuid not null,
  chain_position bigint not null,
  logical_operation_id uuid not null,
  relation_type text not null,
  parent_message_id uuid,
  predecessor_proof_cookie text not null,
  semantic_fingerprint char(64),
  delivery_fingerprint char(64),
  successor_proof_cookie text,
  envelope jsonb,
  delivery_status text not null default 'draft',
  receipt jsonb,
  remote_current_state text,
  remote_superseded_by_message_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  signed_at timestamptz,
  resolved_at timestamptz,
  unique (source_member, source_key_id, target_member, source_sequence),
  unique (chain_id, chain_position),
  constraint federated_relay_outbox_sha check (source_head_sha ~ '^[0-9a-f]{40}$' and target_head_sha ~ '^[0-9a-f]{40}$'),
  constraint federated_relay_outbox_sequence check (source_sequence >= 0 and chain_position >= 0),
  constraint federated_relay_outbox_relation check (relation_type = 'reply'),
  constraint federated_relay_outbox_status check (delivery_status in ('draft','signed','accepted','duplicate')),
  constraint federated_relay_outbox_remote_state check (remote_current_state is null or remote_current_state in ('accepted','superseded','revoked'))
);

create unique index if not exists federated_relay_outbox_one_reply_per_parent
  on public.federated_relay_outbox(parent_message_id)
  where relation_type = 'reply';

alter table public.federated_relay_outbound_cursors enable row level security;
alter table public.federated_relay_outbox enable row level security;
revoke all on public.federated_relay_outbound_cursors, public.federated_relay_outbox from public, anon, authenticated, service_role;
grant select on public.federated_relay_outbox to service_role;

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
) language plpgsql security definer set search_path = '' as $$
declare
  v_parent public.federated_relay_messages%rowtype;
  v_chain public.federated_relay_chain_cursors%rowtype;
  v_cursor public.federated_relay_outbound_cursors%rowtype;
  v_existing public.federated_relay_outbox%rowtype;
  v_sequence bigint;
begin
  select * into v_existing
  from public.federated_relay_outbox
  where parent_message_id = p_parent_message_id and relation_type = 'reply';
  if found then
    return query select v_existing.message_id, v_existing.source_sequence, v_existing.predecessor_proof_cookie, v_existing.delivery_status, v_existing.envelope;
    return;
  end if;

  select * into v_parent from public.federated_relay_messages where message_id = p_parent_message_id for update;
  if not found or v_parent.status <> 'accepted' then raise exception 'relay_reply_parent_invalid'; end if;
  if v_parent.target_member <> 'chief-ai-machine' or v_parent.target_repository <> 'jussray/chief-ai-machine' then raise exception 'relay_reply_parent_target_invalid'; end if;
  if p_source_key_id !~ '^[A-Za-z0-9._:-]{3,200}$' then raise exception 'relay_reply_key_id_invalid'; end if;

  select * into v_chain from public.federated_relay_chain_cursors where chain_id = v_parent.chain_id for update;
  if not found or v_chain.last_message_id is distinct from v_parent.message_id or v_chain.last_position <> v_parent.chain_position
     or v_chain.last_successor_cookie <> v_parent.successor_proof_cookie or v_chain.last_origin <> 'inbound' then
    raise exception 'relay_reply_chain_tip_moved';
  end if;
  if v_chain.logical_operation_id is null then
    update public.federated_relay_chain_cursors
      set logical_operation_id = v_parent.logical_operation_id
      where chain_id = v_parent.chain_id;
  elsif v_chain.logical_operation_id <> v_parent.logical_operation_id then
    raise exception 'relay_reply_logical_operation_mismatch';
  end if;

  insert into public.federated_relay_outbound_cursors(source_member, source_key_id, target_member)
  values ('chief-ai-machine', p_source_key_id, v_parent.source_member)
  on conflict do nothing;
  select * into v_cursor from public.federated_relay_outbound_cursors
    where source_member = 'chief-ai-machine' and source_key_id = p_source_key_id and target_member = v_parent.source_member
    for update;
  if v_cursor.pending_message_id is not null then raise exception 'relay_outbound_pending'; end if;
  v_sequence := v_cursor.last_resolved_sequence + 1;

  insert into public.federated_relay_outbox(
    message_id, source_member, source_repository, source_branch, source_head_sha, source_key_id,
    target_member, target_repository, target_branch, target_head_sha, source_sequence,
    chain_id, chain_position, logical_operation_id, relation_type, parent_message_id, predecessor_proof_cookie
  ) values (
    p_proposed_message_id, 'chief-ai-machine', 'jussray/chief-ai-machine', v_parent.target_branch, v_parent.target_head_sha, p_source_key_id,
    v_parent.source_member, v_parent.source_repository, v_parent.source_branch, v_parent.source_head_sha, v_sequence,
    v_parent.chain_id, v_parent.chain_position + 1, v_parent.logical_operation_id, 'reply', v_parent.message_id, v_parent.successor_proof_cookie
  );
  update public.federated_relay_outbound_cursors
    set pending_sequence = v_sequence, pending_message_id = p_proposed_message_id, updated_at = clock_timestamp()
    where source_member = 'chief-ai-machine' and source_key_id = p_source_key_id and target_member = v_parent.source_member;

  return query select p_proposed_message_id, v_sequence, v_parent.successor_proof_cookie, 'draft'::text, null::jsonb;
end;
$$;

create or replace function public.federated_relay_finalize_reply_v31(
  p_message_id uuid,
  p_semantic_fingerprint char(64),
  p_delivery_fingerprint char(64),
  p_successor_proof_cookie text,
  p_envelope jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_outbox public.federated_relay_outbox%rowtype;
  v_cursor public.federated_relay_outbound_cursors%rowtype;
  v_chain public.federated_relay_chain_cursors%rowtype;
begin
  select * into v_outbox from public.federated_relay_outbox where message_id = p_message_id;
  if not found then raise exception 'relay_outbox_missing'; end if;
  select * into v_cursor from public.federated_relay_outbound_cursors
    where source_member = v_outbox.source_member and source_key_id = v_outbox.source_key_id and target_member = v_outbox.target_member for update;
  select * into v_chain from public.federated_relay_chain_cursors where chain_id = v_outbox.chain_id for update;
  select * into v_outbox from public.federated_relay_outbox where message_id = p_message_id for update;

  if v_outbox.delivery_status <> 'draft' then
    if v_outbox.delivery_fingerprint = p_delivery_fingerprint then return; end if;
    raise exception 'relay_outbox_finalization_collision';
  end if;
  if v_cursor.pending_message_id is distinct from p_message_id or v_cursor.pending_sequence is distinct from v_outbox.source_sequence then raise exception 'relay_outbound_cursor_mismatch'; end if;
  if v_chain.last_origin <> 'inbound' or v_chain.last_message_id is distinct from v_outbox.parent_message_id
     or v_chain.last_position + 1 <> v_outbox.chain_position or v_chain.last_successor_cookie <> v_outbox.predecessor_proof_cookie then
    raise exception 'relay_chain_tip_moved';
  end if;
  if p_semantic_fingerprint !~ '^[0-9a-f]{64}$' or p_delivery_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'relay_fingerprint_invalid'; end if;
  if p_envelope->>'contract' <> 'juss/federated-agent-relay@v3.1' or p_envelope->>'messageId' <> p_message_id::text
     or p_envelope->'ordering'->>'sourceSequence' <> v_outbox.source_sequence::text then raise exception 'relay_outbox_envelope_binding_invalid'; end if;

  update public.federated_relay_outbox
    set semantic_fingerprint = p_semantic_fingerprint, delivery_fingerprint = p_delivery_fingerprint,
        successor_proof_cookie = p_successor_proof_cookie, envelope = p_envelope,
        delivery_status = 'signed', signed_at = clock_timestamp()
    where message_id = p_message_id;
  update public.federated_relay_chain_cursors
    set last_position = v_outbox.chain_position, last_message_id = p_message_id,
        last_successor_cookie = p_successor_proof_cookie, last_origin = 'outbound', updated_at = clock_timestamp()
    where chain_id = v_outbox.chain_id;
end;
$$;

create or replace function public.federated_relay_resolve_reply_v31(
  p_message_id uuid,
  p_delivery text,
  p_receipt jsonb,
  p_current_state text,
  p_superseded_by_message_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_outbox public.federated_relay_outbox%rowtype;
  v_cursor public.federated_relay_outbound_cursors%rowtype;
begin
  select * into v_outbox from public.federated_relay_outbox where message_id = p_message_id;
  if not found then raise exception 'relay_outbox_missing'; end if;
  select * into v_cursor from public.federated_relay_outbound_cursors
    where source_member = v_outbox.source_member and source_key_id = v_outbox.source_key_id and target_member = v_outbox.target_member for update;
  select * into v_outbox from public.federated_relay_outbox where message_id = p_message_id for update;

  if p_delivery not in ('accepted','duplicate') or p_current_state not in ('accepted','superseded','revoked') then raise exception 'relay_delivery_result_invalid'; end if;
  if p_receipt->>'contract' <> 'juss/federated-agent-relay-receipt@v3.1' or p_receipt->>'messageId' <> p_message_id::text then raise exception 'relay_receipt_binding_invalid'; end if;
  if v_outbox.delivery_status in ('accepted','duplicate') then return; end if;
  if v_cursor.pending_message_id is distinct from p_message_id then raise exception 'relay_outbound_cursor_mismatch'; end if;

  update public.federated_relay_outbox
    set delivery_status = p_delivery, receipt = p_receipt, remote_current_state = p_current_state,
        remote_superseded_by_message_id = p_superseded_by_message_id, resolved_at = clock_timestamp()
    where message_id = p_message_id;
  update public.federated_relay_outbound_cursors
    set last_resolved_sequence = v_outbox.source_sequence, pending_sequence = null, pending_message_id = null, updated_at = clock_timestamp()
    where source_member = v_outbox.source_member and source_key_id = v_outbox.source_key_id and target_member = v_outbox.target_member;
end;
$$;

create or replace function public.federated_relay_accept_v31(
  p_contract text,p_message_id uuid,p_semantic_fingerprint char(64),p_delivery_fingerprint char(64),p_receipt_id uuid,
  p_chain_id uuid,p_chain_position bigint,p_relation_type text,p_parent_message_id uuid,p_logical_operation_id uuid,
  p_source_member text,p_source_repository text,p_source_branch text,p_source_head_sha char(40),p_source_key_id text,p_source_sequence bigint,
  p_target_member text,p_target_repository text,p_target_branch text,p_target_head_sha char(40),p_nonce uuid,p_reply_to_message_id uuid,
  p_predecessor_proof_cookie text,p_successor_proof_cookie text,p_payload_sha256 char(64),p_evidence_digest char(64),p_accepted_key_state jsonb,
  p_issued_at timestamptz,p_expires_at timestamptz,p_envelope jsonb,p_receipt jsonb,p_supersedes_message_ids uuid[]
) returns table(outcome text,stored_receipt jsonb,current_state text,superseded_by_message_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_source public.federated_relay_source_cursors%rowtype;
  v_chain public.federated_relay_chain_cursors%rowtype;
  v_existing public.federated_relay_messages%rowtype;
  v_parent_in public.federated_relay_messages%rowtype;
  v_parent_out public.federated_relay_outbox%rowtype;
  v_prior public.federated_relay_messages%rowtype;
  v_sid uuid;
  v_same_direction boolean;
  v_inverted_direction boolean;
  v_now timestamptz;
begin
  if p_contract <> 'juss/federated-agent-relay@v3.1' then raise exception 'relay_contract'; end if;
  if p_relation_type not in ('root','reply','revision','reconcile') then raise exception 'relay_relation_type'; end if;
  if p_receipt->>'contract' <> 'juss/federated-agent-relay-receipt@v3.1' or p_receipt->>'messageId' <> p_message_id::text then raise exception 'relay_receipt_binding_invalid'; end if;
  if not (p_receipt @> '{"executionAuthorized":false,"authorityTransferred":false,"approvalCarriedForward":false}'::jsonb) then raise exception 'relay_receipt_authority_invalid'; end if;

  select * into v_existing from public.federated_relay_messages where message_id = p_message_id;
  if found then
    if v_existing.semantic_fingerprint = p_semantic_fingerprint and v_existing.delivery_fingerprint = p_delivery_fingerprint then
      return query select 'duplicate'::text,v_existing.receipt,v_existing.status,v_existing.superseded_by_message_id; return;
    end if;
    raise exception 'relay_message_id_collision';
  end if;

  insert into public.federated_relay_source_cursors(source_member,source_key_id,last_sequence)
  values(p_source_member,p_source_key_id,-1) on conflict do nothing;
  select * into v_source from public.federated_relay_source_cursors
    where source_member=p_source_member and source_key_id=p_source_key_id for update;

  if p_relation_type='root' then
    insert into public.federated_relay_chain_cursors(
      chain_id,last_position,last_successor_cookie,source_member,source_repository,source_branch,target_member,target_repository,target_branch,logical_operation_id,last_origin
    ) values (
      p_chain_id,-1,'Q4R:v3.1:genesis',p_source_member,p_source_repository,p_source_branch,p_target_member,p_target_repository,p_target_branch,p_logical_operation_id,null
    ) on conflict do nothing;
  end if;
  select * into v_chain from public.federated_relay_chain_cursors where chain_id=p_chain_id for update;
  if not found then raise exception 'relay_chain_unknown'; end if;

  v_now := clock_timestamp();
  if p_expires_at <= p_issued_at or p_expires_at-p_issued_at > interval '5 minutes' or p_expires_at < v_now or p_issued_at > v_now + interval '30 seconds' then raise exception 'relay_freshness'; end if;
  if p_source_sequence <> v_source.last_sequence + 1 then raise exception 'relay_source_sequence_not_next'; end if;
  if p_chain_position <> v_chain.last_position + 1 then raise exception 'relay_chain_position_not_next'; end if;
  if v_chain.logical_operation_id is not null and v_chain.logical_operation_id <> p_logical_operation_id then raise exception 'relay_logical_operation_mismatch'; end if;

  v_same_direction := p_source_member=v_chain.source_member and p_source_repository=v_chain.source_repository and p_source_branch=v_chain.source_branch
                      and p_target_member=v_chain.target_member and p_target_repository=v_chain.target_repository and p_target_branch=v_chain.target_branch;
  v_inverted_direction := p_source_member=v_chain.target_member and p_source_repository=v_chain.target_repository and p_source_branch=v_chain.target_branch
                          and p_target_member=v_chain.source_member and p_target_repository=v_chain.source_repository and p_target_branch=v_chain.source_branch;
  if not (v_same_direction or v_inverted_direction) then raise exception 'relay_chain_participant_pair_changed'; end if;
  if p_predecessor_proof_cookie <> v_chain.last_successor_cookie then raise exception 'relay_chain_cookie_mismatch'; end if;

  if p_relation_type='root' then
    if p_chain_position<>0 or p_parent_message_id is not null or p_reply_to_message_id is not null or p_predecessor_proof_cookie<>'Q4R:v3.1:genesis' then raise exception 'relay_root_invalid'; end if;
  else
    if p_parent_message_id is null or p_parent_message_id is distinct from v_chain.last_message_id then raise exception 'relay_parent_not_tip'; end if;
    if v_chain.last_origin='inbound' then
      select * into v_parent_in from public.federated_relay_messages where message_id=p_parent_message_id for update;
      if not found or v_parent_in.status<>'accepted' or v_parent_in.chain_id<>p_chain_id or v_parent_in.chain_position<>v_chain.last_position
         or v_parent_in.logical_operation_id<>p_logical_operation_id then raise exception 'relay_parent_invalid'; end if;
      if p_relation_type<>'reconcile' and v_parent_in.expires_at<v_now then raise exception 'relay_parent_expired_requires_reconcile'; end if;
      if p_relation_type='reply' and not(p_source_member=v_parent_in.target_member and p_target_member=v_parent_in.source_member and p_reply_to_message_id=v_parent_in.message_id) then raise exception 'relay_reply_identity'; end if;
    elsif v_chain.last_origin='outbound' then
      select * into v_parent_out from public.federated_relay_outbox where message_id=p_parent_message_id for update;
      if not found or v_parent_out.delivery_status not in ('signed','accepted','duplicate') or v_parent_out.chain_id<>p_chain_id
         or v_parent_out.chain_position<>v_chain.last_position or v_parent_out.logical_operation_id<>p_logical_operation_id then raise exception 'relay_parent_invalid'; end if;
      if p_relation_type='reply' and not(p_source_member=v_parent_out.target_member and p_target_member=v_parent_out.source_member and p_reply_to_message_id=v_parent_out.message_id) then raise exception 'relay_reply_identity'; end if;
      if p_relation_type='revision' then raise exception 'relay_remote_revision_of_local_outbound_rejected'; end if;
    else
      raise exception 'relay_parent_origin_invalid';
    end if;
  end if;

  if p_relation_type='revision' and coalesce(array_length(p_supersedes_message_ids,1),0)=0 then raise exception 'relay_revision_without_supersession'; end if;
  if p_relation_type<>'revision' and coalesce(array_length(p_supersedes_message_ids,1),0)>0 then raise exception 'relay_supersession_requires_revision'; end if;
  if p_relation_type='revision' then
    foreach v_sid in array p_supersedes_message_ids loop
      select * into v_prior from public.federated_relay_messages where message_id=v_sid for update;
      if not found or v_prior.status<>'accepted' or v_prior.chain_id<>p_chain_id or v_prior.logical_operation_id<>p_logical_operation_id or v_prior.chain_position>=p_chain_position then raise exception 'relay_supersession_invalid'; end if;
      if exists(select 1 from public.federated_relay_supersessions where predecessor_message_id=v_sid) then raise exception 'relay_supersession_fork'; end if;
    end loop;
  end if;

  insert into public.federated_relay_messages(
    message_id,semantic_fingerprint,delivery_fingerprint,receipt_id,chain_id,chain_position,relation_type,parent_message_id,logical_operation_id,
    source_member,source_repository,source_branch,source_head_sha,source_key_id,source_sequence,target_member,target_repository,target_branch,target_head_sha,
    nonce,reply_to_message_id,predecessor_proof_cookie,successor_proof_cookie,payload_sha256,evidence_digest,accepted_key_state,issued_at,expires_at,envelope,receipt
  ) values (
    p_message_id,p_semantic_fingerprint,p_delivery_fingerprint,p_receipt_id,p_chain_id,p_chain_position,p_relation_type,p_parent_message_id,p_logical_operation_id,
    p_source_member,p_source_repository,p_source_branch,p_source_head_sha,p_source_key_id,p_source_sequence,p_target_member,p_target_repository,p_target_branch,p_target_head_sha,
    p_nonce,p_reply_to_message_id,p_predecessor_proof_cookie,p_successor_proof_cookie,p_payload_sha256,p_evidence_digest,p_accepted_key_state,p_issued_at,p_expires_at,p_envelope,p_receipt
  );
  if p_relation_type='revision' then
    foreach v_sid in array p_supersedes_message_ids loop
      insert into public.federated_relay_supersessions values(v_sid,p_message_id,p_chain_id,p_logical_operation_id,clock_timestamp());
      update public.federated_relay_messages set status='superseded',superseded_by_message_id=p_message_id where message_id=v_sid;
    end loop;
  end if;
  update public.federated_relay_source_cursors set last_sequence=p_source_sequence,last_message_id=p_message_id,updated_at=clock_timestamp()
    where source_member=p_source_member and source_key_id=p_source_key_id;
  update public.federated_relay_chain_cursors set last_position=p_chain_position,last_message_id=p_message_id,last_successor_cookie=p_successor_proof_cookie,
    logical_operation_id=coalesce(logical_operation_id,p_logical_operation_id),last_origin='inbound',updated_at=clock_timestamp()
    where chain_id=p_chain_id;
  return query select 'accepted'::text,p_receipt,'accepted'::text,null::uuid;
end;
$$;

revoke all on function public.federated_relay_reserve_reply_v31(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.federated_relay_finalize_reply_v31(uuid,character,character,text,jsonb) from public,anon,authenticated;
revoke all on function public.federated_relay_resolve_reply_v31(uuid,text,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.federated_relay_reserve_reply_v31(uuid,uuid,text) to service_role;
grant execute on function public.federated_relay_finalize_reply_v31(uuid,character,character,text,jsonb) to service_role;
grant execute on function public.federated_relay_resolve_reply_v31(uuid,text,jsonb,text,uuid) to service_role;
