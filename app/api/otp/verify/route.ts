// POST /api/otp/verify
// Body: { email, purpose: "quick_profile" | "worker_registration", otp }
//
// Verifies the OTP for the given email + purpose using the bcrypt
// hash stored in app_otps. On success, marks the OTP consumed and
// returns { ok: true }.
//
// The actual data write happens via the dedicated RPCs:
//   * /api/profile/save        → submit_quick_profile
//   * /api/worker/verify-otp   → verify_worker_registration
// This endpoint is intentionally minimal so the client can stage
// the verify-then-write flow without races.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().trim().email().max(254),
  purpose: z.enum(["quick_profile", "worker_registration"]),
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
  const { email, purpose, otp } = parsed.data;

  try {
    const supabase = getServiceSupabase();
    const { data: rows, error } = await supabase.rpc("find_valid_otp", {
      p_email: email,
      p_purpose: purpose,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const row = (rows ?? [])[0] as { id: string; code_hash: string } | undefined;
    if (!row) {
      return NextResponse.json(
        { error: "OTP expired or not found" },
        { status: 400 },
      );
    }

    const ok = await bcrypt.compare(otp, row.code_hash);
    if (!ok) {
      await supabase.rpc("bump_otp_attempts", { p_otp_id: row.id });
      return NextResponse.json({ error: "Incorrect OTP" }, { status: 400 });
    }

    await supabase.rpc("consume_otp", { p_otp_id: row.id });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}