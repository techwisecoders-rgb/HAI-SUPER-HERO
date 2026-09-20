// GET /api/messages/[sessionId]  — fetch all messages for a session.
// The user-facing chat page can only fetch its own session (verified by cookie).
// Admin route handlers bypass this by using the service role directly.

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/cookies";
import { getServiceSupabase } from "@/lib/supabase/server";

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const { sessionId } = params;
  if (!isUuid(sessionId)) {
    return NextResponse.json({ error: "bad session id" }, { status: 400 });
  }

  // Self-only check for the public user. Admin GETs go through a separate
  // server component that uses the service role directly.
  const cookieSid = _req.cookies.get(SESSION_COOKIE)?.value;
  if (cookieSid !== sessionId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase.rpc("get_session_messages", {
      p_session_id: sessionId,
      p_limit: 500,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ messages: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
