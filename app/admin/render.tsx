// (Continuation of /admin/page.tsx — render block lives here to keep file size
//  under the editor's chunk limit. It is imported and rendered at the bottom of
//  page.tsx; both are colocated for readability.)
"use client";

import { useState } from "react";
import styles from "./admin.module.css";
import type { Message, Session } from "@/types";
import { NotificationBell } from "@/components/NotificationBell";

type SessionWithLast = Session & {
  last_message: Message | null;
  unread_count: number;
};

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
  tabVisible: boolean;
}) {
  const {
    sessions, activeId, setActiveId, messages, query, setQuery,
    draft, setDraft, send, sending, loadingList, active, error,
    tabVisible,
  } = props;

  const totalUnread = sessions.reduce((sum, s) => sum + (s.unread_count ?? 0), 0);
  const [businessFormOpen, setBusinessFormOpen] = useState(false);
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessPassword, setBusinessPassword] = useState("");
  const [businessConfirmPassword, setBusinessConfirmPassword] = useState("");
  const [businessBusy, setBusinessBusy] = useState(false);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const [businessSuccess, setBusinessSuccess] = useState<string | null>(null);

  const submitBusinessRegistration = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusinessError(null);
    setBusinessSuccess(null);
    setBusinessBusy(true);
    try {
      const { createBusinessAction } = await import("./actions");
      const result = await createBusinessAction({
        email: businessEmail,
        password: businessPassword,
        confirmPassword: businessConfirmPassword,
      });
      setBusinessSuccess(`Business credentials created for ${result.email}.`);
      setBusinessEmail("");
      setBusinessPassword("");
      setBusinessConfirmPassword("");
    } catch (error) {
      setBusinessError(error instanceof Error ? error.message : "could not create business credentials");
    } finally {
      setBusinessBusy(false);
    }
  };

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarTitle}>
            SESSIONS
            {totalUnread > 0 && (
              <span
                className={styles.totalBadge}
                aria-label={`${totalUnread} unread messages`}
              >
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <NotificationBell />
            <button
              type="button"
              className={styles.registerBusinessButton}
              onClick={() => {
                setBusinessError(null);
                setBusinessSuccess(null);
                setBusinessFormOpen(true);
              }}
            >
              Register as business
            </button>
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
                  {s.unread_count > 0 ? (
                    <span
                      className={styles.unreadCount}
                      aria-label={`${s.unread_count} unread`}
                    >
                      {s.unread_count > 9 ? "9+" : s.unread_count}
                    </span>
                  ) : !s.last_message ? (
                    <span className={styles.unread} aria-label="no messages yet" />
                  ) : null}
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

      {businessFormOpen && (
        <div className={styles.modalBackdrop} role="presentation">
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="business-registration-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 id="business-registration-title" className={styles.modalTitle}>
                  Register as business
                </h2>
                <p className={styles.modalDescription}>
                  Create login credentials for a business owner. They will sign in at /business and create their profile there.
                </p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setBusinessFormOpen(false)}
                aria-label="Close business registration"
              >
                ×
              </button>
            </div>

            <form className={styles.businessForm} onSubmit={(event) => void submitBusinessRegistration(event)}>
              <label className={styles.businessField}>
                <span>Business email</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={businessEmail}
                  onChange={(event) => setBusinessEmail(event.target.value)}
                  className={styles.businessInput}
                  placeholder="owner@business.com"
                />
              </label>
              <label className={styles.businessField}>
                <span>Password</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={businessPassword}
                  onChange={(event) => setBusinessPassword(event.target.value)}
                  className={styles.businessInput}
                  placeholder="At least 6 characters"
                />
              </label>
              <label className={styles.businessField}>
                <span>Confirm password</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={businessConfirmPassword}
                  onChange={(event) => setBusinessConfirmPassword(event.target.value)}
                  className={styles.businessInput}
                  placeholder="Re-enter password"
                />
              </label>

              {businessError && <p className={styles.businessError}>{businessError}</p>}
              {businessSuccess && <p className={styles.businessSuccess}>{businessSuccess}</p>}

              <div className={styles.businessActions}>
                <button
                  type="button"
                  className={styles.businessCancel}
                  onClick={() => setBusinessFormOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type={businessSuccess ? "button" : "submit"}
                  disabled={businessBusy}
                  className={styles.businessSubmit}
                  onClick={businessSuccess ? () => setBusinessFormOpen(false) : undefined}
                >
                  {businessSuccess ? "Done" : businessBusy ? "Creating…" : "Create credentials"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

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
