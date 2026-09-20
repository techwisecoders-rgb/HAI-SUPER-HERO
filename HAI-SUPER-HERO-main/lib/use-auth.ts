"use client";

// Hook to read the visitor's auth state from cookies. The auth cookie is
// set by /api/auth/verify-otp on success and cleared by /api/auth/logout.
//
// Re-reads on mount, on window focus, and when another tab/window fires
// the `auth:changed` CustomEvent (which the logout flow dispatches after
// clearing cookies). This guarantees the header badge + AuthPanel flip
// to the signed-out state immediately after logout.

import { useEffect, useState, useCallback } from "react";
import Cookies from "js-cookie";
import { APP_USER_COOKIE, APP_EMAIL_COOKIE } from "./cookies";

function read() {
  return {
    userId: Cookies.get(APP_USER_COOKIE) ?? null,
    email: Cookies.get(APP_EMAIL_COOKIE) ?? null,
  };
}

export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const r = read();
    setUserId(r.userId);
    setEmail(r.email);
  }, []);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    const onAuthChanged = () => refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("auth:changed", onAuthChanged);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("auth:changed", onAuthChanged);
    };
  }, [refresh]);

  return { userId, email, isAuthenticated: !!userId, refresh };
}

/**
 * Fire this from anywhere (logout button, OTP verify, etc.) to tell
 * every mounted `useAuth` to re-read the cookies.
 */
export function notifyAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth:changed"));
  }
}