// lib/chat-auto-replies.ts
//
// Pure helpers for the client-side special-reply logic that fires after
// the user sends a message in /chat. The actual server-side auto-reply
// system (pattern-match rules in `auto_reply_rules`) still runs in
// /api/messages, but several rules are duplicated here so they can fire
// even when the server rules don't match, and so we can use the
// conversation's local state (last-seen date, completion count, etc.)
// without round-tripping to the DB.
//
// IMPORTANT — DESIGN DECISIONS:
//
//   * These replies are LOCAL ONLY. They are not persisted to the
//     `messages` table and therefore won't show up in the admin panel
//     or survive a page refresh. That's a deliberate trade-off chosen
//     by the project owner for "make it work" simplicity.
//
//   * To avoid duplicating the server-side replies for triggers that
//     ALSO have a pattern in `auto_reply_rules` (good morning,
//     first-work-completed, generic-work-completed), we use
//     `isDuplicateOfServerReply` — if a server-side `auto` message in
//     the conversation already covers this reply, we skip it.

import type { Message } from "@/types";

/**
 * Distinctive opening of each server-side `auto_reply_rules` row that
 * covers the same trigger as one of our client-side replies. Used to
 * suppress the client-side reply when the server already fired one.
 *
 * Keep these short (~30 chars) so a single substring match is enough
 * to detect the duplicate. The values mirror the seeded replies in
 * supabase/migrations/0012_auto_reply_triggers.sql.
 */
const SERVER_REPLY_FINGERPRINTS: readonly string[] = [
  // "Good Morning Boss." (server pattern: "good morning")
  "Good Morning Boss.",
  // "Good Evening Boss." (server pattern: "good evening")
  "Good Evening Boss.",
  // "Excellent Start, Boss!.." (server pattern: "first work is successfully completed")
  "Excellent Start, Boss!",
  // "Always At Your Service, Boss!." (server pattern: "work is successfully completed")
  "Always At Your Service, Boss",
];

/**
 * Returns true if `reply` appears to duplicate a server-side auto
 * reply that's already in the conversation. We look for any of the
 * server reply fingerprints inside existing auto messages — if found,
 * the server already covered this topic.
 */
function isDuplicateOfServerReply(
  reply: string,
  existingAutoReplies: readonly Message[],
): boolean {
  return existingAutoReplies.some((m) =>
    SERVER_REPLY_FINGERPRINTS.some((fp) =>
      m.text.toLowerCase().includes(fp.toLowerCase()),
    ),
  );
}

/**
 * Mutable conversation state shared across messages. The caller (the
 * `send` callback in /chat) holds the reference and persists the
 * counters between calls.
 */
export interface SpecialReplyState {
  /** True once the user has sent their first user message in this session. */
  hasMessagedBefore: boolean;
  /** Total count of "work is successfully completed"-type completions. */
  workCompletions: number;
  /** ISO date (yyyy-mm-dd) of the last user message that triggered a reply. */
  lastUserDate?: string;
}

/** Helper: yyyy-mm-dd in local time. */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Helper: whole days between two dates, ignoring time-of-day. */
function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 86_400_000;
  const ad = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bd = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((bd - ad) / MS_PER_DAY);
}

/**
 * Evaluate the special-reply logic against the current conversation.
 *
 * Mutates `state` (sets hasMessagedBefore=true, increments
 * workCompletions) and returns an array of reply strings to display.
 * The order matches the original spec: greeting first, completion
 * messages after.
 *
 * @param messages The current list of messages in the conversation
 *                 (used for lastDate derivation and duplicate detection).
 * @param text     The user's just-sent message text.
 * @param state    Conversation state; mutated in place.
 * @param now      Override for the current time (defaults to `new Date()`).
 */
export function evaluateSpecialReplies(
  messages: readonly Message[],
  text: string,
  state: SpecialReplyState,
  now: Date = new Date(),
): string[] {
  const replies: string[] = [];

  // ---- Greeting / first-time / returning-visitor logic ----
  if (!state.hasMessagedBefore) {
    replies.push(
      "Hearty Congratulations On Your First Step, Boss\nThank You For Reaching Out.\nI’m Your Personalised Super Hero, Boss! 🦸‍♂️\nFrom This Moment On, I’ll Be By Your Side With My Super Powers.\nLet’s Make This Journey More Memorable Together! ",
    );
    state.hasMessagedBefore = true;
  } else {
    // Find the most recent prior user message timestamp.
    const lastUser = [...messages]
      .reverse()
      .find((m) => m.sender_type === "user");
    const lastDate = lastUser ? new Date(lastUser.created_at) : null;
    const lastDateStr = lastDate ? ymd(lastDate) : undefined;
    const todayStr = ymd(now);
    const daysSinceLast = lastDate ? daysBetween(lastDate, now) : 0;

    if (daysSinceLast > 7) {
      replies.push(
        "Boss, I am so happy You're Back! Your superHero is awaiting for you from a long time. But Great Journeys Never Really Stop. Let's Continue Where We Left Off.",
      );
    } else if (lastDateStr !== undefined && lastDateStr !== todayStr) {
      replies.push(
        "Good Morning Boss. This is our first message for today. Welcome back. A New Day, A New Beginning.. Have A Great Day, Boss! Lets start making this day more meaningful. Your superHero is ready to complete all your today works so easily",
      );
    }

    state.lastUserDate = todayStr;
  }

  // ---- Completion / milestone logic ----
  const lower = text.toLowerCase();

  if (lower.includes("first work is successfully completed")) {
    replies.push(
      "Excellent Start, Boss!..That's the superHero for you.\nI am so happy to fulfill your first dream with my super powers!",
    );
    state.workCompletions = (state.workCompletions || 0) + 1;
  } else if (lower.includes("work is successfully completed")) {
    replies.push(
      "Always At Your Service, Boss!. I am your personalised super hero. I make the jobs done with my super power. And I am so happy that you are satisfied with the work. And the small remainder.. Whenever You Need Me, I'm Here, My Boss",
    );
    state.workCompletions = (state.workCompletions || 0) + 1;
  }

  // 10-completions milestone (derived purely from the counter we
  // maintain here, so no duplicate-suppression is needed).
  if (state.workCompletions === 10) {
    replies.push(
      "Look How Far We've Come! Each of our conversation is so memoriable.",
    );
  }

  // ---- De-duplicate against server-side replies ----
  // The server's pattern-match rules already cover some of these
  // triggers (good morning, completions). If the server already
  // inserted an auto message covering the same topic, drop our client
  // version to avoid double-firing.
  const existingAuto = messages.filter((m) => m.sender_type === "auto");
  const deduped = replies.filter(
    (r) => !isDuplicateOfServerReply(r, existingAuto),
  );

  return deduped;
}
