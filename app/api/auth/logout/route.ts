// POST /api/auth/logout
// Clears the auth + session cookies so the user is anonymous again.
// The chat page will fall back to the visitor-session bootstrap on
// next load.

import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  APP_USER_COOKIE,
  APP_EMAIL_COOKIE,
} from "@/lib/cookies";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  const maxAge = 0;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

  // We use the same cookie-name constants the rest of the app uses so
  // these never drift out of sync.
  for (const name of [SESSION_COOKIE, APP_USER_COOKIE, APP_EMAIL_COOKIE]) {
    res.headers.append(
      "Set-Cookie",
      `${name}=; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`,
    );
  }
  return res;
}