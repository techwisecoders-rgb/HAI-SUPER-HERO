# HAI SUPER HERO — full-stack rebuild

A modern, production-ready rebuild of the original single-file HTML/CSS/JS HAI SUPER HERO app, using:

- **Next.js 14 (App Router, TypeScript)**
- **Supabase** (Postgres + Auth + Realtime) — no separate Express server
- **Tailwind CSS** for utility styling, with **CSS Modules** for the page-specific animations
- **Zod** for input validation
- **Vercel-friendly** project structure

The look and feel (Chakra splash, gradient palette, dvh keyboard-avoidance for the chat input bar, rotating carousels) is preserved. The architecture, persistence, realtime, and admin tooling are new.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase creds
# run the SQL migrations (see "Supabase setup" below)
# seed your first admin (see "Seeding the first admin" below)
npm run dev

```

## Supabase setup

1. Create a project at <https://supabase.com>.
2. From the project dashboard grab:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` *(server only; never prefix with `NEXT_PUBLIC_`!)*
3. In the **SQL Editor**, run in order:
   - `supabase/migrations/0001_schema.sql` — tables, enums, RLS
   - `supabase/migrations/0002_rpc.sql`     — `upsert_session`, `append_user_message`, `append_admin_message`, `get_session_messages`
   - `supabase/migrations/0003_seed.sql`    — categories + category items
   - `supabase/migrations/0004_seed2.sql`   — projects + popular queries
4. **Realtime**: ensure the `messages` table is in the `supabase_realtime` publication (new Supabase projects include it by default).

## Seeding the first admin

There is no public sign-up. Create your admin directly in Supabase Auth:

**Option A — dashboard (manual):**
1. Supabase → **Authentication → Users → Add user** → create with email + password.
2. Sign in at `/admin/login` with those credentials.

**Option B — script (uses your local service-role key, never leaves your machine):**

```bash
npm run admin:create -- --email admin@yourcompany.com --password 'StrongPass!23'
```

The script reads `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` and calls the
Supabase Auth admin API. The user is created with `email_confirm: true` so you
can log in immediately. Re-running with the same email is a no-op (prints a
warning instead of failing).

The `is_admin()` Postgres function treats any authenticated user as an admin.

## Deploying to Vercel

1. Push the repo to GitHub.
2. Import into Vercel.
3. Add the environment variables from `.env.example` to the Vercel project settings.
4. Deploy. The `middleware.ts` runs on the edge and gates `/admin/*` correctly.

## Database setup (one-time)

The app needs Postgres + Auth + Realtime. The schema and seed live as SQL files in `supabase/migrations/` and a Node runner in `scripts/`.

**Option A — automatic (recommended):** the project ships a Node migration runner. Get the database password from Supabase → **Settings → Database**, then:

```bash
# 1. Set DATABASE_URL in your shell (or .env.local)
#    Format: postgresql://postgres:PASSWORD@db.<ref>.supabase.co:5432/postgres
$env:DATABASE_URL = "postgresql://postgres:YOUR_PASSWORD@db.nsedgabikoipvkqdvwxr.supabase.co:5432/postgres"

# 2. Run schema + RPCs + seeds in one shot
npm run db:migrate
npm run db:seed

# 3. Verify
npm run db:verify
```

The `db:migrate` script runs every file in `supabase/migrations/` in alphabetical order. The `db:seed` script also enables Realtime on the `messages` table.

**Option B — manual:** open Supabase → **SQL Editor**, paste each file from `supabase/migrations/` in order (0001, 0002, 0003, 0004), click Run.

**Realtime setup:** `db:seed` adds the `messages` table to the `supabase_realtime` publication. If you ran migrations manually, go to **Database → Replication** and toggle `public.messages` on.

**Create the first admin user:** Supabase → **Authentication → Users → Add user** (any email + password). Then sign in at `/admin/login`.

### Helper scripts

- `npm run db:migrate` — runs all `supabase/migrations/*.sql` files in order (idempotent — safe to re-run).
- `npm run db:seed` — populates categories/items/projects/popular queries and enables Realtime (idempotent).
- `npm run db:verify` — prints tables, functions, RLS policies, and row counts.

All three require the database password. Pass it as the connection string in `DATABASE_URL` or as a CLI argument:

```bash
node scripts/verify.mjs "postgresql://postgres:PASSWORD@db.REF.supabase.co:5432/postgres"
```

## Project structure

```
app/
  page.tsx                      /          (Chakra splash)
  page.module.css
  chat/page.tsx                 /chat      (chat UI + realtime)
  chat/page.module.css
  trending/page.tsx             /trending  (categories + carousel)
  trending/page.module.css
  projects/page.tsx             /projects  (carousel + About Us)
  projects/page.module.css
  privacy/page.tsx              /privacy
  admin/
    layout.tsx
    login/page.tsx              /admin/login
    page.tsx                    /admin     (session list + thread)
    render.tsx                  (admin UI, split out for size)
    admin.module.css
    actions.ts                  (server actions, service role)
  api/
    session/route.ts            POST accept|decline|bootstrap
    messages/route.ts           POST user message
    messages/[sessionId]/route.ts  GET thread (own session only)
    categories/route.ts         GET categories + items
    popular/route.ts            GET popular queries
    projects/route.ts           GET projects
components/
  CookieBanner.tsx
content/                        seed data mirroring the DB
lib/
  cookies.ts                    cookie name + Set-Cookie helpers
  use-keyboard-aware-input.ts   dvh keyboard-avoid hook
  use-session.ts                client cookie reader hook
  supabase/
    client.ts                   browser supabase (anon)
    server.ts                   service-role supabase (server only)
    server-user.ts              per-request RLS-bound supabase
supabase/migrations/            0001_schema, 0002_rpc, 0003_seed, 0004_seed2
types/index.ts                  shared TS types
middleware.ts                   protects /admin/*
```

## Cookies & privacy

- We set **one** non-essential cookie: `accompany_session_id` (a random UUID).
- The `CookieBanner` is rendered on the landing page. Until the user accepts, **no chat-persistence cookies are set** and no DB writes occur.
- **Decline** path: the app still works in-memory for the current tab; the banner won't re-appear during the same session, but it will on the next visit.
- The session id is generated **server-side** (`POST /api/session`) so the client can't mint arbitrary ids.

## Real-time behavior

- The user chat page subscribes to `postgres_changes` on `messages` filtered by its own `session_id`. New admin messages appear live and auto-scroll.
- The admin dashboard subscribes to **all** `messages` inserts to refresh the session list, and to a per-session channel for the open thread.
- The Supabase JS client requires that `messages` is in the `supabase_realtime` publication.

## Intentional behavioral changes from the original

- **Category order on the Trending page.** The original vanilla `onclick` indices were scrambled relative to the visual order. The categories now render in the visual order described in the spec: Technical, Home, Personal, Educational, Business, Creative, Transport.
- **Carousel intervals are component-scoped.** The original had a global `setInterval` that wasn't cleared cleanly when navigating between pages. The rebuilt code uses `useEffect` with proper cleanup, so intervals stop the moment you leave the page.
- **Mobile keyboard handling** is now a reusable `useKeyboardAwareInput` hook, ported faithfully from the original `visualViewport` listener.
- **Chat persistence** requires explicit cookie consent. The original stored everything in Firebase without a consent step.

## Deploying to Vercel

1. Push the repo to GitHub.
2. Import into Vercel.
3. Add the environment variables from `.env.example` to the Vercel project settings.
4. Deploy. The `middleware.ts` runs on the edge and gates `/admin/*` correctly.
#   H A I - S U P E R - H E R O  
 