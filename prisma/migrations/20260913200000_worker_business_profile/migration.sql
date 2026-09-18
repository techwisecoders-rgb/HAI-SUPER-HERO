-- 0020_worker_profiles.sql
-- Persistent worker profile store. This is the Prisma/PostgreSQL model
-- backing the Worker Profile page; Supabase is the hosted PostgreSQL layer.

create table if not exists public.worker_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete set null,
  session_id uuid references public.sessions(id) on delete set null,
  email text,
  name text not null default '',
  phone text not null default '',
  location text not null default '',
  qualification text not null default '',
  experience text not null default '',
  profession text not null default 'electrician',
  profile_image_url text,
  background_image_url text,
  work_available boolean not null default true,
  skills jsonb not null default '[]'::jsonb,
  about_text text not null default '',
  work_description text not null default '',
  resume_url text,
  works jsonb not null default '[]'::jsonb,
  featured jsonb not null default '[]'::jsonb,
  social_links jsonb not null default '[]'::jsonb,
  rating numeric(3,2) not null default 0,
  jobs_done integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists worker_profiles_user_uidx
  on public.worker_profiles(user_id) where user_id is not null;
create unique index if not exists worker_profiles_session_uidx
  on public.worker_profiles(session_id) where session_id is not null;
create index if not exists worker_profiles_email_idx
  on public.worker_profiles(lower(email)) where email is not null;

create or replace function public.set_worker_profile_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists worker_profiles_updated_at on public.worker_profiles;
create trigger worker_profiles_updated_at
  before update on public.worker_profiles
  for each row execute function public.set_worker_profile_updated_at();

alter table public.worker_profiles enable row level security;
drop policy if exists worker_profiles_client_access on public.worker_profiles;
create policy worker_profiles_client_access
  on public.worker_profiles for all to anon, authenticated
  using (false) with check (false);
drop policy if exists worker_profiles_admin_all on public.worker_profiles;
create policy worker_profiles_admin_all
  on public.worker_profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- Storage bucket used by worker profile images/documents.
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('worker-media', 'worker-media', true)
  on conflict (id) do update set public = excluded.public;
exception when undefined_table then
  null;
end $$;

-- Backfill the persistent profile from the most recent registration where
-- possible. Existing registration data is never modified or removed.
insert into public.worker_profiles (
  user_id, session_id, email, name, phone, location, qualification,
  experience, profession, about_text, work_description, work_available
)
select distinct on (coalesce(r.user_id::text, r.session_id::text))
  r.user_id, r.session_id, r.email, r.full_name, r.phone, r.address,
  coalesce(r.qualification, ''), coalesce(r.years_experience, ''),
  case when lower(r.work_type) <> '' then lower(r.work_type) else 'electrician' end,
  '', r.work_description, true
from public.worker_registrations r
where r.verified_at is not null
  and not exists (
    select 1 from public.worker_profiles p
    where (r.user_id is not null and p.user_id = r.user_id)
       or (r.user_id is null and r.session_id is not null and p.session_id = r.session_id)
  )
order by coalesce(r.user_id::text, r.session_id::text), r.created_at desc;
