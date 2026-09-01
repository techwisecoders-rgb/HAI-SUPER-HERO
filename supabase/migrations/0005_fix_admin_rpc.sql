-- 0005_fix_admin_rpc.sql
-- Bugfix: append_admin_message was rejecting every admin reply with
-- "not authenticated" because it checked `auth.role() = 'authenticated'`.
-- The function is invoked from app/admin/actions.ts via the SERVICE ROLE
-- client, so auth.role() is always 'service_role' on that connection —
-- the check was structurally impossible to pass.
--
-- Authorization is already enforced upstream by requireAdmin() in
-- app/admin/actions.ts, so we drop the role check entirely and only
-- record auth.uid() when present. Re-running is idempotent.

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
  v_uid uuid;
begin
  -- See 0002_rpc.sql / app/admin/actions.ts for the rationale.
  v_uid := auth.uid();

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