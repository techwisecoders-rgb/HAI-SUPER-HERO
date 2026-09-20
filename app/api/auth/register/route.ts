// POST /api/auth/register
// Body: { email, password, confirmPassword }
// Steps:
//   1. Validate the input (email format, password length, match).
//   2. Bcrypt the password on the server (never send plaintext over the wire).
//   3. Insert into app_users via SECURITY DEFINER RPC.
//   4. Generate a 6-digit OTP, store its hash.
//   5. Send the OTP to the user's email via Gmail SMTP (nodemailer).
//      If email delivery fails, we still return ok — the OTP is in the
//      DB and the user can request a resend.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getServiceSupabase } from "@/lib/supabase/server";
import { hashPassword, generateOtp, hashOtp } from "@/lib/auth/helpers";
import { sendOtpEmail, isEmailConfigured } from "@/lib/email/send";

export const runtime = "nodejs";

const Body = z
  .object({
    email: z.string().trim().email().max(254),
    password: z.string().min(6).max(128),
    confirmPassword: z.string().min(6).max(128),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "passwords do not match",
    path: ["confirmPassword"],
  });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue?.message ?? "invalid input" },
      { status: 400 },
    );
  }
  const { email, password } = parsed.data;
  const supabase = getServiceSupabase();

  // 1. Reject if already registered.
  const existing = await supabase.rpc("find_app_user_by_email", {
    p_email: email,
  });
  if (existing.data && existing.data.length > 0) {
    return NextResponse.json(
      { error: "email already registered" },
      { status: 409 },
    );
  }

  // 2. Create the user.
  const passwordHash = await hashPassword(password);
  const created = await supabase.rpc("create_app_user", {
    p_email: email,
    p_password_hash: passwordHash,
  });
  if (created.error || !created.data || created.data.length === 0) {
    return NextResponse.json(
      { error: created.error?.message ?? "could not create user" },
      { status: 500 },
    );
  }

  // 3. Generate + store OTP.
  const otp = generateOtp(6);
  const codeHash = await hashOtp(otp);
  const otpRow = await supabase.rpc("create_app_otp", {
    p_email: email,
    p_code_hash: codeHash,
    p_purpose: "register",
    p_ttl_seconds: 600,
  });
  if (otpRow.error) {
    return NextResponse.json(
      { error: otpRow.error.message },
      { status: 500 },
    );
  }

  // 4. Send the OTP via email. If sending fails, we still return ok
  //    because the OTP is stored in the DB and the user can ask for
  //    a resend.
  const sent = await sendOtpEmail(email, otp, "register");

  return NextResponse.json({
    ok: true,
    email,
    userId: created.data[0].id,
    expiresAt: otpRow.data?.[0]?.expires_at ?? null,
    emailSent: sent,
    emailConfigured: isEmailConfigured(),
    message: sent
      ? "Account created. Check your email for the 6-digit verification code."
      : isEmailConfigured()
        ? "Account created. OTP stored — email delivery failed, contact support or try again."
        : "Account created. OTP stored. (Email is not configured in this environment; ask the developer to set GMAIL_USER and GMAIL_APP_PASSWORD.)",
  });
}