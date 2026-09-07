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

async function ensureServerSession(): Promise<string | null> {
  const existing = Cookies.get(SESSION_COOKIE);
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  try {
    const r = await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "bootstrap" }),
    });
    if (r.ok) {
      const { sessionId } = (await r.json()) as { sessionId?: string };
      if (sessionId) {
        Cookies.set(SESSION_COOKIE, sessionId, { expires: 365, sameSite: "lax", path: "/" });
        return sessionId;
      }
    }
  } catch {}
  return null;
}

export default function ChatClient() {
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
  const [contact, setContact] = useState<ContactSettings>({ phone: CONTACT.phone, whatsapp: CONTACT.whatsapp });
  const listRef = useRef<HTMLDivElement | null>(null);
  const barRef = useKeyboardAwareInput<HTMLDivElement>();
  const specialReplyStateRef = useRef<SpecialReplyState>({ hasMessagedBefore: false, workCompletions: 0 });

  useEffect(() => {
    if (params.get("new") === "1") setMessages([]);
  }, [params]);

  const appendLocalAutoReplies = useCallback(
    (list: Message[], userText: string): Message[] => {
      const replies = evaluateSpecialReplies(list, userText, specialReplyStateRef.current, new Date());
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
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const shell = document.querySelector(`.${styles.shell}`) as HTMLElement | null;
    const list = document.querySelector(`.${styles.list}`) as HTMLElement | null;
    if (!shell || !list) return;
    if (theme === "dark") {
      shell.style.background = "#1e2932";
      list.style.background = "#2b3540";
    } else {
      shell.style.background = "#f0f4f8";
      list.style.background = "#e8eef4";
    }
  }, [theme, messages.length]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore network errors
    }
    Cookies.remove(APP_USER_COOKIE, { path: "/" });
    Cookies.remove(APP_EMAIL_COOKIE, { path: "/" });
    Cookies.remove(SESSION_COOKIE, { path: "/" });
    notifyAuthChanged();
    router.refresh();
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sid = await ensureServerSession();
      if (!cancelled) setSessionId(sid);
    })();
    return () => { cancelled = true; };
  }, []);

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
        const last = (data.messages ?? []).at(-1);
        if (last) {
          if (last.sender_type === "admin") setThinking(false);
          else if (last.sender_type === "user") setThinking(true);
        }
        const ms = data.messages ?? [];
        specialReplyStateRef.current.hasMessagedBefore = ms.some((m) => m.sender_type === "user");
        const completionMatches = ms.filter(
          (m) => m.sender_type === "user" &&
            (m.text.toLowerCase().includes("work is successfully completed") ||
              m.text.toLowerCase().includes("first work is successfully completed")),
        ).length;
        specialReplyStateRef.current.workCompletions = completionMatches;
      }
    };

    refetch();

    let channel = supabase
      .channel(`room-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            if (m.sender_type === "user") return appendLocalAutoReplies([...prev, m], m.text);
            return [...prev, m];
          });
          if (m.sender_type !== "user") {
            const preview = m.text.length > 120 ? m.text.slice(0, 117) + "…" : m.text;
            const title = m.sender_type === "admin" ? "New reply from HAI SUPER HERO" : "HAI SUPER HERO auto-reply";
            void fireDesktopNotification(title, preview, { tag: `hai-chat-${m.id}`, url: "/chat" });
          }
          if (m.sender_type === "admin") setThinking(false);
        },
      )
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        supabase.removeChannel(channel);
        channel = supabase
          .channel(`room-${sessionId}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages", filter: `session_id=eq.${sessionId}` },
            (payload) => {
              const m = payload.new as Message;
              setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
              if (m.sender_type !== "user") {
                const preview = m.text.length > 120 ? m.text.slice(0, 117) + "…" : m.text;
                const title = m.sender_type === "admin" ? "New reply from HAI SUPER HERO" : "HAI SUPER HERO auto-reply";
                void fireDesktopNotification(title, preview, { tag: `hai-chat-${m.id}`, url: "/chat" });
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

  // ── Polling fallback ────────────────────────────────────────────────────
  //
  // Supabase Realtime relies on a WebSocket connection. In practice, those
  // connections get dropped or silently go stale in many real-world
  // scenarios: corporate proxies that strip `wss://`, browser background-tab
  // throttling, server-side RLS denying the realtime subscription, or a
  // long-lived tab that simply hasn't received a keepalive.
  //
  // In THIS project in particular, the `messages` table is locked down by
  // RLS — anon clients are explicitly denied SELECT on it (see
  // supabase/migrations/0001_schema.sql `messages_anon_select`). Realtime
  // applies the same row-level policies, so the browser realtime channel
  // receives NO INSERT events for anonymous visitors regardless of
  // WebSocket availability. The polling loop below is therefore the only
  // path that actually delivers new messages to the chat UI — realtime
  // is essentially a no-op here. We keep the realtime subscription
  // because it costs nothing and would "just work" if the RLS policy is
  // ever relaxed.
  //
  // To make the chat feel truly live, we run a polling loop. Every
  // POLL_MS we re-fetch the session's messages via the REST endpoint and
  // merge any new ones into local state. The poller is idempotent — if
  // realtime *does* deliver a message between polls, the dedup-by-id below
  // keeps state consistent.
  //
  // We poll regardless of tab visibility. Background tabs are throttled
  // by the browser anyway, and the realtime visibilitychange handler
  // still refetches when the tab comes back to the foreground, but the
  // extra background polling costs essentially nothing and means we
  // never have a "stuck" state where the interval was never installed
  // (e.g. if the page first mounted while hidden).
  const POLL_MS = 2000;

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const r = await fetch(`/api/messages/${sessionId}`);
        if (!r.ok || cancelled) return;
        const data = (await r.json()) as { messages: Message[] };
        if (cancelled) return;
        const fresh = data.messages ?? [];

        // Sync the "thinking" indicator with the latest message — same
        // logic as the realtime `refetch()` above. Without this, an admin
        // reply that arrived only via polling would leave the indicator
        // spinning even though the chat visually shows the reply.
        const last = fresh.at(-1);
        if (last) {
          if (last.sender_type === "admin") setThinking(false);
          else if (last.sender_type === "user") setThinking(true);
        }

        // Seed the special-reply state so first-time / completion
        // greetings don't re-fire after a polling refresh. Mirrors the
        // realtime-side seeding in `refetch()` above.
        specialReplyStateRef.current.hasMessagedBefore =
          fresh.some((m) => m.sender_type === "user");
        const completionMatches = fresh.filter(
          (m) => m.sender_type === "user" &&
            (m.text.toLowerCase().includes("work is successfully completed") ||
              m.text.toLowerCase().includes("first work is successfully completed")),
        ).length;
        specialReplyStateRef.current.workCompletions = completionMatches;

        setMessages((prev) => {
          // Merge by id: keep any locally-appended optimistic messages that
          // haven't yet echoed through the server, add any new ones from the
          // server response, and preserve original ordering by re-sorting on
          // created_at. If nothing actually changed, return `prev` unchanged
          // so React doesn't trigger an unnecessary re-render.
          const known = new Set(prev.map((m) => m.id));
          const additions = fresh.filter((m) => !known.has(m.id));
          if (additions.length === 0) return prev;
          const merged = [...prev, ...additions].sort((a, b) =>
            a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
          );
          return merged;
        });
      } catch {
        // Network blip — try again on the next tick. Don't surface an error
        // here: the user just sees a slightly stale view, which is the same
        // as if realtime were down.
      }
    };

    // Fire one immediate sync so the user doesn't have to wait POLL_MS for
    // the first refresh after mounting. Then start the interval.
    void poll();
    const id = window.setInterval(poll, POLL_MS);

    // When the tab comes back to the foreground, run an immediate poll.
    // setInterval is throttled in background tabs but keeps running, so
    // the user always gets up-to-date state the moment they look at the
    // chat again — without waiting for the next interval tick.
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sessionId]);

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
      const { message: saved } = (await r.json()) as { ok: boolean; message?: Message };
      setMessages((prev) => {
        const base = saved && !prev.some((x) => x.id === saved.id) ? [...prev, saved] : prev;
        return appendLocalAutoReplies(base, text);
      });
      setThinking(true);
    } finally {
      setSending(false);
    }
  }, [draft, sessionId, sending, appendLocalAutoReplies]);

  return (
    <div className={styles.shell}>
      <div className={styles.top}>
        <div className={styles.topActions}>
          <Link href="/register" className={`${styles.topIcon} ${styles.topIconLink}`} aria-label="Register as a worker" title="Register">
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

          <Link href="/projects" className={`${styles.topIcon} ${styles.topIconLink}`} aria-label="About us" title="About us">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </Link>
        </div>

        <div className={styles.welcomeSection}>
          <div className={styles.welcomeRow}>
            <a href={`tel:${contact.phone}`} className={`${styles.welcomeIcon} ${styles.welcomeIconLink}`} aria-label="Call us" title={`Call ${contact.phone}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </a>
            <div className={styles.welcomeContent}>
              <h2 className={styles.welcomeTitle}>What can I do for you?</h2>
              <p className={styles.welcomeText}>Just a Call away or Convey me here</p>
            </div>
            <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noopener noreferrer" className={`${styles.welcomeIcon} ${styles.welcomeIconLink} ${styles.whatsappIcon}`} aria-label="Chat on WhatsApp" title="WhatsApp">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M19.05 4.91A10 10 0 0 0 4.18 18.16L3 22l3.92-1.16A10 10 0 1 0 19.05 4.91Zm-7.04 15.4h-.01a8.36 8.36 0 0 1-4.26-1.16l-.31-.18-2.32.69.7-2.27-.2-.33a8.36 8.36 0 1 1 15.51-4.43 8.36 8.36 0 0 1-8.35 8.35Zm4.59-6.27c-.25-.13-1.5-.74-1.73-.82-.23-.08-.4-.13-.57.13-.17.25-.66.83-.8 1-.15.17-.3.18-.55.06-.25-.13-1.07-.39-2.03-1.25a7.66 7.66 0 0 1-1.41-1.75c-.15-.25-.02-.39.11-.51.11-.11.25-.3.38-.45.13-.15.17-.25.25-.42.08-.17.04-.32-.02-.45-.06-.13-.57-1.36-.78-1.87-.2-.49-.42-.43-.57-.43h-.49a.94.94 0 0 0-.68.32 2.86 2.86 0 0 0-.9 2.13 4.97 4.97 0 0 0 1.04 2.64 11.4 11.4 0 0 0 4.37 3.86c1.62.7 2.25.76 3.06.64a2.6 2.6 0 0 0 1.71-1.21 2.1 2.1 0 0 0 .15-1.21c-.06-.11-.13-.18-.38-.3Z" />
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
              <div key={m.id} className={`${styles.msgRow} ${isUser ? styles.msgUser : styles.msgAdmin} ${isAuto ? styles.msgAuto : ""}`}>
                <div className={styles.bubble} data-message-bubble="1">
                  <div className={styles.bubbleText}>{m.text}</div>
                  <div className={styles.bubbleTime}>{formatTime(m.created_at)}</div>
                </div>
              </div>
            );
          })}
          {thinking && (
            <ThinkingIndicator key={messages.filter((m) => m.sender_type === "user").length} />
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
        <button type="button" className={`${styles.iconBtn} ${styles.sendBtn}`} onClick={() => void send()} disabled={!draft.trim() || sending || !sessionId} aria-label="Send">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}