// POST /api/worker/verify-otp
// Body: { registrationId: uuid, otp: string }
//
// Second half of the worker-registration flow. /api/worker/register
// creates a *pending* row in worker_registrations AND emails an
// OTP to the supplied email (if provided). The user types the OTP
// in the page and we call this endpoint to mark the registration as
// verified.
//
// If the registration has no email on file (the user filled the
// form without an email), /api/worker/register auto-verifies the
// row directly — no OTP needed and this endpoint should never be
// called in that case.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getServiceSupabase } from "@/lib/supabase/server";
import {
  formatWorkerRegistrationConfirmedMessage,
} from "@/lib/worker-registration-message";

export const runtime = "nodejs";

const Body = z.object({
  registrationId: z.string().uuid(),
  otp: z.string().trim().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid input" },
      { status: 400 },
    );
  }
  const { registrationId, otp } = parsed.data;

  try {
    const supabase = getServiceSupabase();
    const { data: row, error } = await supabase.rpc("verify_worker_registration" as never, {
      p_registration_id: registrationId,
      p_otp: otp,
    } as never).single();
    if (error) {
      return NextResponse.json(
        { error: (error as { message?: string }).message ?? "Could not verify" },
        { status: 400 },
      );
    }
    const registration = row as {
      id: string;
      session_id: string | null;
      full_name: string;
      phone: string;
      email: string | null;
      address: string;
      work_type: string;
      work_description: string;
      qualification: string | null;
      years_experience: string | null;
      availability: string | null;
    } | null;

    // Mirror the confirmation into the chat so the visitor and admin
    // both see "✅ Worker registration confirmed" in the same thread.
    // Fire-and-forget — never block the verify response on a chat
    // mirror failure.
    if (registration?.session_id) {
      const chatText = formatWorkerRegistrationConfirmedMessage(registration);
      void supabase.rpc("append_auto_message" as never, {
        p_session_id: registration.session_id,
        p_text: chatText,
      } as never).then(
        () => undefined,
        (e: unknown) => {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[worker/verify-otp] chat-mirror insert failed:", msg);
        },
      );
    }

    return NextResponse.json({ ok: true, registration: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}