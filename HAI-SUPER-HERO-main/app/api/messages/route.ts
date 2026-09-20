// POST /api/messages  — user sends a message.
// The session_id is taken from the accompany_session_id cookie (server-trusted),
// NOT from the request body, so a client cannot spoof another visitor's thread.
//
// After the user message is persisted we also evaluate the
// auto_reply_rules table and, for each match, insert a sender_type='auto'
// message via the SECURITY DEFINER `append_auto_message` RPC. The
// real-time subscription delivers these to the user as ordinary bot
// replies; the chat page's ThinkingIndicator keeps showing until a
// real admin reply arrives (which is exactly what the reference HTML
// does).

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

    // Fire any matching auto-replies. Best-effort — if the rules table
    // is missing or the RPC fails, the user message still went through.
    // We fire synchronously (not in a setTimeout) so the realtime
    // channel delivers them shortly after the user message echoes back;
    // the ThinkingIndicator stays mounted because auto replies do not
    // hide it (only an 'admin' reply does).
    //
    // The RPC also handles the "first message of this session" welcome
    // reply automatically — if this session has zero messages yet, a
    // welcome reply is prepended to the result regardless of what the
    // user typed. See supabase/migrations/0013_first_message_welcome.sql.
    try {
      const { data: rules } = await supabase.rpc("list_matching_auto_rules", {
        p_text: parsed.data.text,
        p_session_id: sessionId,
      });
      const list = (rules ?? []) as Array<{ id: string; reply: string; is_welcome?: boolean }>;
      for (const r of list) {
        // eslint-disable-next-line no-await-in-loop
        await supabase.rpc("append_auto_message", {
          p_session_id: sessionId,
          p_text: r.reply,
        });
      }
    } catch {
      // Silent — auto replies are a "nice to have", not the main path.
    }

    return NextResponse.json({ ok: true, message: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
