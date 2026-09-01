"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useKeyboardAwareInput } from "@/lib/use-keyboard-aware-input";
import { SESSION_COOKIE, APP_USER_COOKIE, APP_EMAIL_COOKIE } from "@/lib/cookies";
import { useAuth, notifyAuthChanged } from "@/lib/use-auth";
import { CONTACT } from "@/content";
import type { Message } from "@/types";
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
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const barRef = useKeyboardAwareInput<HTMLDivElement>();
  const { email: authEmail } = useAuth();

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

  useEffect(() => {
    if (!sessionId) return;
    const supabase = getBrowserSupabase();
    let mounted = true;

    const refetch = async () => {
      const r = await fetch(`/api/messages/${sessionId}`);
      if (r.ok && mounted) {
        const data = (await r.json()) as { messages: Message[] };
        setMessages(data.messages ?? []);
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
          setMessages((prev) =>
            prev.some((x) => x.id === m.id) ? prev : [...prev, m]
          );
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
      // Optimistically append the new message to the local list so it shows
      // up immediately, even before the realtime subscription echoes it back.
      // The realtime handler dedups on `id`, so this is safe either way.
      const { message: saved } = (await r.json()) as { ok: boolean; message?: Message };
      if (saved) {
        setMessages((prev) => (prev.some((x) => x.id === saved.id) ? prev : [...prev, saved]));
      }
    } finally { setSending(false); }
  }, [draft, sessionId, sending]);

  return (
    <div className={styles.shell}>
      <div className={styles.top}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            {/* Top-left: Login button (or signed-in badge + Logout when authed). */}
            {authEmail ? (
              <div className={styles.headerAuthGroup}>
                <div
                  className={styles.headerUser}
                  title={authEmail}
                  aria-label={`Signed in as ${authEmail}`}
                >
                  <span className={styles.headerUserDot} aria-hidden />
                  <span className={styles.headerUserLabel}>{authEmail}</span>
                </div>
                <button
                  type="button"
                  className={styles.headerLogoutBtn}
                  onClick={() => void logout()}
                  aria-label="Log out"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={styles.headerLoginBtn}
                onClick={() => router.push("/auth")}
                aria-label="Login or register"
              >
                Login
              </button>
            )}

            <div className={styles.headerCenter}>
              <h1 className={styles.title}>HI [Human Intelligence]</h1>
              <p className={styles.subtitle}>We are not from AI, but HI, who created AI.</p>
            </div>
            <div className={styles.statusDot} aria-label="online" />
          </div>
        </header>

        <Link href="/trending" className={styles.popularSearches} aria-label="Open popular searches">
          <h2>Popular Searches</h2>
          <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </Link>

        <div className={styles.welcomeSection}>
          <div className={styles.welcomeRow}>
            <svg className={styles.welcomeIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <div className={styles.welcomeContent}>
              <h2 className={styles.welcomeTitle}>What can I do for you?</h2>
              <p className={styles.welcomeText}>Just a Call away or Convey me here</p>
            </div>
            <svg className={styles.welcomeIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
        </div>
      </div>

      <div ref={listRef} className={styles.list}>
        <div className={styles.messages}>
          {messages.map((m) => (
            <div
              key={m.id}
              className={`${styles.msgRow} ${m.sender_type === "user" ? styles.msgUser : styles.msgAdmin}`}
            >
              <div className={styles.bubble}>
                <div className={styles.bubbleText}>{m.text}</div>
                <div className={styles.bubbleTime}>{formatTime(m.created_at)}</div>
              </div>
            </div>
          ))}
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
        <a href={`tel:${CONTACT.phone}`} className={`${styles.iconBtn} ${styles.callBtn}`} aria-label="Call us">
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
