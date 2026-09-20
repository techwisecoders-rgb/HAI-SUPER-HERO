import pg from "pg";

const url = "postgresql://postgres:9SLrdC%LFd3mX9V@db.nsedgabikoipvkqdvwxr.supabase.co:5432/postgres";
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

const r = await c.query(
  "select pubname, schemaname, tablename from pg_publication_tables where pubname='supabase_realtime' order by tablename",
);
console.log("Realtime publication tables:");
console.log(JSON.stringify(r.rows, null, 2));

const msgs = await c.query(
  "select id, session_id, sender_type, text, created_at from public.messages order by created_at desc limit 5",
);
console.log("\nLast 5 messages in DB:");
console.log(JSON.stringify(msgs.rows, null, 2));

await c.end();