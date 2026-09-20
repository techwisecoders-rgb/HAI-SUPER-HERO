// One-off: creates an admin user in Supabase Auth using the service-role key
// from .env.local. The key NEVER leaves this script's memory; it is only sent
// to the Supabase project URL it is paired with.
//
// Usage:
//   node scripts/create-admin.mjs --email admin@example.com --password 'StrongPass!23'
//
// Optional flags:
//   --auto-confirm    (default: true) — sets email_confirm=true so you can log in
//                        immediately without clicking a verification link.
//   --no-auto-confirm — leaves the user unconfirmed (you'd then have to verify
//                        the email before login works).
//
// After creation, sign in at /admin/login with the same email + password.
// Re-running with the same email returns the existing user (no error).

import { readFileSync } from "node:fs";
import { join } from "node:path";

// ---- arg parsing -----------------------------------------------------------
function parseArgs(argv) {
  const out = { email: null, password: null, autoConfirm: true };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--email") out.email = argv[++i];
    else if (a === "--password") out.password = argv[++i];
    else if (a === "--auto-confirm") out.autoConfirm = true;
    else if (a === "--no-auto-confirm") out.autoConfirm = false;
    else if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      printHelp();
      process.exit(2);
    }
  }
  return out;
}

function printHelp() {
  console.log(`Usage:
  node scripts/create-admin.mjs --email <addr> --password '<pwd>' [--no-auto-confirm]

Reads SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL from .env.local.
The service-role key is NEVER printed.`);
}

// ---- env loading (tiny .env.local reader, no dotenv dep) -------------------
function loadEnvFile(path) {
  let text;
  try { text = readFileSync(path, "utf8"); }
  catch { return {}; }
  const env = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    // strip surrounding quotes
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
  return env;
}

const env = loadEnvFile(join(process.cwd(), ".env.local"));
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
    "Open your Supabase project dashboard -> Settings -> API to find them."
  );
  process.exit(1);
}

const args = parseArgs(process.argv);
if (!args.email || !args.password) {
  console.error("Both --email and --password are required.");
  printHelp();
  process.exit(2);
}
if (args.password.length < 8) {
  console.error("Password must be at least 8 characters (Supabase Auth requirement).");
  process.exit(2);
}

// ---- Supabase Auth admin API ----------------------------------------------
// POST {SUPABASE_URL}/auth/v1/admin/users
//   Authorization: Bearer <service_role_key>
//   apikey:        <service_role_key>   (some endpoints want it too)
//   Content-Type:  application/json
//   { "email": "...", "password": "...", "email_confirm": true }

const url = `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/admin/users`;
const body = JSON.stringify({
  email: args.email,
  password: args.password,
  email_confirm: args.autoConfirm,
});

console.log(`Calling: POST ${url}`);
console.log(`Creating user: ${args.email}  (auto_confirm=${args.autoConfirm})`);

let res;
try {
  res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "apikey": SERVICE_KEY,
      "Content-Type": "application/json",
    },
    body,
  });
} catch (e) {
  console.error("Network error talking to Supabase:", e?.message ?? e);
  process.exit(1);
}

const text = await res.text();
let json;
try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

// Supabase returns 200 on create, 422 if the user already exists, etc.
if (res.ok) {
  const u = json;
  console.log("\n✅ Admin created.");
  console.log(`   user_id     : ${u.id}`);
  console.log(`   email       : ${u.email}`);
  console.log(`   confirmed   : ${u.email_confirmed_at ? "yes" : "no"}`);
  console.log(`   created_at  : ${u.created_at}`);
  console.log(`\n👉 Sign in at /admin/login with email = ${u.email}`);
  console.log(`   and the password you passed on the command line.`);
  process.exit(0);
}

// Already exists → look the user up so the caller gets a clean confirmation.
if (res.status === 422 || (json?.msg && /already registered/i.test(json.msg))) {
  console.warn(`\n⚠️  User ${args.email} already exists in Supabase Auth.`);
  console.warn("   No changes made. If you've forgotten the password, reset it");
  console.warn("   in the Supabase dashboard: Authentication -> Users -> Reset password.");
  process.exit(0);
}

console.error(`\n❌ Supabase returned ${res.status}:`);
console.error(JSON.stringify(json, null, 2));
process.exit(1);