-- 0009_fix_create_app_otp_ambiguity.sql
-- Fix: `create_app_otp` declares `returns table (id uuid, expires_at timestamptz)`.
-- Inside the function body, `id` and `expires_at` are visible as columns
-- of that return table *and* as columns of `public.app_otps`. Any
-- unqualified reference to either is ambiguous. Specifically the
-- `insert ... returning id, expires_at` line.
--
-- Fix: qualify with the table alias.

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
   where lower(public.app_otps.email) = lower(p_email)
     and public.app_otps.purpose       = p_purpose
     and public.app_otps.consumed      = false;

  -- Fully-qualified on the INSERT ... RETURNING to remove the ambiguity
  -- with the function's return-table columns (id, expires_at).
  insert into public.app_otps (email, code_hash, purpose, expires_at)
  values (
    lower(trim(p_email)),
    p_code_hash,
    p_purpose,
    now() + make_interval(secs => p_ttl_seconds)
  )
  returning public.app_otps.id, public.app_otps.expires_at
    into v_id, v_exp;

  return query select v_id, v_exp;
end;
$$;

revoke all on function public.create_app_otp(text, text, text, int) from public;
grant execute on function public.create_app_otp(text, text, text, int) to anon, authenticated;