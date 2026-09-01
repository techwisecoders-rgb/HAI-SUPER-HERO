"use client";

// Hook to read the visitor's session_id from cookies. Returns null if the
// cookie hasn't been set yet (e.g. user hasn't accepted cookies).

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { SESSION_COOKIE, CONSENT_COOKIE } from "./cookies";

export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);

  useEffect(() => {
    const sid = Cookies.get(SESSION_COOKIE) ?? null;
    const consent = Cookies.get(CONSENT_COOKIE);
    setSessionId(sid);
    setHasConsent(consent === "true");
  }, []);

  return { sessionId, hasConsent };
}
