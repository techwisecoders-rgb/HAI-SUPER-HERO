-- 0011_worker_registrations.sql
-- New "Register as a worker" feature: visitors can submit a worker/
-- provider profile from the React app. We store it in a new table that
-- is namespaced cleanly so it does NOT touch any of the existing
-- session/message/admin schema.
--
-- The table links to the existing `public.sessions` (so we can tie a
-- registration back to the visitor that submitted it) and to the
-- existing `public.app_users` (so logged-in users can submit under
-- their account). Both FKs are nullable because anonymous visitors can
-- also register.
--
-- Writes go through a SECURITY DEFINER RPC so anon direct table
-- access is denied (consistent with the rest of the app).
--
-- This file also adds a small `contact_settings` key/value table so
-- the chat welcome row's phone + WhatsApp numbers are admin-editable
-- rather than hard-coded constants.

-- ---------- worker_registrations ----------
create table if not exists public.worker_registrations (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  -- Optional link to existing entities (both nullable so the feature
  -- works for anonymous visitors too).
  session_id      uuid references public.sessions(id)    on delete set null,
  user_id         uuid references public.app_users(id)   on delete set null,

  -- Form fields (validated server-side).
  full_name       text not null,
  phone           text not null,                 -- 10 digits, validated
  email           text,                          -- optional
  address         text not null,
  work_type       text not null,
  work_description text not null,
  qualification   text,
  years_experience text,                         -- free-text so we can store "0-1", "5+"
  availability    text
);

create index if not exists worker_registrations_created_idx
  on public.worker_registrations (created_at desc);
create index if not exists worker_registrations_session_idx
  on public.worker_registrations (session_id);

-- ---------- RLS ----------
alter table public.worker_registrations enable row level security;

-- Block all anon direct access (writes go through RPC).
drop policy if exists "worker_registrations_anon_all" on public.worker_registrations;
create policy "worker_registrations_anon_all"
  on public.worker_registrations for all
  to anon using (false) with check (false);

-- Admin can read + write directly.
drop policy if exists "worker_registrations_admin_all" on public.worker_registrations;
create policy "worker_registrations_admin_all"
  on public.worker_registrations for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- RPCs ----------
-- Public write (validates input + inserts).
create or replace function public.submit_worker_registration(
  p_session_id      uuid,
  p_user_id         uuid,
  p_full_name       text,
  p_phone           text,
  p_email           text,
  p_address         text,
  p_work_type       text,
  p_work_description text,
  p_qualification   text,
  p_years_experience text,
  p_availability    text
)
returns public.worker_registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.worker_registrations;
begin
  -- Trim + basic non-empty checks (route handler does the deeper
  -- validation, but we defend in depth).
  if p_full_name is null or length(trim(p_full_name)) = 0 then
    raise exception 'name required';
  end if;
  if p_phone is null or p_phone !~ '^[0-9]{10}$' then
    raise exception 'phone must be 10 digits';
  end if;
  if p_address is null or length(trim(p_address)) = 0 then
    raise exception 'address required';
  end if;
  if p_work_type is null or length(trim(p_work_type)) = 0 then
    raise exception 'work_type required';
  end if;
  if p_work_description is null or length(trim(p_work_description)) = 0 then
    raise exception 'work_description required';
  end if;

  insert into public.worker_registrations (
    session_id, user_id, full_name, phone, email, address,
    work_type, work_description, qualification, years_experience, availability
  ) values (
    p_session_id, p_user_id, trim(p_full_name), p_phone,
    nullif(trim(coalesce(p_email, '')), ''),
    trim(p_address), trim(p_work_type), trim(p_work_description),
    nullif(trim(coalesce(p_qualification, '')), ''),
    nullif(trim(coalesce(p_years_experience, '')), ''),
    nullif(trim(coalesce(p_availability, '')), '')
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.submit_worker_registration(
  uuid, uuid, text, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.submit_worker_registration(
  uuid, uuid, text, text, text, text, text, text, text, text, text
) to anon, authenticated;

-- Admin list (used by /api/worker). Returns the latest N rows.
create or replace function public.list_worker_registrations(p_limit int default 200)
returns setof public.worker_registrations
language sql
security definer
stable
set search_path = public
as $$
  select * from public.worker_registrations
  order by created_at desc
  limit greatest(p_limit, 1);
$$;

revoke all on function public.list_worker_registrations(int) from public;
grant execute on function public.list_worker_registrations(int) to authenticated;

-- ---------- contact_settings ----------
-- Tiny key/value table the admin can edit so the chat welcome row's
-- phone + WhatsApp numbers are admin-editable, not hard-coded.
do $$ begin
  if not exists (select 1 from pg_type where typname = 'contact_key') then
    create type contact_key as enum ('phone', 'whatsapp');
  end if;
end $$;

create table if not exists public.contact_settings (
  key   contact_key primary key,
  value text not null
);

alter table public.contact_settings enable row level security;

drop policy if exists "contact_settings_read" on public.contact_settings;
create policy "contact_settings_read"
  on public.contact_settings for select to anon using (true);

drop policy if exists "contact_settings_admin_all" on public.contact_settings;
create policy "contact_settings_admin_all"
  on public.contact_settings for all
  using (public.is_admin())
  with check (public.is_admin());

-- Seed defaults so the first GET returns something sensible even before
-- an admin has edited anything.
insert into public.contact_settings (key, value)
  values ('phone', '9963935878'), ('whatsapp', '919963935878')
  on conflict (key) do nothing;