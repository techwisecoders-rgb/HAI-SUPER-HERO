-- 0008_fix_bootstrap_session_id_ambiguity.sql
-- Fix: `bootstrap_session_for_user` references unqualified `id` inside
-- its body, but the function is declared as `returns public.sessions`
-- which makes `id` visible both as the table column and as a column
-- of the return-row type. PostgreSQL considers this ambiguous and
-- returns "column reference 'id' is ambiguous" when creating an
-- account (verify-otp -> bootstrap_session_for_user path).
--
-- Fix: qualify every `id` reference with the table alias.

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
    -- Fully-qualified to remove the ambiguity with the function's
    -- own return type (which also has an `id` column).
    update public.sessions
       set last_seen_at = now()
     where id = s.id
     returning * into s;
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