// (Continuation of /admin/page.tsx — render block lives here to keep file size
//  under the editor's chunk limit. It is imported and rendered at the bottom of
//  page.tsx; both are colocated for readability.)
"use client";

import { useEffect, useState, type ReactNode } from "react";
import styles from "./admin.module.css";
import type { Message, Project, ProjectPersonType, Session } from "@/types";
import { NotificationBell } from "@/components/NotificationBell";
import {
  listProjectsAction,
  createProjectAction,
  updateProjectAction,
  deleteProjectAction,
} from "./actions";

type SessionWithLast = Session & {
  last_message: Message | null;
  unread_count?: number;
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
  onNavigate?: (section: "conversations" | "workers" | "businesses") => void;
  /** Optional extra controls rendered in the sidebar header. */
  telegramNode?: ReactNode;
}) {
  const {
    sessions, activeId, setActiveId, messages, query, setQuery,
    draft, setDraft, send, sending, loadingList, active, error,
    tabVisible, onNavigate, telegramNode,
  } = props;

  const totalUnread = sessions.reduce((sum, s) => sum + (s.unread_count ?? 0), 0);

  const [activeTab, setActiveTab] = useState<"chat" | "projects">("chat");
  const [projects, setProjects] = useState<Project[]>([]);
  const [personType, setPersonType] = useState<ProjectPersonType | "">("");
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [addForm, setAddForm] = useState({
    title: "",
    description: "",
    image_url: "",
    url: "",
    person_type: "users" as ProjectPersonType,
  });
  const [editForm, setEditForm] = useState<{
    title: string;
    description: string;
    image_url: string;
    url: string;
    person_type: ProjectPersonType;
  } | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const handleAddProject = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setFormBusy(true);
    try {
      const { createProjectAction } = await import("./actions");
      await createProjectAction({
        title: addForm.title,
        description: addForm.description || null,
        image_url: addForm.image_url,
        url: addForm.url,
        person_type: addForm.person_type,
      });
      setFormSuccess(`Project "${addForm.title}" created successfully.`);
      setAddForm({
        title: "",
        description: "",
        image_url: "",
        url: "",
        person_type: "users",
      });
      setPersonType("");
      await listProjectsAction();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not create project.");
    } finally {
      setFormBusy(false);
    }
  };

  const handleEditProject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingProject) return;
    setFormError(null);
    setFormBusy(true);
    try {
      const { updateProjectAction } = await import("./actions");
      await updateProjectAction(editingProject.id, {
        title: editForm!.title,
        description: editForm!.description || null,
        image_url: editForm!.image_url,
        url: editForm!.url,
        person_type: editForm!.person_type,
      });
      setFormSuccess(`Project "${editForm!.title}" updated successfully.`);
      setEditingProject(null);
      setEditForm(null);
      setPersonType("");
      await listProjectsAction();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not update project.");
    } finally {
      setFormBusy(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm("Are you sure you want to delete this project?")) return;
    try {
      const { deleteProjectAction } = await import("./actions");
      await deleteProjectAction(id);
      await listProjectsAction();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not delete project.");
    }
  };

  useEffect(() => {
    if (activeTab !== "projects" || !personType) return;
    void (async () => {
      setProjectsLoading(true);
      try {
        const data = await listProjectsAction(personType || undefined);
        setProjects(data);
      } catch {
        setProjects([]);
      } finally {
        setProjectsLoading(false);
      }
    })();
  }, [activeTab, personType]);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarTitle}>
            SESSIONS
            {totalUnread > 0 && (
              <span className={styles.totalBadge} aria-label={`${totalUnread} unread messages`}>
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <NotificationBell />
            {telegramNode}
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
                  {(s.unread_count ?? 0) > 0 ? (
                    <span
                      className={styles.unreadCount}
                      aria-label={`${s.unread_count} unread`}
                    >
                      {(s.unread_count ?? 0) > 9 ? "9+" : s.unread_count}
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
          <div className={styles.mainHeaderActions}>
            <div className={styles.filterTabs} role="tablist" aria-label="Console views">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "chat"}
                className={`${styles.filterTab} ${activeTab === "chat" ? styles.filterTabActive : ""}`}
                onClick={() => setActiveTab("chat")}
              >
                Chat
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "projects"}
                className={`${styles.filterTab} ${activeTab === "projects" ? styles.filterTabActive : ""}`}
                onClick={() => setActiveTab("projects")}
              >
                Projects
              </button>
            </div>
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

      {activeTab === "projects" && (
        <div className={styles.projectsContent}>
          <div className={styles.projectsHeader}>
            <h2 className={styles.mainTitle}>Projects</h2>
            <button
              type="button"
              className={styles.addButton}
              onClick={() => { setFormError(null); setFormSuccess(null); setAddModalOpen(true); }}
            >
              + Add New Project
            </button>
          </div>

          <div className={styles.filterTabs}>
            {([
              { key: "" as ProjectPersonType | "", label: "All" },
              { key: "users" as ProjectPersonType, label: "Users" },
              { key: "businesses" as ProjectPersonType, label: "Businesses" },
              { key: "workers" as ProjectPersonType, label: "Workers" },
            ]).map((tab) => (
              <button
                key={tab.label}
                type="button"
                className={`${styles.filterTab} ${personType === tab.key ? styles.filterTabActive : ""}`}
                onClick={() => { setPersonType(tab.key); setEditingProject(null); setEditForm(null); }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {projectsLoading ? (
            <p className={styles.loadingText}>Loading projects…</p>
          ) : projects.length === 0 ? (
            <p className={styles.emptyText}>
              No projects found. Click &quot;+ Add New Project&quot; to create one.
            </p>
          ) : (
            <div className={styles.projectGrid}>
              {projects.map((p) => (
                <div key={p.id} className={styles.projectCard}>
                  <div className={styles.cardImageWrap}>
                    <img src={p.image_url} alt={p.title} />
                    <span className={styles.cardTag}>{p.person_type}</span>
                  </div>
                  <div className={styles.cardBody}>
                    <h3 className={styles.cardTitle}>{p.title}</h3>
                    {p.description && <p className={styles.cardDesc}>{p.description}</p>}
                    <div className={styles.cardActions}>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreference"
                        className={styles.openLinkBtn}
                      >
                        🔗 Open URL
                      </a>
                      <button
                        type="button"
                        className={styles.editBtn}
                        onClick={() => {
                          setEditingProject(p);
                          setFormError(null);
                          setFormSuccess(null);
                          setAddModalOpen(false);
                          setEditForm({
                            title: p.title,
                            description: p.description ?? "",
                            image_url: p.image_url,
                            url: p.url,
                            person_type: (p.person_type ?? "users") as ProjectPersonType,
                          });
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => handleDeleteProject(p.id)}
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
