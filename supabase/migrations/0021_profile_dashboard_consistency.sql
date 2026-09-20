-- Apply after 0018, 0019 and 0020. Does not replace missing base migrations.
-- Keep database-managed review summaries consistent with approved reviews.
create or replace function public.refresh_business_review_summary()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_id uuid;
begin
  if tg_op = 'DELETE' then target_id := old.business_id;
  else target_id := new.business_id;
  end if;

  -- Serialize summary updates for the same business.
  perform 1 from public.business_profiles where id = target_id for update;
  update public.business_profiles p
  set rating_average = summary.average_rating, review_count = summary.total
  from (
    select coalesce(round(avg(r.rating)::numeric, 2), 0) as average_rating,
           count(*)::integer as total
    from public.business_reviews r
    where r.business_id = target_id and r.approved = true
  ) summary
  where p.id = target_id;

  if tg_op = 'UPDATE' and old.business_id is distinct from new.business_id then
    perform 1 from public.business_profiles where id = old.business_id for update;
    update public.business_profiles p
    set rating_average = summary.average_rating, review_count = summary.total
    from (
      select coalesce(round(avg(r.rating)::numeric, 2), 0) as average_rating,
             count(*)::integer as total
      from public.business_reviews r
      where r.business_id = old.business_id and r.approved = true
    ) summary
    where p.id = old.business_id;
  end if;
  return null;
end;
$$;

drop trigger if exists business_review_summary on public.business_reviews;
create trigger business_review_summary
after insert or update or delete on public.business_reviews
for each row execute function public.refresh_business_review_summary();

-- Recompute previously stale summaries, including businesses with no reviews.
update public.business_profiles p
set review_count = (select count(*) from public.business_reviews r where r.business_id = p.id and r.approved),
    rating_average = (select coalesce(round(avg(r.rating)::numeric, 2), 0) from public.business_reviews r where r.business_id = p.id and r.approved);

-- API uploads are service-role only. Public URLs are required by the UI.
insert into storage.buckets (id, name, public)
values ('worker-media', 'worker-media', true), ('business-media', 'business-media', true)
on conflict (id) do update set public = excluded.public;

notify pgrst, 'reload schema';
