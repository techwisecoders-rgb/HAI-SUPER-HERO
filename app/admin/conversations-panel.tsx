"use client";

// The "Conversations" panel of the admin dashboard.
//
// This is the existing chat console that used to live directly in
// app/admin/page.tsx — the realtime session list, the message thread and
// the composer are unchanged. It was moved into its own component so the
// dashboard shell can switch between conversations, workers and businesses.

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import {
  listSessionsAction,
  getMessagesAction,
  sendAdminMessageAction,
  markSessionReadAction,
} from "./actions";
import type { Message, Session } from "@/types";
import {
  fireDesktopNotification,
  isTabVisible,
  registerNotificationServiceWorker,
} from "@/lib/notifications";
import { AdminView } from "./render";

type SessionWithLast = Session & {
  last_message: Message | null;
  unread_count: number;
};

export function ConversationsPanel({
  onNavigate,
}: {
  onNavigate: (section: "conversations" | "workers" | "businesses") => void;
}) {
  const [sessions, setSessions] = useState<SessionWithLast[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingList, startList] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // "idle" | "sending" | "ok" | "error" — state of the Telegram test button.
  const [telegramState, setTelegramState] = useState<
    "idle" | "sending" | "ok" | "error"
  >("idle");
  const [telegramMessage, setTelegramMessage] = useState<string | null>(null);

  // Refs for values the realtime listener needs but shouldn't trigger
  // re-subscribes on (activeId, query).
  const activeIdRef = useRef<string | null>(null);
  const queryRef = useRef<string>("");
  // Per-message "already notified" set so we don't fire the same
  // desktop notification twice if the realtime channel resubscribes.
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { queryRef.current = query; }, [query]);

  // Deep link: /admin?session=<uuid> opens that conversation straight
  // away. This is the URL the Telegram notification links to, so tapping
  // the notification lands on the exact thread that was messaged.
  useEffect(() => {
    try {
      const sid = new URLSearchParams(window.location.search).get("session");
      if (sid) setActiveId(sid);
    } catch {
      /* ignore — unreadable URL */
    }
  }, []);

  // Keep the URL in sync with the open conversation so the link can be
  // shared and a page refresh reopens the same thread.
  const selectSession = useCallback((id: string) => {
    setActiveId(id);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("session", id);
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* ignore — unreadable URL */
    }
  }, []);

  // Pre-register the Service Worker so notifications work the moment a
  // visitor sends a message.
  useEffect(() => {
    void registerNotificationServiceWorker();
  }, []);

  useEffect(() => {
    startList(async () => {
      try {
        const data = await listSessionsAction();
        setSessions(data as SessionWithLast[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "unknown error");
      }
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      startList(async () => {
        try {
          const data = await listSessionsAction(query);
          setSessions(data as SessionWithLast[]);
        } catch { /* ignore */ }
      });
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    const ch = supabase
      .channel("admin-sessions")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const m = payload.new as Message;
          // Fire a desktop notification for messages from a visitor
          // (sender_type === "user"). We dedupe by message id so a
          // resubscribe doesn't fire twice.
          if (m.sender_type === "user" && !notifiedRef.current.has(m.id)) {
            notifiedRef.current.add(m.id);
            // Look up the visitor's display name for a friendlier title.
            let name = "Visitor";
            try {
              const data = await listSessionsAction();
              const found = (data as SessionWithLast[]).find((s) => s.id === m.session_id);
              if (found?.display_name) name = found.display_name;
            } catch {
              /* ignore — fall back to "Visitor" */
            }
            const preview =
              m.text.length > 120 ? m.text.slice(0, 117) + "…" : m.text;
            // Force-fire even when the tab is visible if the admin is
            // looking at a DIFFERENT session — the desktop pop-up is
            // what tells them to switch.
            void fireDesktopNotification(
              `New message from ${name}`,
              preview,
              {
                tag: `hai-admin-${m.id}`,
                force: activeIdRef.current !== m.session_id,
                url: `/admin?session=${m.session_id}`,
              },
            );
          }
          // Always refresh the sidebar so unread counters update.
          startList(async () => {
            try {
              const data = await listSessionsAction(queryRef.current);
              setSessions(data as SessionWithLast[]);
            } catch { /* ignore */ }
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const data = (await getMessagesAction(activeId)) as Message[];
        if (!cancelled) setMessages(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "unknown error");
      }
    })();
    // Mark as read on open so the unread counter drops immediately.
    // (Sending a reply also marks-as-read — see sendAdminMessageAction.)
    void markSessionReadAction(activeId).catch(() => { /* ignore */ });
    // Also bump the sidebar's unread counts locally without waiting
    // for the realtime listener to round-trip.
    setSessions((prev) =>
      prev.map((s) => (s.id === activeId ? { ...s, unread_count: 0 } : s)),
    );

    const supabase = getBrowserSupabase();
    const ch = supabase
      .channel(`admin-thread-${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `session_id=eq.${activeId}`,
        },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [activeId]);

  const active = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId],
  );

  // Surface tab visibility to the AdminView (purely informational —
  // the realtime handler uses its own check via isTabVisible()).
  const tabVisible = typeof document !== "undefined" ? isTabVisible() : true;

  const send = async () => {
    if (!activeId || !draft.trim() || sending) return;
    const text = draft.trim();
    setSending(true);
    // Optimistic append: show the message immediately so the admin
    // gets instant feedback, even if the realtime echo is slow or
    // blocked by a network/firewall. We tag it with a temporary
    // `__pending: true` flag so we can replace it when the server
    // returns the real row, and de-duplicate by text if realtime
    // does echo it back.
    const tempId = `tmp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        session_id: activeId,
        sender_type: "admin",
        admin_id: null,
        text,
        created_at: new Date().toISOString(),
      } as unknown as Message,
    ]);
    setDraft("");
    try {
      const saved = (await sendAdminMessageAction({ sessionId: activeId, text })) as
        | { ok: true; message?: Message }
        | { ok: true };
      // After the server confirms, refresh the thread from the DB so
      // both the admin's local bubble and any queued realtime echoes
      // are reconciled with the canonical row.
      try {
        const fresh = (await getMessagesAction(activeId)) as Message[];
        setMessages(fresh);
      } catch {
        // ignore — realtime will eventually deliver
      }
      // Also nudge the session list so the "last_message" preview
      // updates for the sidebar.
      startList(async () => {
        try {
          const data = await listSessionsAction(query);
          setSessions(data as SessionWithLast[]);
        } catch { /* ignore */ }
      });
    } catch (e) {
      // Remove the optimistic message if the server call failed.
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(text); // restore the draft so the admin can retry
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setSending(false);
    }
  };

  // Send a test notification to the configured Telegram chat so the team
  // can confirm the wiring without reading the server logs.
  const sendTelegramTest = async () => {
    if (telegramState === "sending") return;
    setTelegramState("sending");
    setTelegramMessage(null);
    try {
      const res = await fetch("/api/admin/telegram/test", { method: "POST" });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        setTelegramState("error");
        setTelegramMessage(data?.error ?? "Telegram test failed");
        return;
      }
      setTelegramState("ok");
      setTelegramMessage("Sent — check Telegram");
    } catch {
      setTelegramState("error");
      setTelegramMessage("Telegram test failed");
    } finally {
      window.setTimeout(() => setTelegramState("idle"), 4000);
    }
  };

  return (
    <AdminView
      sessions={sessions}
      activeId={activeId}
      setActiveId={selectSession}
      messages={messages}
      query={query}
      setQuery={setQuery}
      draft={draft}
      setDraft={setDraft}
      send={send}
      sending={sending}
      loadingList={loadingList}
      active={active}
      error={error}
      tabVisible={tabVisible}
      onNavigate={onNavigate}
      telegramNode={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <button
            type="button"
            onClick={() => void sendTelegramTest()}
            disabled={telegramState === "sending"}
            title="Send a test Telegram notification"
            aria-label="Send a test Telegram notification"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "transparent",
              color:
                telegramState === "error"
                  ? "#f87171"
                  : telegramState === "ok"
                    ? "#4ade80"
                    : "#9ca3af",
              cursor: telegramState === "sending" ? "wait" : "pointer",
            }}
          >
            <svg
              viewBox="0 0 16 16"
              width="13"
              height="13"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-1.285-.24-1.977-1.06-2.456-1.9a4.027 4.027 0 0 1-.418-1.378c-.006-.42.126-.8.442-1.13.173-.224.398-.343.542-.343.135 0 .27.073.383.2.133.148.368.48.541.74.186.28.349.545.478.71.15.19.312.27.437.263.107-.004.43-.087.648-.36.214-.27.9-1.093 1.12-1.229.045-.028.076-.042.104-.042.028 0 .056.014.077.038.021.024.1.096.1.096z" />
            </svg>
          </button>
          {telegramMessage && (
            <span
              style={{
                fontSize: 10,
                whiteSpace: "nowrap",
                color: telegramState === "error" ? "#f87171" : "#4ade80",
              }}
            >
              {telegramMessage}
            </span>
          )}
        </span>
      }
    />
  );
}

