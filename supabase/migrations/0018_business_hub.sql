-- 0018_business_hub.sql
-- Authenticated business onboarding and management domain.
--
-- The application auth cookie identifies a row in public.app_users. Route
-- handlers validate that cookie and use the service role for privileged writes;
-- direct anon/authenticated access is denied so all ownership checks stay in
-- the API layer. One business profile is allowed per app user.

create extension if not exists pgcrypto;

-- ---------- enums ----------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'business_status') then
    create type public.business_status as enum ('draft', 'published', 'suspended');
  end if;
  if not exists (select 1 from pg_type where typname = 'business_entry_type') then
    create type public.business_entry_type as enum ('item', 'service', 'vacancy');
  end if;
  if not exists (select 1 from pg_type where typname = 'business_order_status') then
    create type public.business_order_status as enum ('pending', 'accepted', 'declined', 'completed', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'business_delivery_status') then
    create type public.business_delivery_status as enum ('unassigned', 'assigned', 'out_for_delivery', 'delivered');
  end if;
end $$;

-- ---------- business profile ----------
create table if not exists public.business_profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references public.app_users(id) on delete cascade,
  slug              text not null unique,
  name              text not null,
  tagline           text,
  description       text,
  owner_name        text,
  owner_bio         text,
  phone             text,
  email             text,
  website           text,
  address           text,
  city              text,
  state             text,
  postal_code       text,
  country           text,
  banner_image_url  text,
  logo_image_url    text,
  category          text,
  status            public.business_status not null default 'draft',
  working_hours     jsonb not null default '{}'::jsonb,
  rating_average    numeric(3,2) not null default 0 check (rating_average between 0 and 5),
  review_count      int not null default 0 check (review_count >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  published_at      timestamptz
);

create index if not exists business_profiles_user_idx
  on public.business_profiles (user_id);
create index if not exists business_profiles_status_idx
  on public.business_profiles (status);

