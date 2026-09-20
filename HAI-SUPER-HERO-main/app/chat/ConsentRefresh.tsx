"use client";

// Bridge between the cookie banner (mounted inside a server component) and
// Next.js router refresh. The server component can't directly call
// `useRouter`, so it dispatches a window event when the banner's Accept
// callback fires; this component listens for that event and calls
// `router.refresh()` which re-renders the server component with the new
// cookie values.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ConsentRefresh() {
  const router = useRouter();

  useEffect(() => {
    const handler = () => {
      // Force the server component (which reads the consent cookie) to
      // re-evaluate. After Accept, the cookie is set → the next render
      // takes the "already consented" branch and renders <ChatClient />.
      router.refresh();
    };
    window.addEventListener("hai-consent-accepted", handler);
    return () => window.removeEventListener("hai-consent-accepted", handler);
  }, [router]);

  return null;
}