-- 0013_first_message_welcome.sql
--
-- Ensure an automated welcome message ALWAYS fires on a visitor's
-- very first message in a session, regardless of what they type.
-- After the first message, normal pattern-based rules continue to
-- apply (good morning, first work completed, etc.).
--
-- Implementation:
--   * Adds an is_welcome boolean column to auto_reply_rules so the
--     welcome row is identified by a flag, not by a magic pattern
--     string. (Earlier attempts used NUL-wrapped sentinels but
--     Postgres rejects NUL bytes in text columns.)
--   * Updates list_matching_auto_rules(p_text, p_session_id) to also
--     check the session's message count: if the session has exactly
--     one message (the just-inserted user message), the welcome rule
--     is prepended to the result.
--   * Returns at most 1 welcome + 3 pattern matches = 4 rows total.

-- Add the flag column (idempotent).
alter table public.auto_reply_rules
  add column if not exists is_welcome boolean not null default false;

-- Seed the welcome rule. We delete any prior welcome row first so we
-- don't accumulate duplicates on re-runs.
delete from public.auto_reply_rules
 where reply like 'Welcome to HAI SUPER HERO! I am HI%';

insert into public.auto_reply_rules (pattern, reply, priority, is_welcome)
values (
  '__first_message__',
  'Welcome to HAI SUPER HERO! I am HI — your personalised super hero. Tell me what you need (a developer, a tutor, a plumber, anything) and I will connect you with the right help. You can also tap the "Popular Searches" pill to browse common requests.',
  0,   -- highest priority; fires before any pattern match
  true  -- marks this row as the welcome rule
);

-- Make sure at most one welcome rule exists.
delete from public.auto_reply_rules a
  using public.auto_reply_rules b
  where a.is_welcome = true
    and b.is_welcome = true
    and a.ctid > b.ctid;

-- Dedupe the pattern-match rules. Earlier migration runs accumulated
-- 6 copies of each seeded rule; this keeps the lowest-ctid row for
-- each (pattern, reply) pair and removes the rest. Future inserts
-- are unaffected.
delete from public.auto_reply_rules a
  using public.auto_reply_rules b
  where a.ctid < b.ctid
    and a.pattern = b.pattern
    and a.reply   = b.reply
    and a.is_welcome = false
    and b.is_welcome = false;

-- Drop any old overloads of list_matching_auto_rules so we can replace
-- the single-arg version with the new two-arg version cleanly. (Postgres
-- treats functions with different arg lists as different functions, so
-- a simple CREATE OR REPLACE wouldn't drop the old one.)
drop function if exists public.list_matching_auto_rules(text);

-- Replace the lookup function with the new signature.
create or replace function public.list_matching_auto_rules(
  p_text       text,
  p_session_id uuid
)
returns table (id uuid, reply text, is_welcome boolean)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_count int;
begin
  -- 1. First-message welcome: fires once per session, before any
  --    pattern-based reply. We use a CTE so the welcome rule is
  --    returned even when p_text doesn't match anything else.
  --
  --    By the time this RPC is called from /api/messages, the just-
  --    sent user message has already been inserted (count >= 1).
  --    When count = 1, this is the session's first user message.
  --    When count >= 2, prior messages exist — welcome has already
  --    fired (or this isn't a fresh session).
  select count(*) into v_count
    from public.messages
   where session_id = p_session_id;

  return query
    with welcome as (
      select r.id, r.reply, true as is_welcome
      from public.auto_reply_rules r
      where r.enabled = true
        and r.is_welcome = true
        and v_count = 1
      limit 1
    ),
    matches as (
      select r.id, r.reply, false as is_welcome
      from public.auto_reply_rules r
      where r.enabled = true
        and r.is_welcome = false
        and lower(p_text) like '%' || lower(r.pattern) || '%'
      order by r.priority asc, r.id asc
      limit 3
    )
    select w.id, w.reply, w.is_welcome from welcome w
    union all
    select m.id, m.reply, m.is_welcome from matches m;
end;
$$;

revoke all on function public.list_matching_auto_rules(text, uuid) from public;
grant execute on function public.list_matching_auto_rules(text, uuid) to anon, authenticated;