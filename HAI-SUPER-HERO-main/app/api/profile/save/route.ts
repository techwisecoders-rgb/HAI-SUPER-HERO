// POST /api/profile/save
// Body: { email, displayName, city, otp }
//
// Atomic: verifies the OTP (purpose='quick_profile') and writes the
// profile (display_name + city) onto the existing app_users row.
// The user must have already signed in once via /api/auth/verify-otp
// (purpose='register' or 'login') so that the app_users row exists.
//
// This is the second half of the /profile flow — the OtpGate in the
// page handles the OTP UI; this endpoint handles the actual write.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().trim().email().max(254),
  displayName: z.string().trim().min(1).max(120),
  city: z.string().trim().max(80).optional().or(z.literal("").transform(() => undefined)),
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
  const { email, displayName, city, otp } = parsed.data;

  try {
    const supabase = getServiceSupabase();
    const { data: row, error } = await supabase.rpc("submit_quick_profile" as never, {
      p_email: email,
      p_display_name: displayName,
      p_city: city ?? "",
      p_otp: otp,
    } as never).single();
    if (error) {
      return NextResponse.json(
        { error: (error as { message?: string }).message ?? "Could not save profile" },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, user: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}