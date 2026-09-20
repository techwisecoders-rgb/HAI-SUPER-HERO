-- 0007_fix_create_app_user_ambiguity.sql
-- Fix: `create_app_user` references `email` inside its body without a
-- table qualifier, but the function also `returns table (..., email, ...)`.
-- PostgreSQL then considers BOTH names visible and the unqualified
-- reference is ambiguous -> "column reference 'email' is ambiguous"
-- when registering.
--
-- Fix: qualify the reference with the table name.

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

  -- Fully-qualified so there's no ambiguity with the return-table
  -- column of the same name.
  if exists (
    select 1 from public.app_users
    where lower(public.app_users.email) = lower(p_email)
  ) then
    raise exception 'email already registered';
  end if;

  insert into public.app_users (email, password_hash)
  values (lower(trim(p_email)), p_password_hash)
  returning public.app_users.id, public.app_users.created_at
    into v_id, v_created;

  return query select v_id, lower(trim(p_email)), v_created;
end;
$$;

revoke all on function public.create_app_user(text, text) from public;
grant execute on function public.create_app_user(text, text) to anon, authenticated;