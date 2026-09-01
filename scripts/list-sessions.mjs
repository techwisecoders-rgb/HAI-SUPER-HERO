import pg from "pg";

const url = "postgresql://postgres:9SLrdC%LFd3mX9V@db.nsedgabikoipvkqdvwxr.supabase.co:5432/postgres";
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

const r = await c.query(`
  select s.id, s.user_id, s.display_name, s.last_seen_at,
         (select count(*) from public.messages m where m.session_id = s.id) as msg_count
  from public.sessions s
  order by s.last_seen_at desc
  limit 10
`);
console.log("Sessions:");
console.log(JSON.stringify(r.rows, null, 2));

await c.end();