-- ---------- Lookup worker registration by session/user ----------
-- Returns the most recent worker_registrations row whose session_id
-- or user_id matches the provided values. Used by GET
-- /api/worker/registration so the /register page can show "you are
-- already registered" with the existing details instead of presenting
-- the empty form to a returning visitor.
--
-- SECURITY DEFINER so it can run even when RLS would otherwise block
-- anon reads on worker_registrations. The function restricts the
-- lookup to the supplied session_id / user_id (which come from the
-- caller's cookies, server-trusted) so it can't be used to enumerate
-- other visitors.
--
-- Either argument may be null — that's a normal state for an anonymous
-- visitor with no app_user login. The OR-clause handles nulls safely
-- (rows with NULL session_id / user_id will only match when the caller
-- passes the matching non-null value).
create or replace function public.get_worker_registration_for_session(
  p_session_id uuid,
  p_user_id    uuid
)
returns setof public.worker_registrations
language sql
security definer
stable
set search_path = public
as $$
  select * from public.worker_registrations
  where (
        (p_session_id is not null and session_id = p_session_id)
     or (p_user_id    is not null and user_id    = p_user_id)
  )
  order by created_at desc
  limit 1;
$$;

revoke all on function public.get_worker_registration_for_session(uuid, uuid) from public;
grant execute on function public.get_worker_registration_for_session(uuid, uuid) to anon, authenticated;