/*
  Durable public-key registry for juss/federated-agent-relay@v3.1.

  This is evidence infrastructure only. It creates no execution authority and
  grants no browser/user access. Runtime reads are service-role only.
*/

create table if not exists public.federated_relay_v31_public_keys (
  member text not null,
  key_id text not null,
  algorithm text not null default 'Ed25519',
  public_key_jwk jsonb not null,
  state text not null default 'active',
  valid_from timestamptz not null,
  valid_until timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (member, key_id),
  constraint federated_relay_v31_key_member check (
    member in ('founder-control-room','chief-ai-machine','solcontinuity','promptos')
  ),
  constraint federated_relay_v31_key_algorithm check (algorithm = 'Ed25519'),
  constraint federated_relay_v31_key_state check (state in ('active','retiring','revoked')),
  constraint federated_relay_v31_key_window check (valid_until is null or valid_until > valid_from),
  constraint federated_relay_v31_key_revocation check ((state = 'revoked') = (revoked_at is not null))
);

alter table public.federated_relay_v31_public_keys enable row level security;

revoke all on public.federated_relay_v31_public_keys from public, anon, authenticated, service_role;
grant select on public.federated_relay_v31_public_keys to service_role;

create or replace function public.federated_relay_v31_key_immutability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.member <> old.member
     or new.key_id <> old.key_id
     or new.algorithm <> old.algorithm
     or new.public_key_jwk <> old.public_key_jwk
     or new.valid_from <> old.valid_from then
    raise exception 'relay_key_identity_immutable';
  end if;

  if old.state = 'revoked' then
    raise exception 'relay_key_revocation_final';
  end if;

  if old.state = 'retiring' and new.state = 'active' then
    raise exception 'relay_key_state_regression';
  end if;

  if new.valid_until is not null
     and old.valid_until is not null
     and new.valid_until > old.valid_until then
    raise exception 'relay_key_validity_extension_rejected';
  end if;

  if new.state = 'revoked' and new.revoked_at is null then
    new.revoked_at := clock_timestamp();
  end if;

  new.updated_at := clock_timestamp();
  return new;
end;
$$;

revoke all on function public.federated_relay_v31_key_immutability() from public, anon, authenticated, service_role;

drop trigger if exists federated_relay_v31_key_immutability
  on public.federated_relay_v31_public_keys;
create trigger federated_relay_v31_key_immutability
before update on public.federated_relay_v31_public_keys
for each row execute function public.federated_relay_v31_key_immutability();
