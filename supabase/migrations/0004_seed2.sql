-- 0004_seed2.sql (auto-generated)

insert into public.projects (id, title, description, image_url, url, sort_order) values
  ('20000000-0000-0000-0000-000000000001','Aperture Studio','Capturing Life''s Most Precious Moments','https://images.unsplash.com/photo-1493863641943-9b68992a8d07?auto=format&fit=crop&w=1000&q=80','https://photographer-one-phi.vercel.app/','0'),
  ('20000000-0000-0000-0000-000000000002','John Doe Studios','Photography','https://res.cloudinary.com/dsresihyk/image/upload/v1777382750/studio_config/xa3le0nxzy1e778rwml7.webp','https://photography-mauve.vercel.app/','1'),
  ('20000000-0000-0000-0000-000000000003','Cafe Miracle Restaurant','Where Every Bite Feels Like A Miracle','https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1000&q=80&auto=format&fit=crop','https://cafe-miracle-sigma.vercel.app/','2')
on conflict (id) do nothing;

insert into public.popular_queries (id, text, sort_order) values
  ('30000000-0000-0000-0000-000000000001','I''m a software developer. Allot me projects','0'),
  ('30000000-0000-0000-0000-000000000002','I need a full stack developer','1'),
  ('30000000-0000-0000-0000-000000000003','I need a android app developer','2'),
  ('30000000-0000-0000-0000-000000000004','I need a maths tutor','3'),
  ('30000000-0000-0000-0000-000000000005','I am a driver. Search near..','4'),
  ('30000000-0000-0000-0000-000000000006','I''m a labour. You can allot works for me','5'),
  ('30000000-0000-0000-0000-000000000007','I need a electrician and plumber','6'),
  ('30000000-0000-0000-0000-000000000008','I need a photographer and videographer','7'),
  ('30000000-0000-0000-0000-000000000009','I need a computer technician','8'),
  ('30000000-0000-0000-0000-00000000000a','I need a graphic designer','9'),
  ('30000000-0000-0000-0000-00000000000b','I need a delivery person','10')
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end $$;
