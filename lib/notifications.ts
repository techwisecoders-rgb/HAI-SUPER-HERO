// Clickable browser/OS notification helpers used by both the visitor
// chat page and the admin dashboard.
//
// What this gives us:
//   * When a new chat message arrives and the recipient's tab is NOT
//     in focus, an OS-level desktop pop-up is fired (the kind Chrome /
//     Edge / Safari show at the corner of the screen).
//   * Clicking that pop-up focuses the tab and navigates to the
//     chat / admin page.
//   * The pop-up is delivered via a Service Worker so it still works
//     when the originating tab is in the background.
//
// Permission model:
//   * We never auto-request permission from JS — that's intrusive.
//   * Visitors see an "Enable notifications" button in the in-app menu
//     and explicitly opt in (which triggers the browser's permission
//     dialog). Admins get the same in their dashboard.
//
// No third-party push service (OneSignal, Firebase, etc.) is used —
// the chat already runs on Supabase Realtime, so we just fire the
// notification from the client the moment a new row lands on the
// messages table.

/** Whether the current browser tab is in the foreground / visible. */
export function isTabVisible(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

/** Current notification permission state, or "unsupported" if the API doesn't exist. */
export function getNotificationPermission():
  | NotificationPermission
  | "unsupported" {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/**
 * Ask the user for desktop-notification permission. Safe to call
 * multiple times — returns the existing permission if it's already
 * been decided.
 */
export async function requestNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window)) return "unsupported";
  if (
    Notification.permission === "granted" ||
    Notification.permission === "denied"
  ) {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

// ---------- Service Worker registration ----------

let _swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null =
  null;

/**
 * Register the Service Worker that displays notifications.
 * The SW file lives at /sw.js (public/sw.js). If registration fails
 * (e.g. plain-HTTP dev environment without HTTPS), we silently fall
 * back to in-page notifications only.
 */
export function registerNotificationServiceWorker(): Promise<
  ServiceWorkerRegistration | null
> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);
  if (_swRegistrationPromise) return _swRegistrationPromise;
  _swRegistrationPromise = navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((reg) => reg)
    .catch(() => null);
  return _swRegistrationPromise;
}

/**
 * Fire a clickable desktop notification.
 *
 * Strategy:
 *   - If a Service Worker is registered AND we have permission, show
 *     the notification via `registration.showNotification()` so the
 *     click handler in sw.js can focus / navigate the window even if
 *     the tab is closed.
 *   - Otherwise fall back to the plain `new Notification(...)` API
 *     (still gives a clickable pop-up while the page is loaded).
 *   - If permission is denied or the API is missing, no-op.
 *
 * The notification is suppressed if the tab is currently visible
 * (the user can already see the chat) — pass `force: true` to override.
 */
export async function fireDesktopNotification(
  title: string,
  body: string,
  opts: {
    tag?: string;
    icon?: string;
    badge?: string;
    url?: string; // where to navigate when clicked
    force?: boolean;
  } = {},
) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!opts.force && isTabVisible()) return;

  const target = opts.url ?? "/chat";
  const fullUrl =
    typeof location !== "undefined"
      ? new URL(target, location.origin).toString()
      : target;

  // Preferred path: Service Worker (works even when tab is closed).
  try {
    const reg = await registerNotificationServiceWorker();
    if (reg) {
      await reg.showNotification(title, {
        body,
        tag: opts.tag,
        icon: opts.icon ?? "/icon.svg",
        badge: opts.badge ?? "/icon.svg",
        requireInteraction: false,
        data: { url: fullUrl },
      });
      return;
    }
  } catch {
    // fall through to plain Notification API
  }

  // Fallback: plain Notification. Click focuses the tab if it's open.
  try {
    const n = new Notification(title, {
      body,
      tag: opts.tag,
      icon: opts.icon ?? "/icon.svg",
    });
    n.onclick = () => {
      try {
        window.focus();
      } catch {
        /* ignore */
      }
      try {
        location.href = fullUrl;
      } catch {
        /* ignore */
      }
      n.close();
    };
  } catch {
    // ignore — OS may have blocked
  }
}

