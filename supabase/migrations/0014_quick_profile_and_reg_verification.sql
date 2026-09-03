-- 0014_quick_profile_and_reg_verification.sql
--
-- Adds quick-profile persistence to app_users + worker-registration
-- OTP verification. Also adds a new 'quick_profile' /
-- 'worker_registration' purpose to app_otps.
--
-- Changes:
--   1. app_users gets two new optional columns:
--        display_name text  — the /profile "Name" field
--        city         text  — the /profile "City" field
--      Email is already on app_users.
--   2. worker_registrations gets a verified_at column. The pending
--      row is inserted on Submit, then verified_at is set when the
--      user types the OTP.
--   3. Three new RPCs:
--        submit_quick_profile(p_email, p_display_name, p_city, p_otp)
--        verify_worker_registration(p_registration_id, p_otp)
--        update_app_user_profile(p_email, p_display_name, p_city)
--
-- pgcrypto is enabled for crypt() so we can bcrypt-compare OTP hashes
-- inside plpgsql without round-tripping through Node.

-- Need pgcrypto for crypt() — required for the bcrypt-style hash check.
create extension if not exists pgcrypto;

-- ---------- app_users columns ----------
alter table public.app_users
  add column if not exists display_name text,
  add column if not exists city         text;

-- ---------- worker_registrations columns ----------
alter table public.worker_registrations
  add column if not exists verified_at timestamptz;

create index if not exists worker_registrations_verified_idx
  on public.worker_registrations (verified_at);

-- Extend the app_otps check constraint to allow the new purposes.
alter table public.app_otps
  drop constraint if exists app_otps_purpose_check;

alter table public.app_otps
  add constraint app_otps_purpose_check
  check (purpose in ('register','login','reset','quick_profile','worker_registration'));

-- ---------- bcrypt_compare ----------
-- Tiny SECURITY DEFINER wrapper around pgcrypto's crypt() so the rest
-- of the RPCs can compare a plain code against a stored bcrypt hash.
--
-- IMPORTANT: pgcrypto's crypt() lives in the `extensions` schema, NOT
-- `public`. We must include `extensions` in the search_path or
-- qualify the call, otherwise the function body raises
-- "function crypt(text,text) does not exist" — and since the body
-- catches exceptions, we'd silently return false (the wrong answer).
create or replace function public.bcrypt_compare(p_plain text, p_hash text)
returns boolean
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
begin
  return crypt(p_plain, p_hash) = p_hash;
exception when others then
  return false;
end;
$$;

revoke all on function public.bcrypt_compare(text, text) from public;
grant execute on function public.bcrypt_compare(text, text) to anon, authenticated;

-- ---------- update_app_user_profile ----------
-- Safe upsert of profile columns onto an existing app_users row
-- (matched by email). Requires the row to already exist; if it does
-- not, this raises. Used by the post-OTP "save profile" step.
create or replace function public.update_app_user_profile(
  p_email       text,
  p_display_name text,
  p_city        text
)
returns public.app_users
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_row public.app_users;
begin
  update public.app_users
     set display_name = nullif(trim(coalesce(p_display_name, '')), ''),
         city         = nullif(trim(coalesce(p_city, '')), '')
   where lower(public.app_users.email) = lower(p_email)
   returning * into v_row;
  if v_row.id is null then
    raise exception 'no such user';
  end if;
  return v_row;
end;
$$;

revoke all on function public.update_app_user_profile(text, text, text) from public;
grant execute on function public.update_app_user_profile(text, text, text) to anon, authenticated;

-- ---------- submit_quick_profile ----------
-- Atomically: verifies the OTP (purpose='quick_profile') and writes
-- the profile (display_name + city) to app_users. The user row must
-- already exist (created via /api/auth/verify-otp register/login).
create or replace function public.submit_quick_profile(
  p_email        text,
  p_display_name text,
  p_city         text,
  p_otp          text
)
returns public.app_users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users;
  v_otp_id uuid;
  v_code_hash text;
begin
  -- 1. Find a valid (purpose='quick_profile') OTP for this email.
  select o.id, o.code_hash
    into v_otp_id, v_code_hash
    from public.app_otps o
   where lower(o.email) = lower(p_email)
     and o.purpose      = 'quick_profile'
     and o.consumed     = false
     and o.expires_at  > now()
     and o.attempts    < 5
   order by o.created_at desc
   limit 1;
  if v_otp_id is null then
    raise exception 'OTP expired or not found';
  end if;

  -- 2. Compare the OTP code against the stored hash.
  if not public.bcrypt_compare(p_otp, v_code_hash) then
    update public.app_otps set attempts = attempts + 1 where id = v_otp_id;
    raise exception 'Incorrect OTP';
  end if;

  -- 3. Mark OTP consumed.
  update public.app_otps set consumed = true where id = v_otp_id;

  -- 4. Look up the user.
  select * into v_user from public.app_users
   where lower(public.app_users.email) = lower(p_email);
  if v_user.id is null then
    raise exception 'user not found — please complete sign-in first';
  end if;

  -- 5. Write display_name + city.
  update public.app_users
     set display_name = nullif(trim(coalesce(p_display_name, '')), ''),
         city         = nullif(trim(coalesce(p_city, '')), '')
   where id = v_user.id
   returning * into v_user;
  return v_user;
end;
$$;

revoke all on function public.submit_quick_profile(text, text, text, text) from public;
grant execute on function public.submit_quick_profile(text, text, text, text) to anon, authenticated;

-- ---------- verify_worker_registration ----------
-- Marks a pending worker_registration as verified (verified_at=now())
-- after the user submits the OTP we emailed them.
create or replace function public.verify_worker_registration(
  p_registration_id uuid,
  p_otp             text
)
returns public.worker_registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.worker_registrations;
  v_otp_id uuid;
  v_code_hash text;
begin
  select * into v_reg from public.worker_registrations where id = p_registration_id;
  if v_reg.id is null then
    raise exception 'registration not found';
  end if;
  if v_reg.verified_at is not null then
    raise exception 'already verified';
  end if;
  if v_reg.email is null or trim(v_reg.email) = '' then
    raise exception 'no email on registration — cannot verify';
  end if;

  -- 1. Find a valid (purpose='worker_registration') OTP for this email.
  select o.id, o.code_hash
    into v_otp_id, v_code_hash
    from public.app_otps o
   where lower(o.email) = lower(v_reg.email)
     and o.purpose      = 'worker_registration'
     and o.consumed     = false
     and o.expires_at  > now()
     and o.attempts    < 5
   order by o.created_at desc
   limit 1;
  if v_otp_id is null then
    raise exception 'OTP expired or not found';
  end if;

  -- 2. Compare the OTP code.
  if not public.bcrypt_compare(p_otp, v_code_hash) then
    update public.app_otps set attempts = attempts + 1 where id = v_otp_id;
    raise exception 'Incorrect OTP';
  end if;

  -- 3. Mark consumed + verified.
  update public.app_otps set consumed = true where id = v_otp_id;
  update public.worker_registrations
     set verified_at = now()
   where id = p_registration_id
   returning * into v_reg;
  return v_reg;
end;
$$;

revoke all on function public.verify_worker_registration(uuid, text) from public;
grant execute on function public.verify_worker_registration(uuid, text) to anon, authenticated;