// verify-0017.mjs — One-off verification that migration 0017 has been
// applied to the database and the new RPC works correctly.
//
// What it checks:
//   1. supabase_migrations.schema_migrations records 0017_get_worker_registration
//   2. The new RPC public.get_worker_registration_for_session exists
//      and has the expected signature.
//   3. The worker_registrations table has all the expected columns.
//   4. RLS on worker_registrations is still in place (anon denied,
//      admin allowed).
//   5. The RPC returns rows correctly for matching session_id /
//      user_id (and returns 0 rows when neither matches).
//   6. The RPC result has all the columns the page renders.
//
// Usage: node scripts/verify-0017.mjs

import { readFileSync } from "node:fs";
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
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_DB_PASSWORD in .env.local.");
  process.exit(1);
}
const ref = url.match(/^https:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!ref) {
  console.error("Could not parse project ref from", url);
  process.exit(1);
}

const connectionString =
  `postgresql://postgres:${password}@db.${ref}.supabase.co:5432/postgres`;
const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

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
const TEST_SESSION_ID = "11111111-1111-1111-1111-111111111111";
const TEST_USER_ID    = "22222222-2222-2222-2222-222222222222";
const TEST_NEW_ID     = "33333333-3333-3333-3333-333333333333";
const TEST_OLD_ID     = "44444444-4444-4444-4444-444444444444";
const TEST_NO_MATCH   = "99999999-9999-9999-9999-999999999999";
const TEST_NO_USER    = "88888888-8888-8888-8888-888888888888";

