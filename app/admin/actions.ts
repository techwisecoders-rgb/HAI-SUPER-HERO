// Server actions used by the admin dashboard.
// All actions use the SERVICE ROLE key — they run on the server only.

"use server";

import { z } from "zod";
import { getServiceSupabase } from "@/lib/supabase/server";
import { getServerSupabase } from "@/lib/supabase/server-user";
import { hashPassword } from "@/lib/auth/helpers";

async function requireAdmin() {
  const sb = getServerSupabase();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new Error("not_authenticated");
  return data.user;
}

const CreateBusinessBody = z
  .object({
    email: z.string().trim().email().max(254),
    password: z.string().min(6).max(128),
    confirmPassword: z.string().min(6).max(128),
  })
  .refine((input) => input.password === input.confirmPassword, {
    message: "passwords do not match",
    path: ["confirmPassword"],
  });

/** Create business login credentials. The business profile is created by its owner after sign-in. */
export async function createBusinessAction(input: z.infer<typeof CreateBusinessBody>) {
  await requireAdmin();
  const parsed = CreateBusinessBody.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "invalid input");
  }

  const email = parsed.data.email.toLowerCase();
  const supabase = getServiceSupabase();
  const existing = await supabase.rpc("find_app_user_by_email", { p_email: email });
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data && existing.data.length > 0) {
    throw new Error("email already registered");
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const created = await supabase.rpc("create_app_user", {
    p_email: email,
    p_password_hash: passwordHash,
  });
  if (created.error || !created.data || created.data.length === 0) {
    throw new Error(created.error?.message ?? "could not create business credentials");
  }

  return {
    ok: true,
    email,
    userId: created.data[0].id,
  };
}

export async function listSessionsAction(query?: string) {
  await requireAdmin();
  const supabase = getServiceSupabase();
  // Sessions with a "last message" preview via a left join-like query.
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("*")
    .order("last_seen_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  // Last message per session (recent N messages, then trimmed in JS).
  const ids = (sessions ?? []).map((s) => s.id);
  if (ids.length === 0) return [];

  const { data: msgs, error: mErr } = await supabase
    .from("messages")
    .select("id, session_id, sender_type, text, created_at")
    .in("session_id", ids)
    .order("created_at", { ascending: false })
    .limit(Math.max(ids.length * 5, 50));
  if (mErr) throw new Error(mErr.message);

  const lastBySession = new Map<string, { id: string; session_id: string; sender_type: string; text: string; created_at: string }>();
  for (const m of (msgs ?? []) as Array<{ session_id: string; id: string; sender_type: string; text: string; created_at: string }>) {
    if (!lastBySession.has(m.session_id)) lastBySession.set(m.session_id, m);
  }

  // Unread counts per session: number of "user" messages newer than
  // last_read_by_admin_at (or all user messages if never read).
  // We compute it in JS to avoid an extra round-trip.
  const { data: allUserMsgs, error: uErr } = await supabase
    .from("messages")
    .select("session_id, created_at")
    .eq("sender_type", "user")
    .in("session_id", ids);
  if (uErr) throw new Error(uErr.message);
  const unreadBySession = new Map<string, number>();
  for (const m of (allUserMsgs ?? []) as Array<{ session_id: string; created_at: string }>) {
    const s = (sessions ?? []).find((x) => x.id === m.session_id);
    if (!s) continue;
    const lastRead = (s as { last_read_by_admin_at?: string | null }).last_read_by_admin_at;
    if (!lastRead || new Date(m.created_at) > new Date(lastRead)) {
      unreadBySession.set(m.session_id, (unreadBySession.get(m.session_id) ?? 0) + 1);
    }
  }

  const q = (query ?? "").trim().toLowerCase();
  return (sessions ?? [])
    .map((s) => ({
      ...s,
      last_message: lastBySession.get(s.id) ?? null,
      unread_count: unreadBySession.get(s.id) ?? 0,
    }))
    .filter((s) => {
      if (!q) return true;
      const t = (s.last_message?.text ?? "").toLowerCase();
      return t.includes(q);
    });
}

/**
 * Mark a session as "read by admin" — bumps its last_read_by_admin_at
 * to now so unread counts drop to zero. Called when the admin opens a
 * session OR sends a reply (sending implies "I've read everything").
 */
export async function markSessionReadAction(sessionId: string) {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new Error("bad session id");
  const supabase = getServiceSupabase();
  const { error } = await supabase.rpc("mark_session_read", {
    p_session_id: sessionId,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

const SendBody = z.object({
  sessionId: z.string().uuid(),
  text: z.string().trim().min(1).max(2000),
});

export async function sendAdminMessageAction(input: z.infer<typeof SendBody>) {
  const user = await requireAdmin();
  const parsed = SendBody.parse(input);
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .rpc("append_admin_message", { p_session_id: parsed.sessionId, p_text: parsed.text })
    .single();
  if (error) throw new Error(error.message);
  // Sending a reply implies "I've read everything up to here" — bump
  // last_read_by_admin_at so the unread counter drops to zero on the
  // next listSessionsAction() call. Best-effort; never blocks send.
  await supabase
    .rpc("mark_session_read", { p_session_id: parsed.sessionId })
    .then(() => undefined, () => undefined);
  return { ok: true, message: data, adminId: user.id };
}

export async function getMessagesAction(sessionId: string, limit = 200) {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new Error("bad session id");
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.rpc("get_session_messages", {
    p_session_id: sessionId,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function signOutAction() {
  const sb = getServerSupabase();
  await sb.auth.signOut();
  // Cookie cleanup is handled by Supabase's auth helpers on the response.
}
