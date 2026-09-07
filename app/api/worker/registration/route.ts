// GET /api/worker/registration
//
// Returns the most recent worker_registrations row linked to the
// caller's current chat session OR app_user account. Used by the
// /register page to detect returning visitors and render their saved
// details instead of an empty form.
//
// Auth: this endpoint is intentionally public (anon-callable) because
// /register is reachable by anonymous visitors who have a chat session
// cookie. Authorization is enforced by the underlying RPC, which only
// returns rows whose session_id / user_id matches the caller's cookies.
// Anonymous callers with no session at all get `null` back.

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, APP_USER_COOKIE } from "@/lib/cookies";
import { getServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

interface WorkerRegistration {
  id: string;
  created_at: string;
  session_id: string | null;
  user_id: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  address: string;
  work_type: string;
  work_description: string;
  qualification: string | null;
  years_experience: string | null;
  availability: string | null;
  // `verified_at` is null until the user enters the OTP. The page
  // surfaces a "pending verification" hint for unverified rows.
  verified_at: string | null;
}

export async function GET(req: NextRequest) {
  const cookieSid = req.cookies.get(SESSION_COOKIE)?.value;
  const cookieUid = req.cookies.get(APP_USER_COOKIE)?.value;
  const sessionId = cookieSid && isUuid(cookieSid) ? cookieSid : null;
  const userId = cookieUid && isUuid(cookieUid) ? cookieUid : null;

  // No session, no app_user → nothing to look up. Return null rather
  // than 404 so the client can treat this the same as "no registration".
  if (!sessionId && !userId) {
    return NextResponse.json({ registration: null });
  }

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase.rpc(
      "get_worker_registration_for_session",
      { p_session_id: sessionId, p_user_id: userId },
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const rows = (data ?? []) as WorkerRegistration[];
    const registration = rows[0] ?? null;
    return NextResponse.json({ registration });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}