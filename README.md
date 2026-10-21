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

### Restricting who may use the admin dashboard

The admin dashboard and its management APIs additionally enforce a
server-side entitlement check in `lib/admin/guard.ts`:

1. The Supabase Auth session must be valid (the JWT is validated by
   Supabase, not by the app).
2. The account must carry an admin role claim, or be listed in the
   optional `ADMIN_EMAILS` environment variable (comma-separated).

`app_metadata.role = "admin"` is the strongest signal because only the
service-role key can set it. To grant an admin, set it with the Supabase
dashboard or:

```bash
# one-off, using the service-role key from .env.local
node -e "const{createClient}=require('@supabase/supabase-js');const e=require('fs').readFileSync('.env.local','utf8');const g=k=>e.split('\n').find(l=>l.startsWith(k+'='))?.split('=')[1].trim();const s=createClient(g('NEXT_PUBLIC_SUPABASE_URL'),g('SUPABASE_SERVICE_ROLE_KEY'));s.auth.admin.updateUserById(process.argv[1],{app_metadata:{role:'admin'}})" <auth-user-id>
```

Alternatively set `ADMIN_EMAILS=admin@yourcompany.com` in `.env.local`
(or the deployment environment) — when it is present it becomes the
authoritative list.

> Worker and business owners sign in through a *different* system (the
> `app_users` table and the `accompany_app_user` cookie), so they never
> hold a Supabase Auth session and can never reach an admin endpoint.

## Admin dashboard

`/admin` is a server-rendered dashboard that verifies the session before
rendering and redirects to `/admin/login` when it is missing or invalid.

```
Admin Dashboard
[ Workers ] [ Businesses ]        [ Register as a Business ]
                                  [ Sign Out ]
```

* **Workers / Businesses** — list, search, filter, sort and paginate the
  real rows of `public.worker_profiles` and `public.business_profiles`.
  Selecting a row opens the full profile; **Edit** opens a validated form
  that writes straight back to the database.
* **Register as a Business** — unchanged behaviour: it creates the login
  credentials for a business owner.
* **Sign Out** — invalidates the Supabase session server-side *and* in the
  browser, then returns to the admin login page.

The existing chat console (sessions list, live thread, composer) and the
Projects panel are preserved and reachable from the console view.

### Admin HTTP API

All endpoints require an administrator session and return structured
errors with the appropriate status code.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/workers/list` | Paginated worker list. `?search=&profession=&location=&availability=&sort=&order=&page=&perPage=` |
| `GET` | `/api/workers/[id]` | One worker profile by database id |
| `PATCH` | `/api/workers/[id]` | Update a worker profile |
| `GET` | `/api/businesses/list` | Paginated business list. `?search=&category=&location=&status=&sort=&order=&page=&perPage=` |
| `GET` | `/api/businesses/[id]` | One business profile by database id |
| `PATCH` | `/api/businesses/[id]` | Update a business profile |
| `DELETE` | `/api/admin/session` | Sign the administrator out |

## Telegram notifications

Every message a visitor writes on the chat is pushed to a Telegram chat, so
the team can reply from the phone instead of watching the dashboard.

### 1. Create the bot

1. Open [@BotFather](https://t.me/BotFather) in Telegram → `/newbot`.
2. Copy the token it gives you (`123456789:AA...`).

### 2. Find your chat id

1. Send any message to your bot (or add the bot to a group and post there).
2. Open `https://api.telegram.org/bot<TOKEN>/getUpdates`.
3. Copy `result[].message.chat.id`.

### 3. Configure the environment

```bash
# .env.local
TELEGRAM_BOT_TOKEN=123456789:AA...
TELEGRAM_CHAT_ID=5987654321
```

`TELEGRAM_CHAT_ID` accepts a comma separated list (`"5987654321,-1001234567890"`)
to deliver every notification to several chats at once.

> The bot token is server-only — it is never sent to the browser.

### 4. Verify

```bash
npm run telegram:test
```

The script prints the bot identity and sends a real test message to every
configured chat. The admin dashboard also has a Telegram button next to the
notification bell that sends the same test message.

### What is sent

| Trigger | Notification |
| --- | --- |
| A visitor sends a chat message | 🔔 New message from a visitor (name, city, e-mail, text, link) |
| A visitor submits the worker registration form | 🔔 The registration summary, mirrored to the chat and to Telegram |
| An admin replies | 💬 New reply sent to a visitor (set `TELEGRAM_NOTIFY_ADMIN_REPLIES=false` to disable) |

The "Open this conversation" link points at `/admin?session=<uuid>`, which
opens the admin console directly on that thread (the deep link survives the
login round-trip).

Notifications are strictly best-effort: a Telegram outage is logged and
ignored — it can never break the chat. Every request has a 5 second timeout.

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
    page.tsx                    /admin     (server guard + dashboard shell)
    dashboard.tsx               (nav: Workers | Businesses, Register, Sign Out)
    dashboard.module.css
    conversations-panel.tsx     (chat console: sessions list + live thread)
    workers-panel.tsx           (worker list: search, filters, sort, paging)
    worker-details.tsx          (worker profile + edit form)
    businesses-panel.tsx        (business list)
    business-details.tsx        (business profile + edit form)
    register-business-modal.tsx  (Register as a Business)
    render.tsx                  (chat console UI, split out for size)
    admin.module.css
    actions.ts                  (server actions, service role)
  api/
    session/route.ts            POST accept|decline|bootstrap
    messages/route.ts           POST user message
    messages/[sessionId]/route.ts  GET thread (own session only)
    categories/route.ts         GET categories + items
    popular/route.ts            GET popular queries
    projects/route.ts           GET projects
    workers/list/route.ts       GET  (admin) worker list
    workers/[id]/route.ts       GET|PATCH (admin) one worker
    businesses/list/route.ts    GET  (admin) business list
    businesses/[id]/route.ts    GET|PATCH (admin) one business
    admin/session/route.ts      DELETE (admin) sign out
components/
  CookieBanner.tsx
content/                        seed data mirroring the DB
lib/
    admin/
      guard.ts                   server-side admin authorization
      http.ts                    shared error/status handling
      directory.ts               worker/business list + read (service role)
      updates.ts                 worker/business updates (zod validated)
      session.ts                 admin sign-out
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
