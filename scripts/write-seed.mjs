// One-off: seeds the HAI SUPER HERO database. Idempotent.
// Usage: node scripts/write-seed.mjs "<db-url>"
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { CATS, ITEMS } from "./seed-data.mjs";

const url = process.argv[2];
if (!url) { console.error("Usage: node scripts/write-seed.mjs <db-url>"); process.exit(1); }

const TU = "'";
const esc = (s) => String(s).replace(/'/g, "''");
const fmt = (cols) => "(" + cols.map((v) => `${TU}${esc(v)}${TU}`).join(",") + ")";

const catSql = `insert into public.categories (id, slug, name, sort_order) values\n  ${CATS.map((r) => fmt(r)).join(",\n  ")}\non conflict (id) do nothing;`;

const itemSql = `insert into public.category_items (id, category_id, image_url, caption, sort_order) values\n  ${ITEMS.map((r) => fmt(r)).join(",\n  ")}\non conflict (id) do nothing;`;

const projects = [
  ["20000000-0000-0000-0000-000000000001","Aperture Studio","Capturing Life's Most Precious Moments","https://images.unsplash.com/photo-1493863641943-9b68992a8d07?auto=format&fit=crop&w=1000&q=80","https://photographer-one-phi.vercel.app/",0],
  ["20000000-0000-0000-0000-000000000002","John Doe Studios","Photography","https://res.cloudinary.com/dsresihyk/image/upload/v1777382750/studio_config/xa3le0nxzy1e778rwml7.webp","https://photography-mauve.vercel.app/",1],
  ["20000000-0000-0000-0000-000000000003","Cafe Miracle Restaurant","Where Every Bite Feels Like A Miracle","https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1000&q=80&auto=format&fit=crop","https://cafe-miracle-sigma.vercel.app/",2],
];
const projectSql = `insert into public.projects (id, title, description, image_url, url, sort_order) values\n  ${projects.map((r) => fmt(r)).join(",\n  ")}\non conflict (id) do nothing;`;

const popular = [
  ["30000000-0000-0000-0000-000000000001","I'm a software developer. Allot me projects",0],
  ["30000000-0000-0000-0000-000000000002","I need a full stack developer",1],
  ["30000000-0000-0000-0000-000000000003","I need a android app developer",2],
  ["30000000-0000-0000-0000-000000000004","I need a maths tutor",3],
  ["30000000-0000-0000-0000-000000000005","I am a driver. Search near..",4],
  ["30000000-0000-0000-0000-000000000006","I'm a labour. You can allot works for me",5],
  ["30000000-0000-0000-0000-000000000007","I need a electrician and plumber",6],
  ["30000000-0000-0000-0000-000000000008","I need a photographer and videographer",7],
  ["30000000-0000-0000-0000-000000000009","I need a computer technician",8],
  ["30000000-0000-0000-0000-00000000000a","I need a graphic designer",9],
  ["30000000-0000-0000-0000-00000000000b","I need a delivery person",10],
];
const popularSql = `insert into public.popular_queries (id, text, sort_order) values\n  ${popular.map((r) => fmt(r)).join(",\n  ")}\non conflict (id) do nothing;`;

const allSeed3 = `-- 0003_seed.sql (auto-generated)\n\n${catSql}\n\n${itemSql}\n`;
const allSeed4 = `-- 0004_seed2.sql (auto-generated)\n\n${projectSql}\n\n${popularSql}\n\ndo $$\nbegin\n  if not exists (\n    select 1 from pg_publication_tables\n    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'\n  ) then\n    execute 'alter publication supabase_realtime add table public.messages';\n  end if;\nend $$;\n`;
writeFileSync(join(process.cwd(), "supabase", "migrations", "0003_seed.sql"), allSeed3, "utf8");
writeFileSync(join(process.cwd(), "supabase", "migrations", "0004_seed2.sql"), allSeed4, "utf8");
console.log("Wrote 0003_seed.sql and 0004_seed2.sql to supabase/migrations.");

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
console.log("Connected.\n");

for (const [name, sql] of [
  ["categories", catSql],
  ["category_items", itemSql],
  ["projects", projectSql],
  ["popular_queries", popularSql],
]) {
  console.log(`==> ${name} (${sql.length} bytes)`);
  try { await c.query(sql); console.log("    OK\n"); }
  catch (e) { console.error(`    FAIL: ${e.message}`); await c.end(); process.exit(1); }
}

try {
  await c.query("alter publication supabase_realtime add table public.messages");
  console.log("==> realtime: added messages to publication\n");
} catch (e) {
  if (e.message.includes("already member")) console.log("==> realtime: already in publication\n");
  else console.error("==> realtime FAIL:", e.message);
}

await c.end();
console.log("Done.");

