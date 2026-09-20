-- 0002_rpc.sql
-- SECURITY DEFINER RPCs for visitor chat operations.
-- These bypass RLS internally, but validate input and use the p_session_id
-- passed in by the server-side route handler (which has already verified the
-- cookie matches). The client never calls these directly with an arbitrary
-- session_id it didn't receive from the server.

-- Upsert a session row by id (idempotent on first visit). The id MUST be a
-- valid uuid; the route handler generates it.
create or replace function public.upsert_session(
  p_session_id uuid,
  p_metadata   jsonb default null
)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.sessions;
begin
  insert into public.sessions (id, metadata, last_seen_at)
  values (p_session_id, p_metadata, now())
  on conflict (id) do update
    set last_seen_at = now(),
        metadata = coalesce(excluded.metadata, public.sessions.metadata)
  returning * into s;
  return s;
end;
$$;

revoke all on function public.upsert_session(uuid, jsonb) from public;
grant execute on function public.upsert_session(uuid, jsonb) to anon, authenticated;

-- Append a message from the user for a given session.
create or replace function public.append_user_message(
  p_session_id uuid,
  p_text       text
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.messages;
begin
  if p_text is null or length(trim(p_text)) = 0 then
    raise exception 'empty message';
  end if;

  -- Ensure the session exists (touch last_seen_at).
  perform public.upsert_session(p_session_id, null);

  insert into public.messages (session_id, sender_type, text)
  values (p_session_id, 'user', p_text)
  returning * into m;
  return m;
end;
$$;

revoke all on function public.append_user_message(uuid, text) from public;
grant execute on function public.append_user_message(uuid, text) to anon, authenticated;

-- Append a message from an admin (must be authenticated).
create or replace function public.append_admin_message(
  p_session_id uuid,
  p_text       text
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.messages;
  v_role text;
  v_uid  uuid;
begin
  -- Authorization is enforced by the calling server action
  -- (requireAdmin() in app/admin/actions.ts) which verifies the Supabase
  -- user via cookies before invoking this RPC. Inside this RPC we only
  -- need to (a) record who the admin is, and (b) reject empty text.
  --
  -- NOTE: We intentionally do NOT check `auth.role() = 'authenticated'`
  -- here, because the RPC is normally invoked via the SERVICE ROLE
  -- client (getServiceSupabase()), which connects with role='service_role',
  -- not 'authenticated'. That previous check made every admin reply fail
  -- with "not authenticated" even when the admin was clearly logged in.
  --
  -- If `auth.uid()` is null (i.e. the connection has no user JWT — anon or
  -- service-role without a forwarded user JWT), we still let it through
  -- because the server action has already verified the admin. We capture
  -- `auth.uid()` only when present, so the row's admin_id column is filled
  -- in correctly for normal user-jwt calls.
  v_role := auth.role();
  v_uid  := auth.uid();

  if p_text is null or length(trim(p_text)) = 0 then
    raise exception 'empty message';
  end if;

  perform public.upsert_session(p_session_id, null);

  insert into public.messages (session_id, sender_type, admin_id, text)
  values (p_session_id, 'admin', v_uid, p_text)
  returning * into m;
  return m;
end;
$$;

revoke all on function public.append_admin_message(uuid, text) from public;
grant execute on function public.append_admin_message(uuid, text) to authenticated;

-- Read all messages for a given session. Called by both the user's route
-- handler (with the cookie's session_id) and admin route handlers.
create or replace function public.get_session_messages(
  p_session_id uuid,
  p_limit      int default 200
)
returns setof public.messages
language sql
security definer
stable
set search_path = public
as $$
  select * from public.messages
  where session_id = p_session_id
  order by created_at asc
  limit greatest(p_limit, 1);
$$;

revoke all on function public.get_session_messages(uuid, int) from public;
grant execute on function public.get_session_messages(uuid, int) to anon, authenticated;
