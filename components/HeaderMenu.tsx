"use client";

// HeaderMenu
//
// Reusable ⋮ dropdown menu for the chat header. Replicates the reference
// HTML's #headerMenu exactly:
//   * New chat            — confirm + clear local message list
//   * History             — placeholder alert (feature coming soon)
//   * Search in chat      — prompt + outline matching bubbles
//   * Chat theme          — light / dark toggle on a parent data-attr
//   * Clear chat          — confirm + clear local message list
//   * Add shortcut        — navigator.share when supported, instructions otherwise
//   * Export chat         — download as .txt
//
// `unread` controls a small notification dot on the menu icon. The
// menu closes on click-outside (document-level listener attached while
// open).

import { useEffect, useRef, useState } from "react";
import styles from "./HeaderMenu.module.css";

interface MessageLike {
  id: string;
  text: string;
  created_at: string;
}

interface Props {
  /** Messages in the current chat. Used by Search + Export. */
  messages: MessageLike[];
  /** Clear the chat (local list wiped; server stream will continue). */
  onClearChat: () => void;
  /** Start a fresh chat: clear local list and ask the parent to start
   *  a new session (used by the "New chat" item). */
  onNewChat: () => void;
  /** Toggle light / dark theme on the chat shell. */
  onToggleTheme: () => void;
  /** Whether a notification dot should be shown on the menu icon. */
  unread?: boolean;
}

export function HeaderMenu({ messages, onClearChat, onNewChat, onToggleTheme, unread }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  function close() { setOpen(false); }

  function handleNewChat() {
    close();
    if (window.confirm("Start a new chat? Current messages will be cleared from this view.")) {
      onNewChat();
    }
  }

  function handleHistory() {
    close();
    window.alert("Chat History\n\n(Coming soon — previous conversations will appear here.)");
  }

  function handleSearch() {
    close();
    const term = window.prompt("Search messages for:");
    if (!term || !term.trim()) return;
    const lower = term.toLowerCase();
    const list = document.querySelectorAll<HTMLElement>("[data-message-bubble='1']");
    let found = 0;
    list.forEach((el) => {
      if ((el.textContent ?? "").toLowerCase().includes(lower)) {
        el.style.outline = "2px solid #00e5ff";
        found++;
        window.setTimeout(() => { el.style.outline = ""; }, 3000);
      }
    });
    if (found === 0) {
      window.alert(`No messages found for "${term}"`);
    } else {
      const first = document.querySelector<HTMLElement>("[data-message-bubble='1'][style*='outline']");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function handleTheme() {
    close();
    onToggleTheme();
  }

  function handleClear() {
    close();
    if (window.confirm("Clear all messages from this chat view?")) {
      onClearChat();
    }
  }

  function handleShortcut() {
    close();
    const nav = (navigator as Navigator & { share?: (data: { title: string; text: string; url: string }) => Promise<void> });
    if (typeof nav.share === "function") {
      nav.share({
        title: "HAI SUPER HERO",
        text: "Chat with HI [Human Intelligence]",
        url: window.location.href,
      }).catch(() => {});
    } else {
      window.alert(
        "To add a shortcut:\n• On mobile: Use browser menu → Add to Home Screen\n• On desktop: Bookmark this page (Ctrl/Cmd + D)",
      );
    }
  }

  function handleExport() {
    close();
    if (messages.length === 0) {
      window.alert("No messages to export.");
      return;
    }
    let text = "HAI SUPER HERO Chat Export\n" + new Date().toLocaleString() + "\n" + "=".repeat(40) + "\n\n";
    messages.forEach((m) => {
      const time = new Date(m.created_at).toLocaleString();
      text += `[${time}] ${m.text}\n\n`;
    });
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hai-superhero-chat-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label="Chat options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
        {unread && <span className={styles.badge} aria-label="You have notifications" />}
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          <button type="button" role="menuitem" className={styles.item} onClick={handleNewChat}>
            <span className={styles.icon} aria-hidden>+</span> New chat
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={handleHistory}>
            <span className={styles.icon} aria-hidden>↻</span> History
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={handleSearch}>
            <span className={styles.icon} aria-hidden>🔍</span> Search in chat
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={handleTheme}>
            <span className={styles.icon} aria-hidden>◐</span> Chat theme
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={handleClear}>
            <span className={styles.icon} aria-hidden>✕</span> Clear chat
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={handleShortcut}>
            <span className={styles.icon} aria-hidden>★</span> Add shortcut
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={handleExport}>
            <span className={styles.icon} aria-hidden>↥</span> Export chat
          </button>
        </div>
      )}
    </div>
  );
}