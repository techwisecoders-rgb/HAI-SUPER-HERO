// Centralised cookie name + helpers.
// NOTE: These are *non-essential* (chat persistence). They are only set after the
// user clicks "Accept" on the cookie-consent banner. If the user declines or has
// cookies blocked, the chat still works in-memory for the current session.

export const SESSION_COOKIE = "accompany_session_id";
export const CONSENT_COOKIE = "accompany_cookie_consent";

// End-user (visitor) auth — set by /api/auth/verify-otp on success.
export const APP_USER_COOKIE = "accompany_app_user";
export const APP_EMAIL_COOKIE = "accompany_app_email";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function buildSessionCookie(value: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${ONE_YEAR_SECONDS}`,
    secure,
    // Intentionally NOT HttpOnly: the chat page reads this cookie via
    // js-cookie on the client (so it can filter its realtime subscription
    // by session_id). The cookie value itself is a random UUID with no PII.
  ].join("; ");
}

export function buildConsentCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return [
    `${CONSENT_COOKIE}=true`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${ONE_YEAR_SECONDS}`,
    secure,
  ].join("; ");
}

export function buildDeclineCookie(): string {
  // We don't set a long-lived consent cookie. Instead we set a short-lived
  // session-only "declined" marker so the banner doesn't re-appear during this
  // browsing session, but it WILL re-appear on the next visit.
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return [
    `${CONSENT_COOKIE}=false`,
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0", // session cookie only
    secure,
  ].join("; ");
}
