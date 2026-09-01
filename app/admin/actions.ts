// Server actions used by the admin dashboard.
// All actions use the SERVICE ROLE key — they run on the server only.

"use server";

import { z } from "zod";
import { getServiceSupabase } from "@/lib/supabase/server";
import { getServerSupabase } from "@/lib/supabase/server-user";

async function requireAdmin() {
  const sb = getServerSupabase();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new Error("not_authenticated");
  return data.user;
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

  const q = (query ?? "").trim().toLowerCase();
  return (sessions ?? [])
    .map((s) => ({ ...s, last_message: lastBySession.get(s.id) ?? null }))
    .filter((s) => {
      if (!q) return true;
      const t = (s.last_message?.text ?? "").toLowerCase();
      return t.includes(q);
    });
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
