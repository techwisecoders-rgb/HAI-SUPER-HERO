// POST /api/auth/login
// Body: { email, password }
// Steps:
//   1. Verify the password against app_users.password_hash (bcrypt).
//   2. Generate a 6-digit login OTP, store its hash, return it to the UI.
//   3. The UI then calls /api/auth/verify-otp (purpose: "login") to
//      complete authentication and bind the chat session.
//
// We split login into two steps (password + OTP) so that even if the
// password is guessed, an attacker without access to the email cannot
// complete the login.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getServiceSupabase } from "@/lib/supabase/server";
import { verifyPassword, generateOtp, hashOtp } from "@/lib/auth/helpers";
import { sendOtpEmail, isEmailConfigured } from "@/lib/email/send";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(6).max(128),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid input" },
      { status: 400 },
    );
  }
  const { email, password } = parsed.data;
  const supabase = getServiceSupabase();

  const userRows = await supabase.rpc("find_app_user_by_email", { p_email: email });
  const user = userRows.data?.[0];
  if (!user) {
    // Same error as wrong password — don't leak which is wrong.
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }
  const pwOk = await verifyPassword(password, user.password_hash);
  if (!pwOk) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  // Password OK — issue an OTP for the second factor.
  const otp = generateOtp(6);
  const codeHash = await hashOtp(otp);
  const otpRow = await supabase.rpc("create_app_otp", {
    p_email: email,
    p_code_hash: codeHash,
    p_purpose: "login",
    p_ttl_seconds: 600,
  });
  if (otpRow.error) {
    return NextResponse.json({ error: otpRow.error.message }, { status: 500 });
  }

  // Send the login OTP via email.
  const sent = await sendOtpEmail(email, otp, "login");

  return NextResponse.json({
    ok: true,
    email,
    requiresOtp: true,
    expiresAt: otpRow.data?.[0]?.expires_at ?? null,
    emailSent: sent,
    emailConfigured: isEmailConfigured(),
    message: sent
      ? "Password verified. Check your email for the 6-digit sign-in code."
      : isEmailConfigured()
        ? "Password verified. OTP stored — email delivery failed, contact support or try again."
        : "Password verified. OTP stored. (Email is not configured; ask the developer to set GMAIL_USER and GMAIL_APP_PASSWORD.)",
  });
}