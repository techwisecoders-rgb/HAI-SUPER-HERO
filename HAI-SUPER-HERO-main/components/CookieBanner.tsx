"use client";

// Cookie consent banner.
// - The parent server component (app/page.tsx) is responsible for
//   NOT mounting this component when the user has already consented
//   (it reads the cookie via next/headers on the server). So when
//   this component mounts, we know the user is a first-time visitor.
// - On Accept: POST /api/session (action=accept), set a session_id
//   cookie, then (optionally) call onAccepted() so the host page
//   can navigate to the next step.
// - On Decline: POST /api/session (action=decline), no persistent
//   cookies. The banner just disappears in place.

import { useState } from "react";
import Cookies from "js-cookie";
import { SESSION_COOKIE } from "@/lib/cookies";

interface CookieBannerProps {
  /**
   * Called after the user clicks Accept and the session cookie is set.
   * Pass a function that navigates to your post-consent page.
   * If omitted, the banner just disappears in place.
   */
  onAccepted?: () => void;
}

export function CookieBanner({ onAccepted }: CookieBannerProps = {}) {
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const submit = async (action: "accept" | "decline") => {
    setBusy(true);
    try {
      const r = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (r.ok) {
        if (action === "accept") {
          const data = (await r.json()) as { sessionId?: string };
          if (data.sessionId) {
            // Mirror into js-cookie so the chat page sees it immediately
            // (the server also sets it via Set-Cookie, but js-cookie is
            // faster than waiting for the browser to apply the header).
            Cookies.set(SESSION_COOKIE, data.sessionId, {
              expires: 365,
              sameSite: "lax",
              path: "/",
            });
          }
          // Tiny delay so the user sees the "Saving…" → Accept state
          // settle before the page navigates away.
          if (onAccepted) {
            window.setTimeout(() => onAccepted(), 250);
          }
        }
        setDismissed(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-cyan-400/30 bg-[#0f172a]/95 p-4 shadow-2xl backdrop-blur md:left-1/2 md:max-w-md md:-translate-x-1/2">
      <h3 className="text-lg font-semibold text-cyan-400">A note about cookies</h3>
      <p className="mt-1 text-sm leading-relaxed text-white/80">
        We use a single small cookie to remember your chat session across visits
        so you can pick up where you left off. No tracking, no third parties. You
        can decline and the chat will still work — just without persistence.
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <a href="/privacy" className="text-xs text-cyan-400/80 underline-offset-2 hover:underline">
          Privacy policy
        </a>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => submit("decline")}
            className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:bg-white/5 disabled:opacity-50"
          >
            Decline
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => submit("accept")}
            className="rounded-full bg-gradient-to-r from-cyan-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Accept"}
          </button>
        </div>
      </div>
    </div>
  );
}
