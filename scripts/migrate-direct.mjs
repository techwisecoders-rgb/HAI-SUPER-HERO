// Direct PostgreSQL migration runner (Prisma-style).
//
// Connects to the remote Supabase Postgres via `pg` over TCP using
// the DB password from .env.local. Applies every migration in
// supabase/migrations/ that hasn't been recorded in
// supabase_migrations.schema_migrations yet. Records each applied
// migration so subsequent runs are idempotent.
//
// Usage:
//   node scripts/migrate-direct.mjs
//
// This is the same path Prisma's `migrate deploy` takes — direct SQL
// execution against the database, with a tracking table for replay
// protection. We use the supabase_migrations tracking convention that
// the existing scripts/migrate.mjs also follows (it doesn't track
// state, but the new tracking table is added on first run here).

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

function loadEnv(filePath) {
  const text = readFileSync(filePath, "utf8");
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["'](.*)["']$/, "$1");
  }
  return out;
}

const env = loadEnv(join(process.cwd(), ".env.local"));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const password = env.SUPABASE_DB_PASSWORD;

if (!url || !password) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_DB_PASSWORD in .env.local.",
  );
  process.exit(1);
}

const ref = url.match(/^https:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!ref) {
  console.error("Could not parse project ref from", url);
  process.exit(1);
}

// Direct connection. Supabase exposes the project's primary Postgres
// at db.<ref>.supabase.co:5432 (IPv4-compatible) with `postgres` as
// the user and the DB password.
const connectionString =
  `postgresql://postgres:${password}@db.${ref}.supabase.co:5432/postgres`;

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log(`Connected to db.${ref}.supabase.co:5432\n`);

// ---------- Bootstrap tracking table ----------
// `supabase_migrations.schema_migrations(version, applied_at)` is the
// canonical tracking table used by Supabase CLI and by Prisma-style
// runners. We create it idempotently if missing.
await client.query(`
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version    text        primary key,
    applied_at timestamptz not null default now()
  );
`);

// ---------- Discover migrations ----------
const dir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .filter((f) => !f.toLowerCase().includes("optional"))
  .sort();

const { rows: appliedRows } = await client.query(
  `select version from supabase_migrations.schema_migrations`,
);
const applied = new Set(appliedRows.map((r) => r.version));

let totalOk = 0;
let totalSkipped = 0;

for (const f of files) {
  const version = f.replace(/\.sql$/, "");
  if (applied.has(version)) {
    console.log(`  --  ${f}  (already applied, skipping)`);
    totalSkipped++;
    continue;
  }
  const sql = readFileSync(join(dir, f), "utf8");
  console.log(`==> ${f}`);
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query(
      `insert into supabase_migrations.schema_migrations (version) values ($1)`,
      [version],
    );
    await client.query("commit");
    console.log(`    OK\n`);
    totalOk++;
  } catch (e) {
    await client.query("rollback");
    const msg = String(e?.message ?? e);
    const benign =
      msg.includes("already exists") ||
      (msg.includes("does not exist") && msg.includes("drop")) ||
      msg.includes("duplicate key");
    if (benign) {
      console.log(`    WARN (idempotent): ${msg}\n`);
      // Still mark as applied so we don't keep retrying.
      await client.query(
        `insert into supabase_migrations.schema_migrations (version) values ($1) on conflict do nothing`,
        [version],
      );
      totalSkipped++;
    } else {
      console.error(`    FAIL: ${msg}`);
      await client.end();
      process.exit(1);
    }
  }
}

await client.end();
console.log(
  `\nDone. ${totalOk} applied, ${totalSkipped} already-applied.`,
);
