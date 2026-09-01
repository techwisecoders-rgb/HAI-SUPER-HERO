// POST /api/auth/verify-otp
// Body: { email, otp, purpose: "register" | "login" | "reset" }
// Verifies the OTP against the database. On success:
//   * marks the OTP consumed
//   * for "register" or "login", bootstraps the user's chat session,
//     sets accompany_session_id cookie, and sets accompany_app_user cookie
//   * returns the userId + sessionId so the UI can swap to the chat
//
// On failure: increments the OTP attempt counter. After 5 attempts the
// OTP is effectively dead (find_valid_otp filters attempts < 5).

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getServiceSupabase } from "@/lib/supabase/server";
import { verifyPassword } from "@/lib/auth/helpers";
import { buildSessionCookie } from "@/lib/cookies";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().trim().email().max(254),
  otp: z.string().trim().regex(/^\d{6}$/, "OTP must be 6 digits"),
  purpose: z.enum(["register", "login", "reset"]),
  /** Password for the "login" purpose — we re-verify it after OTP succeeds. */
  password: z.string().min(6).max(128).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid input" },
      { status: 400 },
    );
  }
  const { email, otp, purpose, password } = parsed.data;
  const supabase = getServiceSupabase();

  // Look up the most recent valid OTP for this email + purpose.
  const otpRows = await supabase.rpc("find_valid_otp", {
    p_email: email,
    p_purpose: purpose,
  });
  if (otpRows.error) {
    return NextResponse.json({ error: otpRows.error.message }, { status: 500 });
  }
  const row = otpRows.data?.[0];
  if (!row) {
    return NextResponse.json(
      { error: "OTP expired or not found. Please request a new one." },
      { status: 400 },
    );
  }

  // Bcrypt-compare the submitted OTP against the stored hash.
  const bcrypt = await import("bcryptjs");
  const ok = await bcrypt.compare(otp, row.code_hash);
  if (!ok) {
    await supabase.rpc("bump_otp_attempts", { p_otp_id: row.id });
    return NextResponse.json(
      { error: "Incorrect OTP." },
      { status: 400 },
    );
  }

  // Consume the OTP.
  await supabase.rpc("consume_otp", { p_otp_id: row.id });

  // Look up the user.
  const userRows = await supabase.rpc("find_app_user_by_email", { p_email: email });
  const user = userRows.data?.[0];
  if (!user) {
    return NextResponse.json(
      { error: "user not found" },
      { status: 404 },
    );
  }

  // For login OTP, double-check the password matches. This prevents a
  // scenario where an attacker intercepts the OTP email but doesn't know
  // the password.
  if (purpose === "login" && password) {
    const pwOk = await verifyPassword(password, user.password_hash);
    if (!pwOk) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 },
      );
    }
  }

  // Bootstrap / refresh the chat session for this user.
  const session = await supabase.rpc("bootstrap_session_for_user", {
    p_user_id: user.id,
  });
  const sessionId = session.data?.[0]?.id ?? null;

  // Update last_login_at.
  await supabase.rpc("touch_app_user_login", { p_user_id: user.id });

  // Build the response with cookies that bind the chat to this user.
  const res = NextResponse.json({
    ok: true,
    userId: user.id,
    email: user.email,
    sessionId,
  });
  if (sessionId) {
    res.headers.append("Set-Cookie", buildSessionCookie(sessionId));
    res.headers.append(
      "Set-Cookie",
      `accompany_app_user=${encodeURIComponent(user.id)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`,
    );
    res.headers.append(
      "Set-Cookie",
      `accompany_app_email=${encodeURIComponent(user.email)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`,
    );
  }
  return res;
}