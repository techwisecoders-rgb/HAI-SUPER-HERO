-- 0007_projects_person_type.sql
-- Extend public.projects so the admin can categorize each "Recent Project"
-- by a person type: users | businesses | workers. Backward compatible:
-- existing rows get 'user'. RLS stays admin-gated (no change needed).

alter table public.projects
  add column if not exists person_type text not null default 'user';
