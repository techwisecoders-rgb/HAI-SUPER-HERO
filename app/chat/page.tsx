"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Cookies from "js-cookie";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useKeyboardAwareInput } from "@/lib/use-keyboard-aware-input";
import { SESSION_COOKIE, APP_USER_COOKIE, APP_EMAIL_COOKIE } from "@/lib/cookies";
import { useAuth, notifyAuthChanged } from "@/lib/use-auth";
import { CONTACT } from "@/content";
import type { Message, ContactSettings } from "@/types";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import {
  fireDesktopNotification,
  registerNotificationServiceWorker,
} from "@/lib/notifications";
import {
  evaluateSpecialReplies,
  type SpecialReplyState,
} from "@/lib/chat-auto-replies";
import styles from "./page.module.css";

function formatTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const h24 = date.getHours();
  const m = date.getMinutes().toString().padStart(2, "0");
  const ampm = h24 >= 12 ? "pm" : "am";
  const h = (h24 % 12 || 12).toString().padStart(2, "0");
  return `${h}:${m} ${ampm}`;
}

/**
 * Read the existing session id from cookies. The server is the source of
 * truth: if no session cookie exists, we POST /api/session {action:"bootstrap"}
 * and let the server mint the UUID. The chat page NEVER generates a UUID
 * itself — that previously caused a new "user" row on every refresh because
 * the client-side id and the server-side id diverged.
 */
async function ensureServerSession(): Promise<string | null> {
  // 1. If we already have a cookie that looks like a UUID, use it as-is.
  const existing = Cookies.get(SESSION_COOKIE);
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;

  // 2. Otherwise ask the server to mint one. This single source of truth
  //    ensures the DB row and the cookie always agree.
  try {
    const r = await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "bootstrap" }),
    });
    if (r.ok) {
      const { sessionId } = (await r.json()) as { sessionId?: string };
      if (sessionId) {
        // Mirror into js-cookie so subsequent reads in this tab are instant.
        // The server already set the cookie via Set-Cookie, but writing here
        // avoids any first-render race.
        Cookies.set(SESSION_COOKIE, sessionId, {
          expires: 365,
          sameSite: "lax",
          path: "/",
        });
        return sessionId;
      }
    }
  } catch {
    // network blip — fall through
  }
  return null;
}

export default function ChatPage() {
  return (
    <Suspense fallback={<main className={styles.shell} />}>
      <ChatInner />
    </Suspense>
  );
}

function ChatInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [contact, setContact] = useState<ContactSettings>({
    phone: CONTACT.phone,
    whatsapp: CONTACT.whatsapp,
  });
  const listRef = useRef<HTMLDivElement | null>(null);
  const barRef = useKeyboardAwareInput<HTMLDivElement>();
  // Mutable state for the client-side special-reply logic (first-time
  // greeting, returning-visitor, completion milestones). Persists across
  // `send()` calls but resets on remount of the page component. The
  // helper in `lib/chat-auto-replies.ts` mutates this object in place.
  const specialReplyStateRef = useRef<SpecialReplyState>({
    hasMessagedBefore: false,
    workCompletions: 0,
  });

  // Optional URL params: ?new=1 → wipe local list on mount;
  // ?focus=search → auto-trigger the in-chat search handler.
  useEffect(() => {
    if (params.get("new") === "1") setMessages([]);
  }, [params]);

  /**
   * Append client-side special ("auto"-type) replies to the given
   * message list, based on the rules in `lib/chat-auto-replies.ts`.
   * Returns the new list (mutates `specialReplyStateRef.current`
   * in place via the helper). Each reply is given a synthetic
   * local-only id and the current timestamp so the chat renderer
   * shows them with the standard "auto" bubble styling.
   */
  const appendLocalAutoReplies = useCallback(
    (list: Message[], userText: string): Message[] => {
      const replies = evaluateSpecialReplies(
        list,
        userText,
        specialReplyStateRef.current,
        new Date(),
      );
      if (replies.length === 0) return list;
      const nowIso = new Date().toISOString();
      const additions: Message[] = replies.map((text) => ({
        id: `local-auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        session_id: sessionId ?? "",
        sender_type: "auto",
        admin_id: null,
        text,
        created_at: nowIso,
      }));
      return [...list, ...additions];
    },
    [sessionId],
  );

  // Fetch admin-editable contact numbers (phone + WhatsApp). Falls back
  // to the bundled CONTACT constants when the API/DB is unavailable.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/contact")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.contact) return;
        setContact({
          phone: d.contact.phone ?? CONTACT.phone,
          whatsapp: d.contact.whatsapp ?? CONTACT.whatsapp,
        });
      })
      .catch(() => { /* keep defaults */ });
    return () => { cancelled = true; };
  }, []);

  // Apply light / dark theme to the chat shell + scroll container.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const shell = document.querySelector(`.${styles.shell}`) as HTMLElement | null;
    const list  = document.querySelector(`.${styles.list}`)  as HTMLElement | null;
    if (!shell || !list) return;
    if (theme === "dark") {
      shell.style.background = "#1e2932";
      list.style.background  = "#2b3540";
    } else {
      shell.style.background = "#f0f4f8";
      list.style.background  = "#e8eef4";
    }
  }, [theme, messages.length]);

  // Logout the current user. Server-side clears all 3 cookies via
  // /api/auth/logout; we also remove the local js-cookie copies and
  // notify every mounted useAuth() so the header flips back to "Login".
  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore network errors; we still clear local state below
    }
    Cookies.remove(APP_USER_COOKIE, { path: "/" });
    Cookies.remove(APP_EMAIL_COOKIE, { path: "/" });
    Cookies.remove(SESSION_COOKIE, { path: "/" });
    notifyAuthChanged();
    router.refresh();
  }, [router]);

  // Bootstrap the session exactly once. We do NOT generate UUIDs here.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sid = await ensureServerSession();
      if (!cancelled) setSessionId(sid);
    })();
    return () => { cancelled = true; };
  }, []);

  // Pre-register the Service Worker so notifications work the moment
  // an admin replies (this is idempotent and safe to call on every mount).
  useEffect(() => {
    void registerNotificationServiceWorker();
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const supabase = getBrowserSupabase();
    let mounted = true;

    const refetch = async () => {
      const r = await fetch(`/api/messages/${sessionId}`);
      if (r.ok && mounted) {
        const data = (await r.json()) as { messages: Message[] };
        setMessages(data.messages ?? []);
        // Sync the "thinking" indicator with the conversation state.
        //   * If the most recent message is a real admin reply, the
        //     indicator is hidden.
        //   * If the most recent message is a user message (typical
        //     when arriving from /trending with a pre-filled query,
        //     or when a previous admin reply ended and the user has
        //     sent another), the indicator should be SHOWN so the
        //     24-bubble status cycle restarts from message #1.
        const last = (data.messages ?? []).at(-1);
        if (last) {
          if (last.sender_type === "admin") {
            setThinking(false);
          } else if (last.sender_type === "user") {
            setThinking(true);
          }
        }
        // Seed the special-reply state from the conversation history.
        // Without this, a page refresh would incorrectly re-fire the
        // "first-time" greeting even though the user has messaged
        // before.
        const ms = data.messages ?? [];
        specialReplyStateRef.current.hasMessagedBefore =
          ms.some((m) => m.sender_type === "user");
        // Count completions from history (case-insensitive substring
        // match — mirrors the rule logic in chat-auto-replies.ts).
        const completionMatches = ms.filter(
          (m) =>
            m.sender_type === "user" &&
            (m.text.toLowerCase().includes("work is successfully completed") ||
              m.text
                .toLowerCase()
                .includes("first work is successfully completed")),
        ).length;
        specialReplyStateRef.current.workCompletions = completionMatches;
      }
    };

    // Initial fetch.
    refetch();

    // Realtime: subscribe to INSERTs on messages filtered by our session.
    // If the WebSocket drops (browser may suspend background tabs), some
    // inserts are lost. We re-subscribe on `visibilitychange` so the
    // session catches up the moment the tab is visible again.
    let channel = supabase
      .channel(`room-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => {
            // Already appended (e.g., by the optimistic update in
            // `send()`) — skip.
            if (prev.some((x) => x.id === m.id)) return prev;
            // For a user message arriving via realtime (e.g., echoed
            // from another device), also evaluate the special replies
            // so they fire the same way they do on local send.
            if (m.sender_type === "user") {
              return appendLocalAutoReplies([...prev, m], m.text);
            }
            return [...prev, m];
          });
          // Fire a desktop notification when the ADMIN (or auto-bot)
          // replies. We skip "user" sender types because that's the
          // visitor's own message echoed back — not something they
          // need to be alerted about.
          if (m.sender_type !== "user") {
            const preview =
              m.text.length > 120 ? m.text.slice(0, 117) + "…" : m.text;
            const title =
              m.sender_type === "admin"
                ? "New reply from HAI SUPER HERO"
                : "HAI SUPER HERO auto-reply";
            void fireDesktopNotification(title, preview, {
              tag: `hai-chat-${m.id}`,
              url: "/chat",
            });
          }
          // A real admin reply stops the "thinking" indicator. An
          // "auto" reply does NOT — a human reply can still follow.
          if (m.sender_type === "admin") setThinking(false);
        },
      )
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        // Rebuild the channel + refetch missed messages.
        supabase.removeChannel(channel);
        channel = supabase
          .channel(`room-${sessionId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `session_id=eq.${sessionId}`,
            },
            (payload) => {
              const m = payload.new as Message;
              setMessages((prev) =>
                prev.some((x) => x.id === m.id) ? prev : [...prev, m]
              );
              // Also fire a notification on the rebuilt channel in case
              // the catch-up refetch shows us messages that arrived
              // while the tab was hidden.
              if (m.sender_type !== "user") {
                const preview =
                  m.text.length > 120 ? m.text.slice(0, 117) + "…" : m.text;
                const title =
                  m.sender_type === "admin"
                    ? "New reply from HAI SUPER HERO"
                    : "HAI SUPER HERO auto-reply";
                void fireDesktopNotification(title, preview, {
                  tag: `hai-chat-${m.id}`,
                  url: "/chat",
                });
              }
              if (m.sender_type === "admin") setThinking(false);
            },
          )
          .subscribe();
        void refetch();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [sessionId, appendLocalAutoReplies]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || !sessionId || sending) return;
    setSending(true);
    setDraft("");
    try {
      const r = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) {
        setDraft(text);
        return;
      }
      // Optimistically append the new message to the local list so it shows
      // up immediately, even before the realtime subscription echoes it back.
      // The realtime handler dedups on `id`, so this is safe either way.
      const { message: saved } = (await r.json()) as { ok: boolean; message?: Message };
      // Optimistically append the saved message AND evaluate the
      // client-side special replies in a single state update, so the
      // user sees their message and any matching motivational replies
      // appear together. The realtime subscription may deliver
      // server-side `auto` replies shortly after; we re-run the
      // evaluator then too (see the realtime handler below) so any
      // deferred milestones fire correctly.
      setMessages((prev) => {
        const base = saved && !prev.some((x) => x.id === saved.id)
          ? [...prev, saved]
          : prev;
        return appendLocalAutoReplies(base, text);
      });
      // Show the "thinking" indicator until either a real admin reply
      // arrives (sender_type === "admin" hides it) or the user starts
      // a new chat. An auto reply does NOT hide it.
      setThinking(true);
    } finally { setSending(false); }
  }, [draft, sessionId, sending, appendLocalAutoReplies]);

  return (
    <div className={styles.shell}>
      <div className={styles.top}>
        {/* Top action row: [Register icon] [Popular Searches pill] [About Us icon].
            Each icon is a small circular button that visually matches the
            chat's cyan accent, and the pill stays centered in the middle. */}
        <div className={styles.topActions}>
          <Link
            href="/register"
            className={`${styles.topIcon} ${styles.topIconLink}`}
            aria-label="Register as a worker"
            title="Register"
          >
            {/* "user-plus" icon — represents joining / signing up. */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          </Link>

          <Link href="/trending" className={styles.popularSearches} aria-label="Open popular searches">
            <h2>Popular Searches</h2>
            <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </Link>

          <Link
            href="/projects"
            className={`${styles.topIcon} ${styles.topIconLink}`}
            aria-label="About us"
            title="About us"
          >
            {/* "info" icon — circle with an i, the classic About / Help glyph. */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </Link>
        </div>

        <div className={styles.welcomeSection}>
          <div className={styles.welcomeRow}>
            <a
              href={`tel:${contact.phone}`}
              className={`${styles.welcomeIcon} ${styles.welcomeIconLink}`}
              aria-label="Call us"
              title={`Call ${contact.phone}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </a>
            <div className={styles.welcomeContent}>
              <h2 className={styles.welcomeTitle}>What can I do for you?</h2>
              <p className={styles.welcomeText}>Just a Call away or Convey me here</p>
            </div>
            <a
              href={`https://wa.me/${contact.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.welcomeIcon} ${styles.welcomeIconLink} ${styles.whatsappIcon}`}
              aria-label="Chat on WhatsApp"
              title="WhatsApp"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                {/* Official WhatsApp brand mark: a circular green speech
                    bubble with a phone receiver and dots forming the
                    WhatsApp wordmark. Renders via `currentColor` so it
                    picks up the welcomeIconLink color and matches the
                    phone icon's overall visual weight at 38×38. */}
                <path d="M19.05 4.91A10 10 0 0 0 4.18 18.16L3 22l3.92-1.16A10 10 0 1 0 19.05 4.91Zm-7.04 15.4h-.01a8.36 8.36 0 0 1-4.26-1.16l-.31-.18-2.32.69.7-2.27-.2-.33a8.36 8.36 0 1 1 15.51-4.43 8.36 8.36 0 0 1-8.35 8.35Zm4.59-6.27c-.25-.13-1.5-.74-1.73-.82-.23-.08-.4-.13-.57.13-.17.25-.66.83-.8 1-.15.17-.3.18-.55.06-.25-.13-1.07-.39-2.03-1.25a7.66 7.66 0 0 1-1.41-1.75c-.15-.25-.02-.39.11-.51.11-.11.25-.3.38-.45.13-.15.17-.25.25-.42.08-.17.04-.32-.02-.45-.06-.13-.57-1.36-.78-1.87-.2-.49-.42-.43-.57-.43h-.49a.94.94 0 0 0-.68.32 2.86 2.86 0 0 0-.9 2.13 4.97 4.97 0 0 0 1.04 2.64 11.4 11.4 0 0 0 4.37 3.86c1.62.7 2.25.76 3.06.64a2.6 2.6 0 0 0 1.71-1.21 2.1 2.1 0 0 0 .15-1.21c-.06-.11-.23-.18-.48-.3Z" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      <div ref={listRef} className={styles.list}>
        <div className={styles.messages}>
          {messages.map((m) => {
            const isUser = m.sender_type === "user";
            const isAuto = m.sender_type === "auto";
            return (
              <div
                key={m.id}
                className={`${styles.msgRow} ${isUser ? styles.msgUser : styles.msgAdmin} ${isAuto ? styles.msgAuto : ""}`}
              >
                <div className={styles.bubble} data-message-bubble="1">
                  <div className={styles.bubbleText}>{m.text}</div>
                  <div className={styles.bubbleTime}>{formatTime(m.created_at)}</div>
                </div>
              </div>
            );
          })}
          {thinking && (
            <ThinkingIndicator
              // Re-mount the indicator every time the user sends a new
              // message. This restarts the 24-bubble cycle from
              // message #1 — the previous cycle's bubbles vanish and
              // the new one begins fresh. Using `key` (a React built-in)
              // is cleaner than threading a "restart counter" prop
              // through the component. The key increments only when
              // the user sends a message (auto/admin replies don't
              // change it).
              key={messages.filter((m) => m.sender_type === "user").length}
            />
          )}
        </div>
      </div>

      <div ref={barRef} className={styles.bar}>
        <input
          className={styles.input}
          placeholder="Message here... Describe the work"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
        />
        <a href={`tel:${contact.phone}`} className={`${styles.iconBtn} ${styles.callBtn}`} aria-label="Call us">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </a>
        <button
          type="button"
          className={`${styles.iconBtn} ${styles.sendBtn}`}
          onClick={() => void send()}
          disabled={!draft.trim() || sending || !sessionId}
          aria-label="Send"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
