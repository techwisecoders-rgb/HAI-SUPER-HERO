// Application-level Telegram notifications — SERVER SIDE ONLY.
//
// This module turns chat events into the exact text that is pushed to
// Telegram, and enriches it with the visitor's profile (name / city) so the
// team knows who is talking to them.
//
// Callers:
//   * app/api/messages/route.ts        → a visitor sent a message
//   * app/api/worker/register/route.ts → a visitor submitted a registration
//   * app/admin/actions.ts             → an admin replied
//   * app/api/admin/telegram/test      → manual "send a test" button
//
// Every function here is best-effort: it resolves to `false` (and logs) on
// failure instead of throwing, so a Telegram outage can never break a chat.

import {
  escapeHtml,
  getTelegramChatIds,
  isTelegramConfigured,
  sendTelegramMessage,
} from "./send";
import { headers } from "next/headers";
import { getServiceSupabase } from "@/lib/supabase/server";

/** What we know about the person on the other end of the chat. */
export interface VisitorProfile {
  name: string | null;
  city: string | null;
  email: string | null;
}

const EMPTY_PROFILE: VisitorProfile = { name: null, city: null, email: null };

/**
 * Look up the visitor behind a chat session.
 *
 * `sessions.display_name` is rarely filled in, but a signed-in visitor also
 * has a `sessions.user_id` → `app_users` row carrying the display name,
 * city and e-mail collected on the /profile page.
 */
export async function lookupVisitorProfile(
  sessionId: string,
): Promise<VisitorProfile> {
  try {
    const supabase = getServiceSupabase();

    const { data: session, error } = await supabase
      .from("sessions")
      .select("display_name, user_id")
      .eq("id", sessionId)
      .maybeSingle();
    if (error || !session) return EMPTY_PROFILE;

    const row = session as { display_name?: string | null; user_id?: string | null };
    const sessionName = row.display_name ?? null;
    if (!row.user_id) {
      return { name: sessionName, city: null, email: null };
    }

    const { data: user, error: userError } = await supabase
      .from("app_users")
      .select("display_name, city, email")
      .eq("id", row.user_id)
      .maybeSingle();
    if (userError || !user) {
      return { name: sessionName, city: null, email: null };
    }

    const profile = user as {
      display_name?: string | null;
      city?: string | null;
      email?: string | null;
    };
    return {
      name: profile.display_name ?? sessionName,
      city: profile.city ?? null,
      email: profile.email ?? null,
    };
  } catch {
    return EMPTY_PROFILE;
  }
}

/** The friendliest label we have for a visitor. */
export function formatVisitorName(profile: VisitorProfile): string {
  const name = (profile.name ?? "").trim();
  if (name) return name;
  const email = (profile.email ?? "").trim();
  if (email) return email;
  return "Visitor";
}

/**
 * The public base URL of the site (used to build the deep link).
 *
 * `NEXT_PUBLIC_SITE_URL` wins when it is set. Otherwise the host of the
 * current request is used, so the Telegram link points at the domain the
 * visitor is actually on (localhost in dev, the real domain in production).
 */
function resolveOrigin(): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  if (configured) return configured.replace(/\/+$/, "");
  try {
    const h = headers();
    const host = h.get("host");
    if (host) {
      const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
      const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // Not running inside a request scope — fall through to the default.
  }
  return "http://localhost:3000";
}

/**
 * Deep link that opens the admin dashboard straight on that conversation.
 * The admin console reads the `session` query parameter (see
 * app/admin/conversations-panel.tsx).
 */
export function adminConversationUrl(sessionId: string): string {
  return `${resolveOrigin()}/admin?session=${encodeURIComponent(sessionId)}`;
}

