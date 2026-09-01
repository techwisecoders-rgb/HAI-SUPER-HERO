// One-off DB inspector.
// Usage: node scripts/verify.mjs "postgresql://..."
import pg from "pg";

const url = process.argv[2];
if (!url) { console.error("Usage: node scripts/verify.mjs <url>"); process.exit(1); }

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

const tables = await c.query(
  "select tablename from pg_tables where schemaname='public' order by tablename"
);
const fns = await c.query(
  "select proname from pg_proc where pronamespace = 'public'::regnamespace order by proname"
);
const policies = await c.query(
  "select tablename, policyname from pg_policies where schemaname='public' order by tablename, policyname"
);
const cats = await c.query("select count(*)::int as n from public.categories");
const items = await c.query("select count(*)::int as n from public.category_items");
const projs = await c.query("select count(*)::int as n from public.projects");
const pqs = await c.query("select count(*)::int as n from public.popular_queries");
const msgs = await c.query("select count(*)::int as n from public.messages");
const sess = await c.query("select count(*)::int as n from public.sessions");
const pub = await c.query(
  "select tablename from pg_publication_tables where pubname='supabase_realtime' order by tablename"
);

console.log("Tables:", tables.rows.map((r) => r.tablename).join(", ") || "(none)");
console.log("Functions:", fns.rows.map((r) => r.proname).join(", ") || "(none)");
console.log("Policies:", policies.rows.length);
for (const r of policies.rows) console.log("  -", r.tablename, "->", r.policyname);
console.log("Row counts:");
console.log("  categories:", cats.rows[0].n);
console.log("  category_items:", items.rows[0].n);
console.log("  projects:", projs.rows[0].n);
console.log("  popular_queries:", pqs.rows[0].n);
console.log("  messages:", msgs.rows[0].n);
console.log("  sessions:", sess.rows[0].n);
console.log("Realtime tables:", pub.rows.map((r) => r.tablename).join(", ") || "(none)");

await c.end();
