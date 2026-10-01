-- Persist a public key observed from an exact-identity peer runtime without
-- granting direct write access to the key registry. Source only; this file
-- does not claim a production migration apply.

create or replace function public.federated_relay_v31_register_observed_key(
  p_member text,
  p_key_id text,
  p_public_key_jwk jsonb,
  p_state text,
  p_valid_from timestamptz,
  p_valid_until timestamptz default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.federated_relay_v31_public_keys%rowtype;
begin
  if p_member not in ('founder-control-room','chief-ai-machine','solcontinuity','promptos') then
    raise exception 'relay_key_member_invalid';
  end if;
  if p_key_id !~ '^[A-Za-z0-9._:-]{3,200}$' then
    raise exception 'relay_key_id_invalid';
  end if;
  if p_state not in ('active','retiring') then
    raise exception 'relay_key_state_invalid';
  end if;
  if p_public_key_jwk->>'kty' <> 'OKP'
     or p_public_key_jwk->>'crv' <> 'Ed25519'
     or coalesce(p_public_key_jwk->>'x','') !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'relay_key_jwk_invalid';
  end if;
  if p_valid_until is not null and p_valid_until <= p_valid_from then
    raise exception 'relay_key_window_invalid';
  end if;

  insert into public.federated_relay_v31_public_keys(
    member, key_id, algorithm, public_key_jwk, state, valid_from, valid_until, revoked_at
  ) values (
    p_member, p_key_id, 'Ed25519', p_public_key_jwk, p_state, p_valid_from, p_valid_until, null
  )
  on conflict (member, key_id) do nothing;

  select * into v_existing
  from public.federated_relay_v31_public_keys
  where member = p_member and key_id = p_key_id;

  if not found
     or v_existing.algorithm <> 'Ed25519'
     or v_existing.public_key_jwk <> p_public_key_jwk
     or v_existing.valid_from <> p_valid_from
     or v_existing.valid_until is distinct from p_valid_until
     or v_existing.revoked_at is not null
     or v_existing.state not in ('active','retiring') then
    raise exception 'relay_key_observation_conflict';
  end if;
end;
$$;

revoke all on function public.federated_relay_v31_register_observed_key(text,text,jsonb,text,timestamptz,timestamptz)
  from public, anon, authenticated;
grant execute on function public.federated_relay_v31_register_observed_key(text,text,jsonb,text,timestamptz,timestamptz)
  to service_role;
