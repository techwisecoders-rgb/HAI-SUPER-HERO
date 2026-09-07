// Server component wrapper for /chat.
//
// Since the previous landing page (which hosted the cookie consent banner)
// was removed, /chat now also owns the consent flow. The server reads the
// consent cookie via next/headers so:
//   - returning visitors (consent already given/declined) NEVER see the banner
//     flash before client hydration.
//   - first-time visitors see the cookie banner over a minimal backdrop.
//     Accepting the banner POSTs /api/session (action=accept) which sets the
//     session + consent cookies, then the banner calls onAccepted() which
//     triggers a `hai-consent-accepted` window event. ConsentRefresh (a
//     client component) listens for that event and calls router.refresh(),
//     causing this server component to re-evaluate the cookie and render
//     the real chat UI.
//
// The interactive chat UI lives in `./ChatClient.tsx` (a `"use client"`
// component) so it can use hooks like useSearchParams / useRouter.

import { cookies } from "next/headers";
import { CONSENT_COOKIE } from "@/lib/cookies";
import { CookieBanner } from "@/components/CookieBanner";
import { ConsentRefresh } from "./ConsentRefresh";
import ChatClient from "./ChatClient";
import styles from "./page.module.css";

export default function ChatPage() {
  const c = cookies().get(CONSENT_COOKIE)?.value;
  const alreadyConsented = c === "true" || c === "false";

  if (alreadyConsented) {
    return <ChatClient />;
  }

  // First-time visitor: show the cookie banner over a minimal backdrop.
  // The banner's Accept button POSTs /api/session (action=accept), which
  // sets both the session cookie and the consent cookie server-side, then
  // calls `onAccepted` → ConsentRefresh triggers router.refresh() → the
  // next render takes the `alreadyConsented` branch above and the chat
  // UI appears.
  return (
    <main className={styles.shell}>
      <ConsentRefresh />
      <CookieBanner
        onAccepted={() => {
          // The banner already POSTed and stored the cookies. Tell the
          // server component to re-evaluate so it switches to the chat
          // UI. (ConsentRefresh is a tiny client component that calls
          // router.refresh() when triggered.)
          window.dispatchEvent(new Event("hai-consent-accepted"));
        }}
      />
    </main>
  );
}