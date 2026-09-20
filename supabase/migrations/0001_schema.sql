-- 0001_schema.sql
-- HAI SUPER HERO core schema: sessions, messages, admins, content tables.
-- Idempotent where reasonable. Run in Supabase SQL editor (or via supabase CLI).

-- ---------- enums ----------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'sender_type') then
    create type sender_type as enum ('user', 'admin');
  end if;
end $$;

-- ---------- sessions ----------
create table if not exists public.sessions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  display_name  text,
  metadata      jsonb
);

create index if not exists sessions_last_seen_idx
  on public.sessions (last_seen_at desc);

-- ---------- messages ----------
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.sessions(id) on delete cascade,
  sender_type  sender_type not null,
  admin_id     uuid,  -- references auth.users(id) when sender_type='admin'
  text         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists messages_session_idx
  on public.messages (session_id, created_at asc);

create index if not exists messages_created_idx
  on public.messages (created_at desc);

-- ---------- content tables (admin can edit later) ----------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  sort_order  int  not null default 0
);

create table if not exists public.category_items (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.categories(id) on delete cascade,
  image_url    text not null,
  caption      text not null,
  sort_order   int  not null default 0
);

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  image_url   text not null,
  url         text not null,
  sort_order  int  not null default 0
);

create table if not exists public.popular_queries (
  id          uuid primary key default gen_random_uuid(),
  text        text not null,
  sort_order  int  not null default 0
);

-- ---------- RLS ----------
alter table public.sessions      enable row level security;
alter table public.messages      enable row level security;
alter table public.categories    enable row level security;
alter table public.category_items enable row level security;
alter table public.projects      enable row level security;
alter table public.popular_queries enable row level security;

-- Helper: is the current request from an authenticated Supabase user? (Admins.)
-- We treat any logged-in user as an "admin role" for app purposes; admin
-- provisioning happens via the Supabase dashboard (no public sign-up).
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select auth.role() = 'authenticated';
$$;

-- sessions: clients can upsert their own (matched by id sent from server
-- using a secure route handler — direct client insert blocked). Admins see all.
drop policy if exists "sessions_admin_all" on public.sessions;
create policy "sessions_admin_all"
  on public.sessions for all
  using (public.is_admin())
  with check (public.is_admin());

-- messages:
--   * anon can INSERT only for a session_id that was just created by an
--     authenticated server action (we'll enforce this via a SECURITY DEFINER
--     RPC in 0002_rpc.sql). Direct insert from anon is denied.
--   * anon can SELECT only messages whose session_id matches a server-issued
--     session cookie. Since cookies aren't visible to Postgres, we use a
--     SECURITY DEFINER RPC (get_my_messages) for reads too. Direct anon
--     select is denied.
drop policy if exists "messages_admin_all" on public.messages;
create policy "messages_admin_all"
  on public.messages for all
  using (public.is_admin())
  with check (public.is_admin());

-- Block anon direct access to messages (they must go through RPCs).
drop policy if exists "messages_anon_select" on public.messages;
create policy "messages_anon_select"
  on public.messages for select
  to anon
  using (false);

drop policy if exists "messages_anon_insert" on public.messages;
create policy "messages_anon_insert"
  on public.messages for insert
  to anon
  with check (false);

-- content: public read, admin write
drop policy if exists "categories_read" on public.categories;
create policy "categories_read" on public.categories for select to anon using (true);
drop policy if exists "categories_admin" on public.categories;
create policy "categories_admin" on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "category_items_read" on public.category_items;
create policy "category_items_read" on public.category_items for select to anon using (true);
drop policy if exists "category_items_admin" on public.category_items;
create policy "category_items_admin" on public.category_items for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "projects_read" on public.projects;
create policy "projects_read" on public.projects for select to anon using (true);
drop policy if exists "projects_admin" on public.projects;
create policy "projects_admin" on public.projects for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "popular_queries_read" on public.popular_queries;
create policy "popular_queries_read" on public.popular_queries for select to anon using (true);
drop policy if exists "popular_queries_admin" on public.popular_queries;
create policy "popular_queries_admin" on public.popular_queries for all
  using (public.is_admin()) with check (public.is_admin());
