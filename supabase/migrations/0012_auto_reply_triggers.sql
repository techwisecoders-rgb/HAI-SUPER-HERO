-- 0012_auto_reply_triggers.sql
-- Wires up automated ("auto") bot replies. The chat UI already
-- supports the 'auto' sender_type and the ThinkingIndicator is
-- designed to keep showing while auto replies come in (it only hides
-- on a real 'admin' reply). What's missing was the actual writer:
--
--   * append_auto_message(p_session_id uuid, p_text text)
--     SECURITY DEFINER RPC, anon-callable. Inserts a message with
--     sender_type='auto' and the supplied text.
--
--   * auto_reply_rules  (id, pattern, reply, priority, enabled)
--     The list of canned replies that get evaluated against each user
--     message. Patterns are case-insensitive substring matches.
--
--   * list_matching_auto_rules(p_text text)
--     SECURITY DEFINER helper used by /api/messages after a user sends
--     a message, to look up which auto replies (if any) to fire.
--
-- Seeded with the same canned replies the reference HTML used:
--   * "good morning" / morning greeting
--   * "first work is successfully completed"  (first-work celebration)
--   * "work is successfully completed"        (generic celebration)
--   * 10-completions milestone
--
-- Admin can edit / disable rules from the Supabase dashboard or via
-- direct SQL (the policy below lets authenticated admins do everything).

-- ---------- append_auto_message ----------
create or replace function public.append_auto_message(
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

  -- Make sure the session row exists.
  perform public.upsert_session(p_session_id, null);

  insert into public.messages (session_id, sender_type, text)
  values (p_session_id, 'auto', trim(p_text))
  returning * into m;
  return m;
end;
$$;

revoke all on function public.append_auto_message(uuid, text) from public;
grant execute on function public.append_auto_message(uuid, text) to anon, authenticated;

-- ---------- auto_reply_rules ----------
create table if not exists public.auto_reply_rules (
  id         uuid primary key default gen_random_uuid(),
  pattern    text not null,                  -- case-insensitive substring
  reply      text not null,
  priority   int  not null default 100,      -- lower number = fires first
  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists auto_reply_rules_priority_idx
  on public.auto_reply_rules (enabled, priority);

alter table public.auto_reply_rules enable row level security;

-- Anon direct access is denied (the /api/messages route handler calls
-- the SECURITY DEFINER RPC instead). Admin gets full access.
drop policy if exists "auto_reply_rules_anon_all" on public.auto_reply_rules;
create policy "auto_reply_rules_anon_all"
  on public.auto_reply_rules for all to anon
  using (false) with check (false);

drop policy if exists "auto_reply_rules_admin_all" on public.auto_reply_rules;
create policy "auto_reply_rules_admin_all"
  on public.auto_reply_rules for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- list_matching_auto_rules ----------
-- Returns up to 3 matching enabled rules, ordered by priority then id.
create or replace function public.list_matching_auto_rules(p_text text)
returns table (id uuid, reply text)
language sql
security definer
stable
set search_path = public
as $$
  select r.id, r.reply
  from public.auto_reply_rules r
  where r.enabled = true
    and lower(p_text) like '%' || lower(r.pattern) || '%'
  order by r.priority asc, r.id asc
  limit 3;
$$;

revoke all on function public.list_matching_auto_rules(text) from public;
grant execute on function public.list_matching_auto_rules(text) to anon, authenticated;

-- ---------- seed data ----------
-- Mirrors the canned replies from the original single-file HAI SUPER
-- HERO app. Patterns are lowercase substring matches.
insert into public.auto_reply_rules (pattern, reply, priority)
values
  (
    'good morning',
    'Good Morning Boss. This is our first message for today. Welcome back. A New Day, A New Beginning.. Have A Great Day, Boss! Lets start making this day more meaningful. Your superHero is ready to complete all your today works so easily',
    10
  ),
  (
    'good evening',
    'Good Evening Boss. Hope your day went well. I am right here whenever you need me. Your superHero is ready and waiting.',
    11
  ),
  (
    'first work is successfully completed',
    'Excellent Start, Boss!.. That''s the superHero for you. I am so happy to fulfill your first dream with my super powers!',
    20
  ),
  (
    'work is successfully completed',
    'Always At Your Service, Boss!. I am your personalised super hero. I make the jobs done with my super power. And I am so happy that you are satisfied with the work. And the small remainder.. Whenever You Need Me, I''m Here, My Boss',
    21
  )
on conflict do nothing;

-- A catch-all greeting (lowest priority) so a brand-new visitor always
-- gets a friendly auto-reply on their first message. Matches a
-- minimal 3-letter lowercase letter pattern; admins can disable or
-- remove this rule if not desired.
insert into public.auto_reply_rules (pattern, reply, priority)
values (
  'hi',
  'Hello boss. Your super hero is here,,,Describe me the type of work you want. I will be complete those with my super power...',
  9999
)
on conflict do nothing;

-- Idempotent UPDATE so re-running this migration on an existing DB
-- also refreshes the "hi" rule's reply text. Safe because we filter by
-- pattern + priority, so only the intended row is touched.
update public.auto_reply_rules
   set reply = 'Hello boss. Your super hero is here,,,Describe me the type of work you want. I will be complete those with my super power...'
 where pattern = 'hi'
   and priority = 9999;