// HAI SUPER HERO — Service Worker for clickable push notifications.
//
// This file lives at /sw.js (public/sw.js so Next.js serves it at the
// site root). It is registered by lib/notifications.ts via
// navigator.serviceWorker.register("/sw.js").
//
// Responsibilities:
//   1. Receive `showNotification()` calls from the client and display
//      them as OS-level desktop pop-ups (these work even when the
//      originating tab is in the background or minimized).
//   2. Handle `notificationclick` events: focus the existing chat /
//      admin window if one is open, or open a new one, then navigate
//      to the URL carried in `event.notification.data.url`.
//   3. Skip waiting / take control of clients immediately so the first
//      `register()` call after page load is effective right away.
//
// We intentionally do NOT implement background push (the
// `pushsubscriptionchange` / `push` event handlers) — there is no
// remote push service configured, and the chat already runs on
// Supabase Realtime, so the client is always online when a message
// is sent. The SW only exists so notifications can be displayed
// while the tab is backgrounded.

self.addEventListener("install", (event) => {
  // Activate the new worker as soon as it finishes installing.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  // Take control of all open clients so we can intercept their first
  // showNotification() call without them needing to reload.
  event.waitUntil(self.clients.claim());
});

// Handle clicks on notifications we've shown.
// `event.notification.data.url` is set by lib/notifications.ts and
// points at the chat or admin page the user should land on.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/chat";

  event.waitUntil(
    (async () => {
      // Try to focus an existing tab on the same origin. If we find
      // one, navigate it to the target URL and bring it forward.
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        // Same-origin only — clients from other sites can't be navigated.
        if (new URL(client.url).origin !== self.location.origin) continue;
        try {
          await client.navigate(targetUrl);
          if ("focus" in client) return client.focus();
        } catch {
          /* fall through to openWindow */
        }
      }

      // No existing tab — open a fresh window.
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })(),
  );
});

// Optional: if the user closes the notification by clicking the X
// (not the body), nothing happens — by design.
