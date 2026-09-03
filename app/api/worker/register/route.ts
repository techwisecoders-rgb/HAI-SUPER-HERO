// POST /api/worker/register
// Body: full worker registration form fields (see zod schema).
//
// 1. Creates a *pending* row in public.worker_registrations via the
//    `submit_worker_registration` SECURITY DEFINER RPC.
// 2. If the registration includes an email, generates a 6-digit OTP
//    and emails it to the user (purpose='worker_registration'). The
//    row stays unverified until /api/worker/verify-otp is called.
// 3. If no email was supplied, the row is marked verified immediately
//    (the user has no way to receive an OTP). The response indicates
//    `requiresOtp: false` so the page can skip the OTP step.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  SESSION_COOKIE,
  APP_USER_COOKIE,
} from "@/lib/cookies";
import { getServiceSupabase } from "@/lib/supabase/server";
import { generateOtp, hashOtp } from "@/lib/auth/helpers";
import { sendOtpEmail, isEmailConfigured } from "@/lib/email/send";

export const runtime = "nodejs";

const Body = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^[0-9]{10}$/, "phone must be 10 digits"),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  address: z.string().trim().min(3).max(500),
  workType: z.string().trim().min(2).max(80),
  workDescription: z.string().trim().min(2).max(2000),
  qualification: z.string().trim().max(200).optional().or(z.literal("").transform(() => undefined)),
  yearsExperience: z.string().trim().max(40).optional().or(z.literal("").transform(() => undefined)),
  availability: z.string().trim().max(80).optional().or(z.literal("").transform(() => undefined)),
});

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue?.message ?? "invalid input" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const cookieSid = req.cookies.get(SESSION_COOKIE)?.value;
  const cookieUid = req.cookies.get(APP_USER_COOKIE)?.value;
  const sessionId = cookieSid && isUuid(cookieSid) ? cookieSid : null;
  const userId = cookieUid && isUuid(cookieUid) ? cookieUid : null;

  try {
    const supabase = getServiceSupabase();
    const { data: row, error } = await supabase.rpc(
      "submit_worker_registration",
      {
        p_session_id: sessionId,
        p_user_id: userId,
        p_full_name: data.fullName,
        p_phone: data.phone,
        p_email: data.email ?? null,
        p_address: data.address,
        p_work_type: data.workType,
        p_work_description: data.workDescription,
        p_qualification: data.qualification ?? null,
        p_years_experience: data.yearsExperience ?? null,
        p_availability: data.availability ?? null,
      },
    ).single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const registration = row as { id: string; email: string | null } | null;
    if (!registration) {
      return NextResponse.json({ error: "Failed to create registration" }, { status: 500 });
    }

    // No email → can't deliver an OTP. Auto-verify the row.
    if (!registration.email) {
      await supabase
        .from("worker_registrations")
        .update({ verified_at: new Date().toISOString() })
        .eq("id", registration.id);
      return NextResponse.json({
        ok: true,
        registrationId: registration.id,
        requiresOtp: false,
        message: "Registration saved. (No email was provided, so no OTP was sent.)",
      });
    }

    // Email supplied → generate, hash, store, email.
    const code = generateOtp(6);
    const codeHash = await hashOtp(code);
    const { error: otpErr } = await supabase.rpc("create_app_otp" as never, {
      p_email: registration.email,
      p_code_hash: codeHash,
      p_purpose: "worker_registration",
      p_ttl_seconds: 600,
    } as never).then((r: { data: unknown; error: unknown }) => r);
    if (otpErr) {
      return NextResponse.json(
        { error: (otpErr as { message?: string }).message ?? "Could not send OTP" },
        { status: 500 },
      );
    }
    const sent = await sendOtpEmail(registration.email, code, "register");
    return NextResponse.json({
      ok: true,
      registrationId: registration.id,
      requiresOtp: true,
      emailSent: sent,
      emailConfigured: isEmailConfigured(),
      message: sent
        ? `Registration saved. A 6-digit code has been sent to ${registration.email} — please enter it to confirm.`
        : isEmailConfigured()
          ? "Registration saved. Email delivery failed, please contact support."
          : "Registration saved. (Email is not configured; ask the developer to set GMAIL_USER and GMAIL_APP_PASSWORD.)",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}