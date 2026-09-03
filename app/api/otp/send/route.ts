// POST /api/otp/send
// Body: { email, purpose: "quick_profile" | "worker_registration" }
//
// Generates a 6-digit OTP for the supplied email + purpose, stores
// its bcrypt hash in app_otps (purpose check constraint was extended
// in migration 0014 to allow these new purposes), and emails the
// code via the existing Gmail SMTP helper.
//
// We do NOT require the user to exist in app_users yet for the
// "worker_registration" purpose (they may be a brand-new visitor).
// For "quick_profile" the flow expects an existing app_user; the
// submit_quick_profile RPC will raise "user not found" later if the
// row doesn't exist (after OTP verify).

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getServiceSupabase } from "@/lib/supabase/server";
import { generateOtp, hashOtp } from "@/lib/auth/helpers";
import { sendOtpEmail, isEmailConfigured } from "@/lib/email/send";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().trim().email().max(254),
  purpose: z.enum(["quick_profile", "worker_registration"]),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid input" },
      { status: 400 },
    );
  }
  const { email, purpose } = parsed.data;

  // Generate OTP + hash.
  const code = generateOtp(6);
  const codeHash = await hashOtp(code);

  // Insert into app_otps.
  try {
    const supabase = getServiceSupabase();
    // Match the schema used in 0006: ttl_seconds int, code_hash text,
    // purpose text, email text. The app_otps table has a check
    // constraint on purpose that allows these values after migration
    // 0014.
    const { error } = await supabase.rpc("create_app_otp" as never, {
      p_email: email,
      p_code_hash: codeHash,
      p_purpose: purpose,
      p_ttl_seconds: 600,
    } as never).then((r: { data: unknown; error: unknown }) => r);
    if (error) {
      return NextResponse.json(
        { error: (error as { message?: string }).message ?? "Could not store OTP" },
        { status: 500 },
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Email the code (best-effort — the OTP is stored, so a resend
  // request will work even if the email bounces).
  const sent = await sendOtpEmail(email, code, purpose === "worker_registration" ? "register" : "register");

  return NextResponse.json({
    ok: true,
    emailSent: sent,
    emailConfigured: isEmailConfigured(),
    message: sent
      ? `A 6-digit code has been sent to ${email}.`
      : isEmailConfigured()
        ? `OTP stored but email delivery failed. Ask the developer to check the Gmail SMTP configuration.`
        : `OTP stored. (Email is not configured in this environment; ask the developer to set GMAIL_USER and GMAIL_APP_PASSWORD.)`,
  });
}