try {
  await client.connect();
  console.log(`Connected to db.${ref}.supabase.co:5432\n`);

  // ── 1. Migration tracking ────────────────────────────────────────────
  console.log("1. Migration tracking");
  const { rows: appliedRows } = await client.query(
    `select version, applied_at from supabase_migrations.schema_migrations
      where version = '0017_get_worker_registration'`,
  );
  if (appliedRows.length === 1) {
    check("Migration 0017_get_worker_registration is recorded", true,
      `applied at ${appliedRows[0].applied_at.toISOString()}`);
  } else {
    check("Migration 0017_get_worker_registration is recorded", false,
      "not found in supabase_migrations.schema_migrations -- run `node scripts/migrate-direct.mjs` first");
  }

  // ── 2. RPC existence + signature ─────────────────────────────────────
  console.log("\n2. RPC existence");
  const { rows: fnRows } = await client.query(
    `select proname, pg_get_function_arguments(oid) as args,
            pg_get_function_result(oid) as rettype
       from pg_proc where proname = 'get_worker_registration_for_session'`,
  );
  if (fnRows.length === 1) {
    const fn = fnRows[0];
    // pg_get_function_arguments returns e.g. "p_session_id uuid, p_user_id uuid".
    // Count occurrences of "uuid" — should be exactly 2.
    const uuidCount = (fn.args.match(/\buuid\b/gi) ?? []).length;
    const okArgs = uuidCount === 2;
    // pg_get_function_result returns "SETOF worker_registrations"
    // (without the schema prefix).
    const okRet = /setof.*worker_registrations/i.test(fn.rettype);
    check("get_worker_registration_for_session(uuid, uuid) exists", true,
      `args=(${fn.args})  returns=${fn.rettype}`);
    check("RPC args are (uuid, uuid)", okArgs, `${uuidCount} uuid tokens found`);
    check("RPC returns SETOF worker_registrations", okRet);
  } else {
    check("get_worker_registration_for_session exists", false,
      `found ${fnRows.length} matching functions`);
  }

  // ── 3. Grants ────────────────────────────────────────────────────────
  console.log("\n3. Grants");
  const { rows: grantRows } = await client.query(
    `select grantee, privilege_type
       from information_schema.routine_privileges
      where routine_name = 'get_worker_registration_for_session'`,
  );
  const hasAnon = grantRows.some((r) => r.grantee === "anon" && r.privilege_type === "EXECUTE");
  const hasAuth = grantRows.some(
    (r) => r.grantee === "authenticated" && r.privilege_type === "EXECUTE",
  );
  check("anon has EXECUTE on RPC", hasAnon, hasAnon ? "" : "(anon cannot call the RPC)");
  check("authenticated has EXECUTE on RPC", hasAuth, hasAuth ? "" : "(authenticated users cannot call the RPC)");

  // ── 4. worker_registrations columns ──────────────────────────────────
  console.log("\n4. worker_registrations columns");
  const expectedCols = [
    "id", "created_at", "session_id", "user_id",
    "full_name", "phone", "email", "address",
    "work_type", "work_description", "qualification",
    "years_experience", "availability", "verified_at",
  ];
  const { rows: colRows } = await client.query(
    `select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'worker_registrations'`,
  );
  const actualCols = new Set(colRows.map((r) => r.column_name));
  for (const c of expectedCols) {
    check(`column "${c}" exists`, actualCols.has(c));
  }

  // ── 5. RLS still in place ────────────────────────────────────────────
  console.log("\n5. Row-Level Security");
  const { rows: rlsRows } = await client.query(
    `select relname, relrowsecurity from pg_class where relname = 'worker_registrations'`,
  );
  if (rlsRows.length === 1) {
    check("RLS is enabled on worker_registrations",
      rlsRows[0].relrowsecurity === true);
  } else {
    check("worker_registrations table found", false);
  }
  // pg_policies doesn't expose the USING expression or the resolved
  // role names directly, so we go to pg_policy + pg_roles instead.
  const { rows: polRows } = await client.query(
    `select polname,
            array(select rolname from pg_roles where oid = any(polroles)) as role_names
       from pg_policy
      where polrelid = 'public.worker_registrations'::regclass`,
  );
  const anonPolicy = polRows.find(
    (p) => p.polname === "worker_registrations_anon_all",
  );
  const adminPolicy = polRows.find(
    (p) => p.polname === "worker_registrations_admin_all",
  );
  // The anon policy must have `using false` so RLS rejects every row.
  // pg_policies doesn't expose USING/CHECK directly here, but a quick
  // pg_get_expr on pg_policy would. Easiest: fetch the policy's
  // qual text directly.
  let anonUsing = "";
  if (anonPolicy) {
    // The USING expression lives in pg_policy.polqual. Note the column
    // is named `polqual`, not `qual` — Postgres 14+ removed the alias.
    const r = await client.query(
      `select pg_get_expr(polqual, polrelid) as using_expr
         from pg_policy where polname = 'worker_registrations_anon_all'`,
    );
    anonUsing = r.rows[0]?.using_expr ?? "";
  }
  // The pg driver may serialize text[] as a string ("{anon}") or as
  // a real JS array (["an" depending on the column type parser).
  // Normalise so the rest of the check is type-agnostic.
  const normalise = (v) => {
    if (v == null) return [];
    if (Array.isArray(v)) return v;
    if (typeof v === "string") {
      return v.replace(/^{|}$/g, "").split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
  };
  const anonRoles = normalise(anonPolicy?.role_names);
  const adminRoles = normalise(adminPolicy?.role_names);
  // PUBLIC role (which admin_all uses by default when no role is
  // specified) is implicit — we just check the policy exists.
  const anonTargetsAnon = anonRoles.includes("anon");
  const anonBlocked = !!anonPolicy
    && anonTargetsAnon
    && /^false$|^false\s/i.test(anonUsing.trim());
  const adminAllowed = !!adminPolicy;
  check("Anon policy exists for worker_registrations", !!anonPolicy,
    anonPolicy ? `roles=${JSON.stringify(anonRoles)}  using=${anonUsing}` : "");
  check("Anon policy targets the anon role", anonTargetsAnon,
    `roles=${JSON.stringify(anonRoles)}`);
  check("Anon direct access is denied by policy (using false)", anonBlocked);
  check("Admin full access policy exists", adminAllowed,
    adminPolicy ? `roles=${JSON.stringify(adminRoles)}` : "");

  // ── 6. Functional test ───────────────────────────────────────────────
  console.log("\n6. Functional test (real RPC call)");

  // Wipe any leftover test rows from a previous run.
  await client.query(
    `delete from public.worker_registrations where id in (
      $1::uuid, $2::uuid
    )`,
    [TEST_NEW_ID, TEST_OLD_ID],
  );
  // worker_registrations has FKs on public.sessions(id) and
  // public.app_users(id), so we must insert real rows first. We use
  // the SECURITY DEFINER upsert_session RPC that already exists in
  // the project, plus a direct INSERT into app_users (the bcrypt hash
  // is a dummy; the test never tries to authenticate with it).
  await client.query(`select public.upsert_session($1::uuid, '{}'::jsonb)`, [TEST_SESSION_ID]);
  await client.query(
    `delete from public.app_users where id = $1::uuid`,
    [TEST_USER_ID],
  );
  await client.query(
    `insert into public.app_users (id, email, password_hash) values (
      $1::uuid, 'verify-' || replace($1::text, '-', '') || '@example.com',
      '$2b$10$abcdefghijklmnopqrstuv.verifyhashplaceholder'
    )`,
    [TEST_USER_ID],
  );
  // Cleanup the test user on the way out (deferred to the cleanup
  // block at the bottom).

  // Insert a NEW row linked to both session_id and user_id, verified.
  await client.query(
    `insert into public.worker_registrations (
       id, session_id, user_id, full_name, phone, email, address,
       work_type, work_description, qualification, years_experience, availability,
       verified_at
     ) values (
       $1::uuid, $2::uuid, $3::uuid,
       'Verify User', '9999999999', 'verify@example.com',
       '1 Test Street', 'Plumber', 'Fixing test pipes end-to-end.',
       'Certified', '5', 'Full-time',
       now() - interval '1 hour'
     )`,
    [TEST_NEW_ID, TEST_SESSION_ID, TEST_USER_ID],
  );

  // Insert an OLDER row with the same session_id (no user_id, no
  // verification). The RPC should return the newer one.
  await client.query(
    `insert into public.worker_registrations (
       id, session_id, full_name, phone, email, address,
       work_type, work_description, created_at
     ) values (
       $1::uuid, $2::uuid,
       'OLD Verify User', '9999999999', 'old@example.com',
       '1 Test Street', 'Plumber', 'Old row should NOT be returned.',
       now() - interval '7 days'
     )`,
    [TEST_OLD_ID, TEST_SESSION_ID],
  );

  // 6b. RPC by session_id -- newest row only.
  const { rows: r1 } = await client.query(
    `select id, full_name, verified_at
       from public.get_worker_registration_for_session($1::uuid, null)`,
    [TEST_SESSION_ID],
  );
  check("RPC by session_id returns 1 row", r1.length === 1, `got ${r1.length}`);
  check("RPC returns the most recent row (not the 7-day-old one)",
    r1.length === 1 && r1[0].id === TEST_NEW_ID,
    r1.length === 1 ? `id=${r1[0].id.slice(0,8)}... full_name="${r1[0].full_name}"` : "");
  check("RPC returns the verified_at timestamp",
    r1.length === 1 && r1[0].verified_at !== null);

  // 6c. RPC by user_id -- finds the same row.
  const { rows: r2 } = await client.query(
    `select id, full_name
       from public.get_worker_registration_for_session(null, $1::uuid)`,
    [TEST_USER_ID],
  );
  check("RPC by user_id finds the row linked to that app_user",
    r2.length === 1 && r2[0].id === TEST_NEW_ID,
    r2.length === 1 ? `id=${r2[0].id.slice(0,8)}...` : "");

  // 6d. RPC with neither match -- 0 rows.
  const { rows: r3 } = await client.query(
    `select id from public.get_worker_registration_for_session(
       $1::uuid, $2::uuid
     )`,
    [TEST_NO_MATCH, TEST_NO_USER],
  );
  check("RPC returns 0 rows for a non-matching session/user", r3.length === 0,
    `got ${r3.length}`);

  // 6e. RPC with both args null -- 0 rows (no crash).
  const { rows: r4 } = await client.query(
    `select id from public.get_worker_registration_for_session(null, null)`,
  );
  check("RPC handles both-null safely", r4.length === 0, `got ${r4.length}`);

  // 6f. RPC result must include every column the UI renders. Guards
  //     against future migrations silently renaming or dropping a
  //     column without updating the page.
  const { rows: r5 } = await client.query(
    `select * from public.get_worker_registration_for_session($1::uuid, null) limit 1`,
    [TEST_SESSION_ID],
  );
  if (r5.length === 1) {
    const cols = Object.keys(r5[0]).sort();
    const required = [
      "address", "availability", "created_at", "email", "full_name",
      "id", "phone", "qualification", "session_id", "user_id",
      "verified_at", "work_description", "work_type", "years_experience",
    ];
    const missing = required.filter((c) => !cols.includes(c));
    check("RPC result has all columns the UI renders", missing.length === 0,
      missing.length === 0 ? `${cols.length} columns` : `missing: ${missing.join(", ")}`);
  } else {
    check("RPC returned a row to inspect", false);
  }

  // ── Cleanup ──────────────────────────────────────────────────────────
  await client.query(
    `delete from public.worker_registrations where id in (
      $1::uuid, $2::uuid
    )`,
    [TEST_NEW_ID, TEST_OLD_ID],
  );
  // Drop the test session row (cascade already removed any messages).
  await client.query(
    `delete from public.sessions where id = $1::uuid`,
    [TEST_SESSION_ID],
  );
  // Drop the test app_user row.
  await client.query(
    `delete from public.app_users where id = $1::uuid`,
    [TEST_USER_ID],
  );
  console.log("\n  (Test rows cleaned up.)");

  console.log(`\nResult: ${passed} passed, ${failed} failed.`);
  process.exit(failed === 0 ? 0 : 1);
} catch (e) {
  console.error("Connection error:", e?.message ?? e);
  process.exit(2);
} finally {
  await client.end().catch(() => undefined);
}