/** "2026-10-20 15:04 UTC" — stable regardless of the server's timezone. */
function formatTimestamp(value?: string | Date | null): string {
  const date =
    value instanceof Date
      ? value
      : value
        ? new Date(value)
        : new Date();
  if (Number.isNaN(date.getTime())) return "unknown time";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/** "3f2a9c1b…" — a short, readable form of the session uuid. */
function shortId(sessionId: string): string {
  return sessionId.length > 8 ? `${sessionId.slice(0, 8)}…` : sessionId;
}

/** Build the body of the "a visitor wrote to us" notification. */
export function buildUserMessageNotification(input: {
  profile: VisitorProfile;
  sessionId: string;
  text: string;
  createdAt?: string | Date | null;
}): string {
  const { profile, sessionId, text } = input;
  const lines: string[] = [];

  lines.push("🔔 <b>New message from a visitor</b>", "");
  lines.push(`👤 <b>From:</b> ${escapeHtml(formatVisitorName(profile))}`);
  if (profile.city) {
    lines.push(`📍 <b>City:</b> ${escapeHtml(profile.city)}`);
  }
  if (profile.email) {
    lines.push(`✉️ <b>Email:</b> ${escapeHtml(profile.email)}`);
  }
  lines.push(`🆔 <b>Session:</b> <code>${escapeHtml(shortId(sessionId))}</code>`);
  lines.push("", `💬 <b>Message:</b>`, escapeHtml(text));
  lines.push(
    "",
    `🔗 <a href="${escapeHtml(adminConversationUrl(sessionId))}">Open this conversation</a>`,
  );
  lines.push(`🕒 ${escapeHtml(formatTimestamp(input.createdAt))}`);

  return lines.join("\n");
}

/** Build the body of the "we replied to a visitor" notification. */
export function buildAdminReplyNotification(input: {
  profile: VisitorProfile;
  sessionId: string;
  text: string;
  adminEmail?: string | null;
  createdAt?: string | Date | null;
}): string {
  const { profile, sessionId, text } = input;
  const lines: string[] = [];

  lines.push("💬 <b>New reply sent to a visitor</b>", "");
  lines.push(`👤 <b>To:</b> ${escapeHtml(formatVisitorName(profile))}`);
  if (profile.city) {
    lines.push(`📍 <b>City:</b> ${escapeHtml(profile.city)}`);
  }
  lines.push(`🆔 <b>Session:</b> <code>${escapeHtml(shortId(sessionId))}</code>`);
  if (input.adminEmail) {
    lines.push(`🛡️ <b>Answered by:</b> ${escapeHtml(input.adminEmail)}`);
  }
  lines.push("", `💬 <b>Reply:</b>`, escapeHtml(text));
  lines.push(
    "",
    `🔗 <a href="${escapeHtml(adminConversationUrl(sessionId))}">Open this conversation</a>`,
  );
  lines.push(`🕒 ${escapeHtml(formatTimestamp(input.createdAt))}`);

  return lines.join("\n");
}

/**
 * Notify Telegram that a visitor sent a message.
 * Returns `true` when the message was delivered.
 */
export async function notifyNewUserMessage(input: {
  sessionId: string;
  text: string;
  createdAt?: string | Date | null;
}): Promise<boolean> {
  if (!isTelegramConfigured()) {
    console.warn("[telegram] not configured — skipping visitor notification.");
    return false;
  }
  try {
    const profile = await lookupVisitorProfile(input.sessionId);
    const body = buildUserMessageNotification({
      profile,
      sessionId: input.sessionId,
      text: input.text,
      createdAt: input.createdAt,
    });
    const sent = await sendTelegramMessage(body, {
      parseMode: "HTML",
      disableWebPagePreview: true,
    });
    if (sent) {
      console.log(`[telegram] visitor notification sent (session ${input.sessionId}).`);
    }
    return sent;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[telegram] visitor notification failed: ${message}`);
    return false;
  }
}

/**
 * Notify Telegram that an admin replied to a visitor.
 * Can be switched off with TELEGRAM_NOTIFY_ADMIN_REPLIES=false.
 */
export async function notifyAdminReply(input: {
  sessionId: string;
  text: string;
  adminEmail?: string | null;
  createdAt?: string | Date | null;
}): Promise<boolean> {
  if (!adminReplyNotificationsEnabled()) return false;
  if (!isTelegramConfigured()) {
    console.warn("[telegram] not configured — skipping reply notification.");
    return false;
  }
  try {
    const profile = await lookupVisitorProfile(input.sessionId);
    const body = buildAdminReplyNotification({
      profile,
      sessionId: input.sessionId,
      text: input.text,
      adminEmail: input.adminEmail,
      createdAt: input.createdAt,
    });
    const sent = await sendTelegramMessage(body, {
      parseMode: "HTML",
      disableWebPagePreview: true,
    });
    if (sent) {
      console.log(`[telegram] reply notification sent (session ${input.sessionId}).`);
    }
    return sent;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[telegram] reply notification failed: ${message}`);
    return false;
  }
}

/** Admin replies are mirrored to Telegram unless explicitly disabled. */
export function adminReplyNotificationsEnabled(): boolean {
  const raw = (process.env.TELEGRAM_NOTIFY_ADMIN_REPLIES ?? "").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "no";
}

/** Send a manual test notification (used by the admin dashboard button). */
export async function sendTelegramTestMessage(): Promise<{
  sent: boolean;
  error?: string;
}> {
  if (!isTelegramConfigured()) {
    return {
      sent: false,
      error:
        "Telegram is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env.local.",
    };
  }
  const body = [
    "✅ <b>HAI SUPER HERO</b> — Telegram is connected.",
    "",
    "You will receive a message here every time a visitor writes on the chat.",
    `🕒 ${escapeHtml(formatTimestamp(null))}`,
  ].join("\n");

  const sent = await sendTelegramMessage(body, {
    parseMode: "HTML",
    disableWebPagePreview: true,
  });
  return sent ? { sent: true } : { sent: false, error: "Telegram rejected the message." };
}

/** Current Telegram configuration — surfaced by the admin test endpoint. */
export function telegramStatus(): {
  configured: boolean;
  chatIds: string[];
  adminRepliesEnabled: boolean;
} {
  return {
    configured: isTelegramConfigured(),
    chatIds: getTelegramChatIds(),
    adminRepliesEnabled: adminReplyNotificationsEnabled(),
  };
}
