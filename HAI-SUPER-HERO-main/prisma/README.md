# Prisma / Supabase database model

The application uses Supabase as the hosted PostgreSQL database and keeps its existing Supabase SQL migration runner for deployment. `schema.prisma` documents the WorkerProfile and BusinessProfile PostgreSQL models, while the matching Prisma migration is kept under `prisma/migrations/`.

The application runtime intentionally continues to use the existing server-side Supabase client so the established authentication/RLS architecture is not replaced.

For a direct Prisma workflow, provide:
- `DATABASE_URL` — Supabase pooled PostgreSQL URL
- `DIRECT_URL` — Supabase direct PostgreSQL URL

The current `.env` contains the existing application's Supabase API credentials but does not contain the database password, so no fake Prisma connection string was added.
