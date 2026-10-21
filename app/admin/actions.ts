// Server actions used by the admin dashboard.
// All actions use the SERVICE ROLE key — they run on the server only.

"use server";

import { z } from "zod";
import { getServiceSupabase } from "@/lib/supabase/server";
import { getServerSupabase } from "@/lib/supabase/server-user";
import { hashPassword } from "@/lib/auth/helpers";
import { requireAdmin } from "@/lib/admin/guard";
import { signOutAdminSession } from "@/lib/admin/session";
import {
  BusinessListQuery,
  WorkerListQuery,
  getBusinessById,
  getWorkerById,
  listBusinesses,
  listWorkers,
} from "@/lib/admin/directory";
import {
  BusinessUpdateBody,
  WorkerUpdateBody,
  updateBusiness,
  updateWorker,
} from "@/lib/admin/updates";
import type { Project, ProjectPersonType } from "@/types";
import { notifyAdminReply } from "@/lib/telegram/notify";

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
  // Mirror the reply to Telegram so the conversation is also visible on
  // the phone. Best-effort: it never blocks (or breaks) the send.
  await notifyAdminReply({
    sessionId: parsed.sessionId,
    text: parsed.text,
    adminEmail: user.email,
    createdAt: (data as { created_at?: string } | null)?.created_at ?? null,
  });
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

export async function listProjectsAction(personType?: string) {
  await requireAdmin();
  const supabase = getServiceSupabase();
  let query = supabase
    .from("projects")
    .select("*")
    .order("sort_order", { ascending: true });
  if (personType === "users" || personType === "businesses" || personType === "workers") {
    query = query.eq("person_type", personType);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Project[];
}

export async function createProjectAction(input: {
  title: string;
  description?: string | null;
  image_url: string;
  url: string;
  person_type: ProjectPersonType;
}) {
  await requireAdmin();
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("projects")
    .insert({ ...input })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Project;
}

export async function updateProjectAction(id: string, input: Partial<{
  title: string;
  description: string | null;
  image_url: string;
  url: string;
  person_type: ProjectPersonType;
}>) {
  await requireAdmin();
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("projects")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Project;
}

export async function deleteProjectAction(id: string) {
  await requireAdmin();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-...[0-9a-f]{12}$/i.test(id)) throw new Error("bad id");
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/**
 * Sign the administrator out.
 *
 * Delegates to the shared implementation (lib/admin/session.ts) so the
 * server action and the DELETE /api/admin/session route behave
 * identically. The Supabase session cookie is expired by the cookie
 * adapter; the browser client clears its own copy (see AdminDashboard).
 */
export async function signOutAction() {
  const result = await signOutAdminSession();
  if (!result.ok) throw new Error(result.error ?? "Could not sign out");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Worker & business management
//
// These power the admin dashboard's Workers and Businesses sections. They
// reuse the existing service-role data layer (lib/admin/directory.ts and
// lib/admin/updates.ts) and always run behind requireAdmin(), so a
// non-admin can neither read nor modify protected records.
// ---------------------------------------------------------------------------

export async function listWorkersAction(input: {
  search?: string;
  profession?: string;
  location?: string;
  availability?: "all" | "available" | "unavailable";
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  perPage?: number;
}) {
  await requireAdmin();
  const parsed = WorkerListQuery.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "invalid input");
  }
  return listWorkers(parsed.data);
}

export async function getWorkerAction(id: string) {
  await requireAdmin();
  const worker = await getWorkerById(id);
  if (!worker) throw new Error("worker_not_found");
  return worker;
}

export async function updateWorkerAction(id: string, input: unknown) {
  await requireAdmin();
  const parsed = WorkerUpdateBody.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "invalid input");
  }
  const worker = await updateWorker(id, parsed.data);
  if (!worker) throw new Error("worker_not_found");
  return worker;
}

export async function listBusinessesAction(input: {
  search?: string;
  category?: string;
  location?: string;
  status?: "all" | "draft" | "published" | "suspended";
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  perPage?: number;
}) {
  await requireAdmin();
  const parsed = BusinessListQuery.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "invalid input");
  }
  return listBusinesses(parsed.data);
}

export async function getBusinessAction(id: string) {
  await requireAdmin();
  const business = await getBusinessById(id);
  if (!business) throw new Error("business_not_found");
  return business;
}

export async function updateBusinessAction(id: string, input: unknown) {
  await requireAdmin();
  const parsed = BusinessUpdateBody.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "invalid input");
  }
  const business = await updateBusiness(id, parsed.data);
  if (!business) throw new Error("business_not_found");
  return business;
}
