-- 0015_relax_create_app_otp_purpose_check.sql
--
-- The create_app_otp SECURITY DEFINER RPC still has a hardcoded
-- purpose whitelist ('register','login','reset') in its body. The
-- CHECK constraint on app_otps already accepts the new purposes
-- (after migration 0014), but the function body rejects them.
--
-- This migration drops the hardcoded check inside create_app_otp
-- so the function accepts the same purposes the table does, and
-- also qualifies the RETURNING id/expires_at references to avoid
-- the "column reference is ambiguous" error that the un-qualified
-- version hits (same fix as migration 0007 applied to create_app_user).

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
  -- No body-level purpose whitelist anymore — the CHECK constraint
  -- on app_otps.purpose is the single source of truth (updated in
  -- migration 0014 to include 'quick_profile' and 'worker_registration').
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
  returning public.app_otps.id, public.app_otps.expires_at into v_id, v_exp;

  return query select v_id, v_exp;
end;
$$;

revoke all on function public.create_app_otp(text, text, text, int) from public;
grant execute on function public.create_app_otp(text, text, text, int) to anon, authenticated;