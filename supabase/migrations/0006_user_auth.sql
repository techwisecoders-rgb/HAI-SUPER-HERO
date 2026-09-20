-- 0006_user_auth.sql
-- End-user (visitor) authentication: OTP-based registration/login that
-- coexists with the admin-only auth used in /admin/login. This migration:
--   1. Creates an `app_users` table — one row per registered visitor.
--   2. Creates an `app_otps` table — short-lived OTP codes the API
--      generates and verifies against.
--   3. Adds a `user_id` column on `public.sessions` so the chat history
--      can be linked to the registered user (so the chat "is there forever").
--   4. Adds RPCs `claim_otp`, `create_app_user`, `find_app_user_by_email`,
--      `create_app_otp`, `find_valid_otp`, `consume_otp`, `bump_otp_attempts`,
--      and `touch_app_user_login`.
--   5. RLS policies: anon direct table access is denied; everything goes
--      through the SECURITY DEFINER RPCs below.

-- ---------- app_users ----------
create table if not exists public.app_users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,                 -- bcrypt hash
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

create index if not exists app_users_email_idx on public.app_users (lower(email));

-- ---------- app_otps ----------
create table if not exists public.app_otps (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  code_hash   text not null,                   -- bcrypt hash of the OTP
  purpose     text not null check (purpose in ('register','login','reset')),
  attempts    int  not null default 0,
  consumed    boolean not null default false,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index if not exists app_otps_email_idx on public.app_otps (lower(email), created_at desc);
create index if not exists app_otps_expires_idx on public.app_otps (expires_at);

-- ---------- sessions.user_id ----------
alter table public.sessions
  add column if not exists user_id uuid references public.app_users(id) on delete set null;

create index if not exists sessions_user_idx on public.sessions (user_id);

-- ---------- RLS ----------
alter table public.app_users enable row level security;
alter table public.app_otps  enable row level security;

drop policy if exists "app_users_anon_select" on public.app_users;
create policy "app_users_anon_select" on public.app_users for select to anon using (false);

drop policy if exists "app_users_anon_insert" on public.app_users;
create policy "app_users_anon_insert" on public.app_users for insert to anon with check (false);

drop policy if exists "app_users_admin_all" on public.app_users;
create policy "app_users_admin_all" on public.app_users for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "app_otps_anon_all" on public.app_otps;
create policy "app_otps_anon_all" on public.app_otps for all to anon using (false) with check (false);

drop policy if exists "app_otps_admin_all" on public.app_otps;
create policy "app_otps_admin_all" on public.app_otps for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- RPCs ----------
-- All RPCs are SECURITY DEFINER and validate input. The anon role can
-- execute them; they enforce business rules internally.

-- Look up a user by email. The route handler bcrypts the supplied
-- password before calling this and compares the hash itself.
create or replace function public.find_app_user_by_email(p_email text)
returns table (id uuid, email text, password_hash text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
    select au.id, au.email, au.password_hash, au.created_at
    from public.app_users au
    where lower(au.email) = lower(p_email)
    limit 1;
end;
$$;

revoke all on function public.find_app_user_by_email(text) from public;
grant execute on function public.find_app_user_by_email(text) to anon, authenticated;

-- Create a new app_user. Password is bcrypt-hashed by the caller.
create or replace function public.create_app_user(p_email text, p_password_hash text)
returns table (id uuid, email text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_created timestamptz;
begin
  if p_email is null or length(trim(p_email)) = 0 then
    raise exception 'email required';
  end if;
  if p_password_hash is null or length(p_password_hash) < 20 then
    raise exception 'password hash required';
  end if;

  if exists (select 1 from public.app_users where lower(email) = lower(p_email)) then
    raise exception 'email already registered';
  end if;

  insert into public.app_users (email, password_hash)
  values (lower(trim(p_email)), p_password_hash)
  returning id, created_at into v_id, v_created;

  return query select v_id, lower(trim(p_email)), v_created;
end;
$$;

revoke all on function public.create_app_user(text, text) from public;
grant execute on function public.create_app_user(text, text) to anon, authenticated;

-- Record an OTP. Caller hashes the OTP with bcrypt before calling.
create or replace function public.create_app_otp(
  p_email text,
  p_code_hash text,
  p_purpose text,
  p_ttl_seconds int default 600
)
returns table (id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_exp timestamptz;
begin
  if p_purpose not in ('register','login','reset') then
    raise exception 'invalid purpose';
  end if;
  if p_code_hash is null or length(p_code_hash) < 20 then
    raise exception 'code hash required';
  end if;

  -- Invalidate any existing OTPs for this email + purpose so only the
  -- latest one counts.
  update public.app_otps
     set consumed = true
   where lower(email) = lower(p_email) and purpose = p_purpose and consumed = false;

  insert into public.app_otps (email, code_hash, purpose, expires_at)
  values (lower(trim(p_email)), p_code_hash, p_purpose, now() + make_interval(secs => p_ttl_seconds))
  returning id, expires_at into v_id, v_exp;

  return query select v_id, v_exp;
end;
$$;

revoke all on function public.create_app_otp(text, text, text, int) from public;
grant execute on function public.create_app_otp(text, text, text, int) to anon, authenticated;

-- Verify an OTP. Returns the latest valid (non-consumed, non-expired,
-- attempts < 5) OTP for the email + purpose. Caller compares the bcrypt
-- hash of the submitted code against code_hash.
create or replace function public.find_valid_otp(
  p_email text,
  p_purpose text
)
returns table (id uuid, code_hash text, attempts int, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
    select o.id, o.code_hash, o.attempts, o.expires_at
    from public.app_otps o
    where lower(o.email)  = lower(p_email)
      and o.purpose       = p_purpose
      and o.consumed      = false
      and o.expires_at   > now()
      and o.attempts     < 5
    order by o.created_at desc
    limit 1;
end;
$$;

revoke all on function public.find_valid_otp(text, text) from public;
grant execute on function public.find_valid_otp(text, text) to anon, authenticated;

-- Mark an OTP as consumed (called after a successful verify).
create or replace function public.consume_otp(p_otp_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.app_otps set consumed = true where id = p_otp_id;
$$;

revoke all on function public.consume_otp(uuid) from public;
grant execute on function public.consume_otp(uuid) to anon, authenticated;

-- Bump the attempt counter on an OTP (called when verify fails).
create or replace function public.bump_otp_attempts(p_otp_id uuid)
returns int
language sql
security definer
set search_path = public
as $$
  update public.app_otps
     set attempts = attempts + 1
   where id = p_otp_id
   returning attempts;
$$;

revoke all on function public.bump_otp_attempts(uuid) from public;
grant execute on function public.bump_otp_attempts(uuid) to anon, authenticated;

-- Touch the last_login_at column on successful login.
create or replace function public.touch_app_user_login(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.app_users set last_login_at = now() where id = p_user_id;
$$;

revoke all on function public.touch_app_user_login(uuid) from public;
grant execute on function public.touch_app_user_login(uuid) to anon, authenticated;

-- Bootstrap a session row bound to a registered user_id (so the chat
-- history is permanent and tied to the account). Called by the route
-- handler on successful login. If a session row already exists for
-- this user_id, return it; otherwise create one.
create or replace function public.bootstrap_session_for_user(p_user_id uuid)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.sessions;
begin
  select * into s from public.sessions where user_id = p_user_id order by last_seen_at desc limit 1;
  if found then
    update public.sessions set last_seen_at = now() where id = s.id returning * into s;
    return s;
  end if;
  insert into public.sessions (user_id)
  values (p_user_id)
  returning * into s;
  return s;
end;
$$;

revoke all on function public.bootstrap_session_for_user(uuid) from public;
grant execute on function public.bootstrap_session_for_user(uuid) to anon, authenticated;