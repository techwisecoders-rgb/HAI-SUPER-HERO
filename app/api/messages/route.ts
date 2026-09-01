// POST /api/messages  — user sends a message.
// The session_id is taken from the accompany_session_id cookie (server-trusted),
// NOT from the request body, so a client cannot spoof another visitor's thread.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE } from "@/lib/cookies";
import { getServiceSupabase } from "@/lib/supabase/server";

const Body = z.object({
  text: z.string().trim().min(1).max(2000),
});

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionId || !isUuid(sessionId)) {
    return NextResponse.json(
      { error: "no session — accept cookies first" },
      { status: 401 },
    );
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .rpc("append_user_message", { p_session_id: sessionId, p_text: parsed.data.text })
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, message: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
