-- 0016_message_notifications.sql
--
-- Adds notification support for the chat system. We track per-session
-- "last read" state so the admin can see which visitor sessions have
-- unread messages, and a per-message "notified" flag so we don't fire
-- duplicate notifications for the same message.
--
-- Changes:
--   1. sessions.last_read_by_admin_at timestamptz
--      Set whenever the admin opens/views a session, or sends a reply
--      (sending implies "I've read everything up to this message").
--      Used to compute unread counts for each session.
--   2. messages.notified boolean
--      Marks a message as having already triggered a notification,
--      so the realtime listener only fires once per message even if
--      the channel resubscribes / reconnects.
--   3. RPC mark_session_read(p_session_id)
--      SECURITY DEFINER helper called by the admin client whenever
--      a session is opened or a reply is sent.
--   4. RPC list_sessions_with_unread()
--      Returns sessions + their unread message count (admin-only,
--      used by the admin UI to show a badge per session).

-- ---------- sessions.last_read_by_admin_at ----------
alter table public.sessions
  add column if not exists last_read_by_admin_at timestamptz;

-- ---------- messages.notified ----------
alter table public.messages
  add column if not exists notified boolean not null default false;

create index if not exists messages_notified_idx
  on public.messages (notified, session_id)
  where notified = false;

-- ---------- mark_session_read ----------
-- Bumps the session's last_read_by_admin_at to now(). The admin UI
-- calls this whenever a session is opened or whenever an admin sends
-- a reply (so sending implies "I've read everything up to this").
create or replace function public.mark_session_read(p_session_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  update public.sessions
     set last_read_by_admin_at = v_now
   where id = p_session_id;
  return v_now;
end;
$$;

revoke all on function public.mark_session_read(uuid) from public;
grant execute on function public.mark_session_read(uuid) to authenticated;

-- ---------- list_sessions_with_unread ----------
-- Returns sessions (most recently seen first) with an `unread_count`
-- column showing how many messages are newer than the session's
-- last_read_by_admin_at (or all messages if never read).
--
-- Used by the admin realtime listener to show a badge per session
-- whenever a new user message arrives.
create or replace function public.list_sessions_with_unread()
returns table (
  id uuid,
  created_at timestamptz,
  last_seen_at timestamptz,
  last_read_by_admin_at timestamptz,
  display_name text,
  metadata jsonb,
  unread_count bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    s.id,
    s.created_at,
    s.last_seen_at,
    s.last_read_by_admin_at,
    s.display_name,
    s.metadata,
    (
      select count(*)
      from public.messages m
      where m.session_id = s.id
        and m.sender_type = 'user'
        and (
          s.last_read_by_admin_at is null
          or m.created_at > s.last_read_by_admin_at
        )
    ) as unread_count
  from public.sessions s
  order by s.last_seen_at desc
  limit 200;
$$;

revoke all on function public.list_sessions_with_unread() from public;
grant execute on function public.list_sessions_with_unread() to authenticated;
