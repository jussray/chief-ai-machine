-- Candidate only. Apply to a dedicated, verified CHIEF project, never an FCR project.
begin;
create table public.chief_business_records (
  owner_id uuid not null default auth.uid(),
  record_key text not null check (char_length(record_key) between 1 and 100),
  kind text not null check (kind in ('objective','knowledge','decision','measurement')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  detail text not null check (char_length(btrim(detail)) between 1 and 2000),
  classification text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, record_key),
  check ((kind in ('objective','decision') and classification='proposed') or
         (kind in ('knowledge','measurement') and classification='user_reported'))
);
alter table public.chief_business_records enable row level security;
alter table public.chief_business_records force row level security;
revoke all on public.chief_business_records from public, anon, authenticated;
grant select on public.chief_business_records to authenticated;
grant insert (owner_id,record_key,kind,title,detail,classification) on public.chief_business_records to authenticated;
create policy chief_owner_read on public.chief_business_records for select to authenticated
using (owner_id=(select auth.uid()) and (select auth.jwt()->>'is_anonymous')='false');
create policy chief_owner_insert on public.chief_business_records for insert to authenticated
with check (owner_id=(select auth.uid()) and (select auth.jwt()->>'is_anonymous')='false');
commit;
