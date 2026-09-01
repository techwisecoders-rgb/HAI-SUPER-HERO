// One-off migration runner.
// Usage: node scripts/migrate.mjs "postgresql://user:pass@host:port/db"
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const url = process.argv[2];
if (!url) {
  console.error("Usage: node scripts/migrate.mjs <connection-string>");
  process.exit(1);
}

const dir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .filter((f) => !f.toLowerCase().includes("optional")) // skip optionals
  .sort();

console.log(`Found ${files.length} migration file(s) in ${dir}:`);
for (const f of files) console.log("  -", f);
console.log("");

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
console.log("Connected.\n");

let totalOk = 0;
let totalWarn = 0;

for (const f of files) {
  const path = join(dir, f);
  const sql = readFileSync(path, "utf8");
  console.log(`==> ${f}`);
  try {
    await client.query(sql);
    console.log(`    OK\n`);
    totalOk++;
  } catch (e) {
    const msg = String(e?.message ?? e);
    // Idempotent re-runs can hit "already exists" — treat as warnings, not failures.
    if (
      msg.includes("already exists") ||
      msg.includes("does not exist") && msg.includes("drop") ||
      msg.includes("duplicate key")
    ) {
      console.log(`    WARN (idempotent): ${msg}\n`);
      totalWarn++;
    } else {
      console.error(`    FAIL: ${msg}`);
      await client.end();
      process.exit(1);
    }
  }
}

await client.end();
console.log(`Done. ${totalOk} migration(s) applied, ${totalWarn} benign warning(s).`);
