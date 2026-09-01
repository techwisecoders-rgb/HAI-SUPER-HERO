// (Continuation of /admin/page.tsx — render block lives here to keep file size
//  under the editor's chunk limit. It is imported and rendered at the bottom of
//  page.tsx; both are colocated for readability.)
"use client";

import styles from "./admin.module.css";
import type { Message, Session } from "@/types";

type SessionWithLast = Session & { last_message: Message | null };

export function AdminView(props: {
  sessions: SessionWithLast[];
  activeId: string | null;
  setActiveId: (id: string) => void;
  messages: Message[];
  query: string;
  setQuery: (q: string) => void;
  draft: string;
  setDraft: (d: string) => void;
  send: () => void;
  sending: boolean;
  loadingList: boolean;
  active: SessionWithLast | null;
  error: string | null;
}) {
  const {
    sessions, activeId, setActiveId, messages, query, setQuery,
    draft, setDraft, send, sending, loadingList, active, error,
  } = props;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarTitle}>SESSIONS</span>
          <button
            type="button"
            className={styles.signOut}
            onClick={async () => {
              const { signOutAction } = await import("./actions");
              await signOutAction();
              window.location.href = "/admin/login";
            }}
          >
            Sign out
          </button>
        </div>
        <input
          className={styles.search}
          placeholder="Search messages…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className={styles.list}>
          {loadingList && sessions.length === 0 && <div className={styles.empty}>Loading…</div>}
          {!loadingList && sessions.length === 0 && (
            <div className={styles.empty}>
              No visitors yet. Open <code>/chat</code> in another tab to create a test session.
            </div>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`${styles.item} ${s.id === activeId ? styles.itemActive : ""}`}
              onClick={() => setActiveId(s.id)}
            >
              <div className={styles.itemTop}>
                <span className={styles.itemName}>
                  {(s.display_name || "Visitor").slice(0, 24)}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {!s.last_message && <span className={styles.unread} aria-label="no messages yet" />}
                  <span>{new Date(s.last_seen_at).toLocaleString()}</span>
                </span>
              </div>
              <div className={styles.itemPreview}>
                {s.last_message
                  ? `${s.last_message.sender_type === "admin" ? "You: " : ""}${s.last_message.text}`
                  : <em style={{ color: "rgba(255,255,255,0.4)" }}>No messages yet</em>}
              </div>
              {s.id === activeId && (
                <div className={styles.itemActiveTag}>● Active</div>
              )}
            </button>
          ))}
        </div>
      </aside>

      <section className={styles.main}>
        <header className={styles.mainHeader}>
          <div>
            <div className={styles.mainTitle}>
              {active ? (active.display_name || "Visitor") : "Admin Chat Console"}
            </div>
            {active ? (
              <div className={styles.mainSub}>
                last seen {new Date(active.last_seen_at).toLocaleString()} · {active.id.slice(0, 8)}…
              </div>
            ) : (
              <div className={styles.mainSub}>
                Pick a session from the left sidebar to start chatting.
              </div>
            )}
          </div>
        </header>

        <div className={styles.thread}>
          {activeId ? (
            messages.length === 0 ? (
              <div className={styles.empty}>No messages in this session yet.</div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    alignSelf: m.sender_type === "admin" ? "flex-end" : "flex-start",
                    maxWidth: "78%",
                    padding: "0.6rem 0.9rem",
                    borderRadius: "1.1rem",
                    lineHeight: 1.4,
                    fontSize: "0.95rem",
                    background:
                      m.sender_type === "admin"
                        ? "linear-gradient(135deg, #7a5cff, #ff6b9d)"
                        : "rgba(255,255,255,0.08)",
                    color: m.sender_type === "admin" ? "white" : "#f3f3f7",
                    border:
                      m.sender_type === "admin"
                        ? "none"
                        : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {m.text}
                </div>
              ))
            )
          ) : (
            <div className={styles.empty}>← Select a visitor to start chatting.</div>
          )}
        </div>

        {/* Composer is ALWAYS visible at the bottom of the main panel so
            the admin always has a visible "send" area. It's disabled
            until a session is selected and the draft is non-empty. */}
        <div className={styles.composer}>
          <input
            className={styles.composerInput}
            placeholder={
              activeId
                ? sending
                  ? "Sending…"
                  : "Reply as admin…"
                : "Select a session from the left to start chatting"
            }
            value={draft}
            disabled={!activeId || sending}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            type="button"
            className={styles.composerSend}
            onClick={() => void send()}
            disabled={!activeId || !draft.trim() || sending}
            aria-label="Send message"
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      </section>

      {error && (
        <div
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            background: "#1a0a14",
            border: "1px solid rgba(255,107,157,0.4)",
            color: "#ff6b9d",
            padding: "0.6rem 0.9rem",
            borderRadius: "0.6rem",
            fontSize: "0.85rem",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
