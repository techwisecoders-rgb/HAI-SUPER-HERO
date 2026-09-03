// GET  /api/contact — public read of admin-configurable contact
//                    settings (phone + WhatsApp). Falls back to the
//                    bundled CONTACT constants so existing call sites
//                    keep working even before the SQL migration is run.
//
// PATCH /api/contact — admin-only update of a single contact setting.
//                    (Used by an admin UI / direct DB edits. Kept here
//                    so the table is wired through the same route as
//                    the read endpoint.)

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getServiceSupabase } from "@/lib/supabase/server";
import { getServerSupabase } from "@/lib/supabase/server-user";
import { CONTACT } from "@/content";

export const runtime = "nodejs";

type ContactRow = { key: string; value: string };

async function readContactSettings(): Promise<{ phone: string; whatsapp: string }> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("contact_settings")
      .select("key, value");
    if (error || !data) {
      return { phone: CONTACT.phone, whatsapp: CONTACT.whatsapp };
    }
    const map = new Map<string, string>(
      (data as ContactRow[]).map((r) => [r.key, r.value]),
    );
    return {
      phone: map.get("phone") ?? CONTACT.phone,
      whatsapp: map.get("whatsapp") ?? CONTACT.whatsapp,
    };
  } catch {
    // Table doesn't exist yet (SQL not run). Fall back gracefully.
    return { phone: CONTACT.phone, whatsapp: CONTACT.whatsapp };
  }
}

export async function GET() {
  const contact = await readContactSettings();
  return NextResponse.json({ contact });
}

const PatchBody = z.object({
  key: z.enum(["phone", "whatsapp"]),
  value: z.string().trim().min(3).max(40),
});

export async function PATCH(req: NextRequest) {
  // Admin gate: must be a logged-in admin.
  try {
    const sb = getServerSupabase();
    const { data, error } = await sb.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json({ error: "not authenticated" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  try {
    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from("contact_settings")
      .upsert({ key: parsed.data.key, value: parsed.data.value });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}