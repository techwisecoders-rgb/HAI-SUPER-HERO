// e2e-verify-0017.mjs — End-to-end test of the /api/worker/registration
// endpoint. Starts a fresh dev session via POST /api/session (which sets
// the accompany_session_id cookie), then calls GET /api/worker/registration
// to confirm:
//   - With a session cookie but no registration: returns { registration: null }
//   - With a session cookie AND a row matching that session: returns the row.
//   - The endpoint never returns 500.
//
// Usage: node scripts/e2e-verify-0017.mjs

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

let passed = 0;
let failed = 0;
function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}${detail ? "  - " + detail : ""}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? "  - " + detail : ""}`);
  }
}

// Start a session: POST /api/session with action=bootstrap. The
// server returns a sessionId AND sets a Set-Cookie header.
async function startSession() {
  const r = await fetch(`${BASE}/api/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "bootstrap" }),
  });
  if (!r.ok) throw new Error(`/api/session bootstrap failed: ${r.status}`);
  const data = await r.json();
  const setCookie = r.headers.get("set-cookie") ?? "";
  const m = setCookie.match(/accompany_session_id=([^;]+)/);
  if (!m) throw new Error("no accompany_session_id cookie set");
  return { sessionId: data.sessionId, cookieValue: m[1] };
}

import pkg from "pg";
const { Client } = pkg;
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

(async () => {
  const env = loadEnv(join(process.cwd(), ".env.local"));
  const ref = env.NEXT_PUBLIC_SUPABASE_URL.match(/^https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!ref || !env.SUPABASE_DB_PASSWORD) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_DB_PASSWORD");
    process.exit(2);
  }
  const c = new Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: "postgres",
    password: env.SUPABASE_DB_PASSWORD,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  console.log(`Testing ${BASE}/api/worker/registration\n`);

  // ── 1. Session cookie set, no registration row ──────────────────────
  console.log("1. Session cookie set, no registration in DB");
  const sess = await startSession();
  console.log(`   (sessionId=${sess.sessionId.slice(0, 8)}...)`);

  // Clean any leftover from a prior run that happens to share session_id.
  await c.query(
    `delete from public.worker_registrations where session_id = $1::uuid`,
    [sess.sessionId],
  );

  const r1 = await fetch(`${BASE}/api/worker/registration`, {
    headers: { cookie: `accompany_session_id=${sess.cookieValue}` },
  });
  check(`GET returns 200 (got ${r1.status})`, r1.status === 200);
  const d1 = await r1.json();
  check("Response shape is { registration: null } for empty case",
    d1 !== null && "registration" in d1 && d1.registration === null,
    JSON.stringify(d1).slice(0, 200));

  // ── 2. Insert a row tied to this session, expect the endpoint ──────
  console.log("\n2. Insert a registration row tied to the same session, then call endpoint");
  const e2eRowId = "55555555-5555-5555-5555-555555555555";
  await c.query(`delete from public.worker_registrations where id = $1::uuid`, [e2eRowId]);
  try {
    await c.query(
      `insert into public.worker_registrations (
         id, session_id, full_name, phone, email, address,
         work_type, work_description, qualification, years_experience, availability,
         verified_at
       ) values (
         $1::uuid, $2::uuid,
         'E2E Test User', '8888888888', 'e2e@example.com',
         '1 E2E Street', 'Electrician', 'Wiring end-to-end tests.',
         'Certified', '3', 'Part-time',
         now() - interval '10 minutes'
       )`,
      [e2eRowId, sess.sessionId],
    );
    console.log("   (inserted row " + e2eRowId + " tied to session " + sess.sessionId + ")");
  } catch (e) {
    console.log("   INSERT FAILED:", e.message);
    process.exit(1);
  }

  const r2 = await fetch(`${BASE}/api/worker/registration`, {
    headers: { cookie: `accompany_session_id=${sess.cookieValue}` },
  });
  check(`GET returns 200 (got ${r2.status})`, r2.status === 200);
  const d2 = await r2.json();
  check("Response includes a non-null registration object",
    d2?.registration !== null && typeof d2.registration === "object");
  const reg = d2?.registration ?? {};
  check("Returned registration has the expected id",
    reg.id === e2eRowId, `id=${reg.id}`);
  check("Returned registration has full_name",
    reg.full_name === "E2E Test User", `full_name="${reg.full_name}"`);
  check("Returned registration has phone", reg.phone === "8888888888");
  check("Returned registration has email", reg.email === "e2e@example.com");
  check("Returned registration has work_type", reg.work_type === "Electrician");
  check("Returned registration has work_description",
    reg.work_description === "Wiring end-to-end tests.");
  check("Returned registration has qualification",
    reg.qualification === "Certified");
  check("Returned registration has years_experience", reg.years_experience === "3");
  check("Returned registration has availability", reg.availability === "Part-time");
  check("Returned registration has non-null verified_at",
    reg.verified_at !== null && reg.verified_at !== undefined,
    `verified_at=${reg.verified_at}`);

  // ── 3. No cookies at all ──────────────────────────────────────────
  console.log("\n3. No cookies at all");
  const r3 = await fetch(`${BASE}/api/worker/registration`);
  check(`GET returns 200 (got ${r3.status})`, r3.status === 200);
  const d3 = await r3.json();
  check("Response shape is { registration: null } for cookie-less request",
    d3 !== null && "registration" in d3 && d3.registration === null);

  // Cleanup.
  await c.query(`delete from public.worker_registrations where id = $1::uuid`, [e2eRowId]);
  await c.end();

  console.log(`\nResult: ${passed} passed, ${failed} failed.`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => {
  console.error("Fatal:", e?.message ?? e);
  process.exit(2);
});