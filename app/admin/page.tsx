"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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

export default function AdminHomePage() {
  const [sessions, setSessions] = useState<SessionWithLast[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingList, startList] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Refs for values the realtime listener needs but shouldn't trigger
  // re-subscribes on (activeId, query).
  const activeIdRef = useRef<string | null>(null);
  const queryRef = useRef<string>("");
  // Per-message "already notified" set so we don't fire the same
  // desktop notification twice if the realtime channel resubscribes.
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { queryRef.current = query; }, [query]);

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

  return (
    <AdminView
      sessions={sessions}
      activeId={activeId}
      setActiveId={setActiveId}
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
    />
  );
}
