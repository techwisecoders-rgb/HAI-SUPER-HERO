"use client";

// NotificationBell
//
// A small button + dropdown that shows the current browser
// notification permission state and lets the user opt in / out.
//
// Why this exists:
//   * Browsers require notifications to be triggered by a USER
//     GESTURE — we can't silently call Notification.requestPermission()
//     on page load.
//   * Once granted, notifications fire automatically from
//     lib/notifications.ts whenever a new message arrives and the tab
//     is in the background.
//   * Once denied, the button reflects that and offers no re-prompt
//     (the user has to change it in their browser settings).
//
// Used by:
//   * /chat — in the HeaderMenu (visitor's chat page)
//   * /admin — in the admin sidebar (admin dashboard)

import { useEffect, useState } from "react";
import {
  getNotificationPermission,
  registerNotificationServiceWorker,
  requestNotificationPermission,
} from "@/lib/notifications";
import styles from "./NotificationBell.module.css";

type Perm = NotificationPermission | "unsupported";

export function NotificationBell() {
  const [perm, setPerm] = useState<Perm>("default");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPerm(getNotificationPermission());
  }, []);

  // Pre-register the Service Worker as soon as the bell mounts so that
  // by the time a message arrives the SW is in place to display it.
  useEffect(() => {
    void registerNotificationServiceWorker();
  }, []);

  async function handleClick() {
    if (perm === "unsupported") return;
    if (perm === "granted") {
      // Already on — nothing to do. Could optionally clear subscription
      // here in a real push setup, but for our model there's no
      // subscription to clear.
      return;
    }
    if (perm === "denied") {
      window.alert(
        "Notifications are blocked in your browser settings.\n\nTo enable them, click the lock / info icon in the address bar and allow notifications for this site.",
      );
      return;
    }
    setBusy(true);
    try {
      const next = await requestNotificationPermission();
      setPerm(next);
      // Fire a single test notification right after the user grants
      // permission so they can see what it looks like. We force-fire
      // (opts.force) because their tab IS visible.
      if (next === "granted") {
        const { fireDesktopNotification } = await import("@/lib/notifications");
        void fireDesktopNotification(
          "Notifications enabled",
          "You'll now get a desktop alert whenever there's a new message.",
          { tag: "hai-notif-test", force: true, url: "/" },
        );
      }
    } finally {
      setBusy(false);
    }
  }

  if (perm === "unsupported") return null;

  const label =
    perm === "granted"
      ? "Notifications on"
      : perm === "denied"
        ? "Notifications blocked"
        : "Enable notifications";
  const dotClass =
    perm === "granted"
      ? styles.dotOn
      : perm === "denied"
        ? styles.dotOff
        : styles.dotIdle;

  return (
    <button
      type="button"
      className={styles.bell}
      onClick={handleClick}
      disabled={busy || perm === "granted"}
      title={label}
      aria-label={label}
    >
      <span className={`${styles.dot} ${dotClass}`} aria-hidden />
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      <span className={styles.label}>{label}</span>
    </button>
  );
}
