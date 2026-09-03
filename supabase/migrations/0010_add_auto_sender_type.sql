-- 0010_add_auto_sender_type.sql
-- Extend the messages.sender_type enum so the chat UI can visually
-- distinguish bot/auto replies from real admin (human) replies. Real
-- admin replies stop the "thinking" indicator; auto replies are styled
-- differently but don't.
--
-- Adding a value to an existing enum is safe and does not require a
-- data migration. All existing rows keep their value ('user' / 'admin').

do $$ begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'sender_type' and e.enumlabel = 'auto'
  ) then
    alter type sender_type add value 'auto';
  end if;
end $$;