// Admin session lifecycle.
//
// Signing out must invalidate the *Supabase* session (not just the
// visitor cookies handled by /api/auth/logout), otherwise a signed-out
// admin could keep using the dashboard until the access token expired.
//
// The @supabase/ssr server client removes the session cookie through the
// cookie adapter, which expires it in the browser. The browser client
// keeps its own copy, so callers should also call `auth.signOut()` there
// (see app/admin/dashboard.tsx).

import { getServerSupabase } from "@/lib/supabase/server-user";

export interface SignOutResult {
  ok: boolean;
  error?: string;
}

/**
 * Invalidate the current administrator session server-side.
 * Never throws — a failure is reported so the caller can show an error
 * instead of a misleading success message.
 */
export async function signOutAdminSession(): Promise<SignOutResult> {
  try {
    const sb = getServerSupabase();
    const { error } = await sb.auth.signOut();
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not sign out" };
  }
}
