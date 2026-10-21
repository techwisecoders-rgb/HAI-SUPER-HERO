// DELETE /api/admin/session — sign the administrator out.
//
// This performs the same server-side Supabase sign-out as the admin
// dashboard's signOutAction (shared implementation in
// lib/admin/session.ts). Exposing it as a route also lets the session
// invalidation be verified end-to-end.
//
// Note: /api/auth/logout only clears the *visitor* cookies and does not
// touch the Supabase admin session.

import { NextResponse } from "next/server";
import { signOutAdminSession } from "@/lib/admin/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE() {
  const result = await signOutAdminSession();
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Could not sign out" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