-- ---------- listings ----------
create table if not exists public.business_listings (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.business_profiles(id) on delete cascade,
  title         text not null,
  description   text,
  image_url     text,
  category      text,
  price         numeric(10,2),
  price_unit    text,
  active        boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists business_listings_business_idx
  on public.business_listings (business_id, sort_order, created_at desc);

-- ---------- delivery areas ----------
create table if not exists public.business_delivery_areas (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.business_profiles(id) on delete cascade,
  area          text not null,
  city          text,
  state         text,
  postal_code   text,
  active        boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists business_delivery_areas_business_idx
  on public.business_delivery_areas (business_id, sort_order, created_at desc);

-- ---------- social/contact links ----------
create table if not exists public.business_social_links (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.business_profiles(id) on delete cascade,
  platform      text not null,
  label         text,
  url           text not null,
  icon          text,
  active        boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists business_social_links_business_idx
  on public.business_social_links (business_id, sort_order, created_at desc);

-- ---------- reviews/ratings ----------
create table if not exists public.business_reviews (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.business_profiles(id) on delete cascade,
  reviewer_name text not null,
  rating        int not null check (rating between 1 and 5),
  title         text,
  body          text not null,
  approved      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists business_reviews_business_idx
  on public.business_reviews (business_id, approved, created_at desc);

-- ---------- staff roles ----------
create table if not exists public.business_staff_roles (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.business_profiles(id) on delete cascade,
  role_name     text not null,
  description   text,
  staff_count   int not null default 1 check (staff_count >= 0),
  active        boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists business_staff_roles_business_idx
  on public.business_staff_roles (business_id, sort_order, created_at desc);

-- ---------- items, services, and vacancies ----------
create table if not exists public.business_entries (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.business_profiles(id) on delete cascade,
  listing_id    uuid references public.business_listings(id) on delete set null,
  entry_type    public.business_entry_type not null default 'item',
  title         text not null,
  description   text,
  image_url     text,
  price         numeric(10,2),
  active        boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists business_entries_business_idx
  on public.business_entries (business_id, sort_order, created_at desc);
create index if not exists business_entries_listing_idx
  on public.business_entries (listing_id);

-- ---------- received orders ----------
create table if not exists public.business_orders (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.business_profiles(id) on delete cascade,
  customer_name     text not null,
  customer_phone    text not null,
  customer_email    text,
  address           text not null,
  items             jsonb not null default '[]'::jsonb,
  total_amount      numeric(10,2) not null default 0 check (total_amount >= 0),
  status            public.business_order_status not null default 'pending',
  delivery_status   public.business_delivery_status not null default 'unassigned',
  delivery_boy_name text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  accepted_at       timestamptz,
  assigned_at       timestamptz,
  completed_at      timestamptz
);

create index if not exists business_orders_business_idx
  on public.business_orders (business_id, created_at desc);
create index if not exists business_orders_status_idx
  on public.business_orders (status, created_at desc);

-- ---------- updated_at trigger ----------
create or replace function public.set_business_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists business_profiles_updated_at on public.business_profiles;
create trigger business_profiles_updated_at
  before update on public.business_profiles
  for each row execute function public.set_business_updated_at();

drop trigger if exists business_listings_updated_at on public.business_listings;
create trigger business_listings_updated_at
  before update on public.business_listings
  for each row execute function public.set_business_updated_at();

drop trigger if exists business_delivery_areas_updated_at on public.business_delivery_areas;
create trigger business_delivery_areas_updated_at
  before update on public.business_delivery_areas
  for each row execute function public.set_business_updated_at();

drop trigger if exists business_social_links_updated_at on public.business_social_links;
create trigger business_social_links_updated_at
  before update on public.business_social_links
  for each row execute function public.set_business_updated_at();

drop trigger if exists business_reviews_updated_at on public.business_reviews;
create trigger business_reviews_updated_at
  before update on public.business_reviews
  for each row execute function public.set_business_updated_at();

drop trigger if exists business_staff_roles_updated_at on public.business_staff_roles;
create trigger business_staff_roles_updated_at
  before update on public.business_staff_roles
  for each row execute function public.set_business_updated_at();

drop trigger if exists business_entries_updated_at on public.business_entries;
create trigger business_entries_updated_at
  before update on public.business_entries
  for each row execute function public.set_business_updated_at();

drop trigger if exists business_orders_updated_at on public.business_orders;
create trigger business_orders_updated_at
  before update on public.business_orders
  for each row execute function public.set_business_updated_at();

-- ---------- RLS ----------
alter table public.business_profiles enable row level security;
alter table public.business_listings enable row level security;
alter table public.business_delivery_areas enable row level security;
alter table public.business_social_links enable row level security;
alter table public.business_reviews enable row level security;
alter table public.business_staff_roles enable row level security;
alter table public.business_entries enable row level security;
alter table public.business_orders enable row level security;

-- Direct client access is intentionally blocked. The authenticated API routes
-- validate the app-user cookie and use the service role for every query.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'business_profiles',
    'business_listings',
    'business_delivery_areas',
    'business_social_links',
    'business_reviews',
    'business_staff_roles',
    'business_entries',
    'business_orders'
  ] loop
    execute format(
      'drop policy if exists business_client_access on public.%I',
      table_name
    );
    execute format(
      'create policy business_client_access on public.%I for all to anon, authenticated using (false) with check (false)',
      table_name
    );

    execute format(
      'drop policy if exists business_admin_all on public.%I',
      table_name
    );
    execute format(
      'create policy business_admin_all on public.%I for all using (public.is_admin()) with check (public.is_admin())',
      table_name
    );
  end loop;
end $$;

-- ---------- ownership-safe profile lookup ----------
create or replace function public.get_business_profile_for_user(p_user_id uuid)
returns public.business_profiles
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.business_profiles
  where user_id = p_user_id
  limit 1;
$$;

revoke all on function public.get_business_profile_for_user(uuid) from public;
grant execute on function public.get_business_profile_for_user(uuid) to anon, authenticated;
