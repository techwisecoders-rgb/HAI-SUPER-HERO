// POST /api/session  — bootstrap or refresh the visitor's session.
//
// Body: { action: "accept" | "decline" | "bootstrap" }
//   accept    — generate a session id, set accompanying cookies, upsert session row.
//   decline   — return ok without setting any non-essential cookies.
//   bootstrap — like accept, but doesn't update a "declined" flag.
//
// If the visitor is already logged in (accompany_app_user cookie present),
// we reuse their existing session row so the chat history is permanent —
// they get the same session_id they had on the previous visit.
//
// We generate the session_id on the server so the client cannot mint arbitrary
// ones. Cookies are HttpOnly=false so the browser can read SESSION_COOKIE and
// join the realtime channel. This is acceptable because the session id is
// itself a non-identifying random uuid with no PII baked in.

import { NextResponse, type NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import {
  SESSION_COOKIE,
  APP_USER_COOKIE,
  buildSessionCookie,
  buildConsentCookie,
  buildDeclineCookie,
} from "@/lib/cookies";
import { getServiceSupabase } from "@/lib/supabase/server";

const Body = z.object({
  action: z.enum(["accept", "decline", "bootstrap"]),
});

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { action } = parsed.data;

  if (action === "decline") {
    // No persistent cookies. Set a session-scoped marker so the banner
    // doesn't reappear during this tab session.
    const res = NextResponse.json({ ok: true, declined: true });
    res.headers.append("Set-Cookie", buildDeclineCookie());
    return res;
  }

  // accept | bootstrap

  // If the visitor is logged in, reuse their existing chat session so
  // the conversation history is "there forever" across devices.
  const userIdCookie = req.cookies.get(APP_USER_COOKIE)?.value;
  if (userIdCookie && isUuid(userIdCookie)) {
    try {
      const supabase = getServiceSupabase();
      const { data, error } = await supabase.rpc("bootstrap_session_for_user", {
        p_user_id: userIdCookie,
      });
      if (!error && data && data.length > 0) {
        const sessionId = (data[0] as { id: string }).id;
        const res = NextResponse.json({ ok: true, sessionId });
        res.headers.append("Set-Cookie", buildSessionCookie(sessionId));
        res.headers.append("Set-Cookie", buildConsentCookie());
        return res;
      }
    } catch (e) {
      console.error("bootstrap_session_for_user failed", e);
      // fall through to creating a fresh visitor session
    }
  }

  // Anonymous path: mint a brand-new session id.
  const sessionId = uuidv4();
  const meta = {
    ua: req.headers.get("user-agent") ?? null,
    lang: req.headers.get("accept-language") ?? null,
  };

  try {
    const supabase = getServiceSupabase();
    await supabase.rpc("upsert_session", {
      p_session_id: sessionId,
      p_metadata: meta,
    });
  } catch (e) {
    // Don't fail the request if the DB is briefly unavailable — the client
    // can retry. We still set the cookie so the id is preserved.
    console.error("upsert_session failed", e);
  }

  const res = NextResponse.json({ ok: true, sessionId });
  res.headers.append("Set-Cookie", buildSessionCookie(sessionId));
  res.headers.append("Set-Cookie", buildConsentCookie());
  return res;
}

export async function GET() {
  // Lightweight helper for SSR: read the session cookie if any.
  // The actual client uses the browser supabase realtime + REST.
  return NextResponse.json({ cookie: SESSION_COOKIE });
}
