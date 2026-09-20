"use client";

// Left-side auth panel mounted on the /chat page.
//
// State machine:
//   "register" -> fill email/password/confirm -> POST /api/auth/register
//                -> shows OTP step (purpose="register")
//   "login"    -> fill email/password           -> POST /api/auth/login
//                -> shows OTP step (purpose="login")
//   "otp"      -> 6-digit OTP input            -> POST /api/auth/verify-otp
//                -> success: parent flips isAuthenticated, chat is now
//                   bound to the registered user forever (via cookies).
//
// Styling intentionally lives in chat/page.module.css so the panel sits
// flush with the chat shell.

import { useState } from "react";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import { SESSION_COOKIE, APP_USER_COOKIE, APP_EMAIL_COOKIE } from "@/lib/cookies";
import { notifyAuthChanged } from "@/lib/use-auth";

type Mode = "register" | "login";
type Stage = "form" | "otp";

interface AuthPanelProps {
  /** Called when the user has fully authenticated. */
  onAuthenticated?: (info: { userId: string; email: string; sessionId: string }) => void;
  /** Called after the user logs out, allowing a parent overlay to close. */
  onLogout?: () => void;
  /** Already-authenticated user email, if any. */
  authenticatedEmail: string | null;
  /** Start in login-only mode for flows such as the business portal. */
  initialMode?: Mode;
  /** Label for the final OTP submission button. */
  otpSubmitLabel?: string;
}

export function AuthPanel({
  onAuthenticated,
  onLogout,
  authenticatedEmail,
  initialMode = "register",
  otpSubmitLabel = "Verify & Enter Chat",
}: AuthPanelProps) {
  const router = useRouter();
  const loginOnly = initialMode === "login";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [stage, setStage] = useState<Stage>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setEmail(""); setPassword(""); setConfirmPassword(""); setOtp("");
    setErr(null); setInfo(null); setStage("form");
  }
  function switchMode(next: Mode) { reset(); setMode(next); }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setInfo(null);
    setBusy(true);
    try {
      const body = mode === "register"
        ? { email, password, confirmPassword }
        : { email, password };
      const url = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await r.json()) as Record<string, unknown>;
      if (!r.ok) {
        setErr(String(data.error ?? "Request failed"));
        return;
      }
      setInfo(String(data.message ?? "Check your email for the OTP."));
      // The OTP is sent by email (nodemailer + Gmail SMTP) — never
      // returned in the response. The user must read it from their
      // inbox and type it here.
      setStage("otp");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setInfo(null);
    setBusy(true);
    try {
      const r = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email, otp,
          purpose: mode === "register" ? "register" : "login",
          password: mode === "login" ? password : undefined,
        }),
      });
      const data = (await r.json()) as {
        ok?: boolean; error?: string;
        userId?: string; email?: string; sessionId?: string;
      };
      if (!r.ok || !data.ok) {
        setErr(String(data.error ?? "Verification failed"));
        return;
      }
      // Mirror the cookies set by the server into js-cookie so reads
      // in this tab are instant.
      if (data.sessionId) {
        Cookies.set(SESSION_COOKIE, data.sessionId, { expires: 365, sameSite: "lax", path: "/" });
      }
      if (data.userId) {
        Cookies.set(APP_USER_COOKIE, data.userId, { expires: 365, sameSite: "lax", path: "/" });
      }
      if (data.email) {
        Cookies.set(APP_EMAIL_COOKIE, data.email, { expires: 365, sameSite: "lax", path: "/" });
      }
      onAuthenticated?.({
        userId: data.userId!, email: data.email!, sessionId: data.sessionId!,
      });
      notifyAuthChanged();
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch { /* ignore */ }
    Cookies.remove(APP_USER_COOKIE, { path: "/" });
    Cookies.remove(APP_EMAIL_COOKIE, { path: "/" });
    Cookies.remove(SESSION_COOKIE, { path: "/" });
    // Tell every mounted useAuth() hook (in any tab) to re-read the cookies.
    notifyAuthChanged();
    // Hard-reload the page so the server-rendered header also flips.
    router.replace("/chat");
    router.refresh();
    onLogout?.();
  }

  // Already authenticated -> show profile + logout only.
  if (authenticatedEmail) {
    return (
      <div className="authPanel">
        <div className="authHeader">
          <div className="authTitle">HI [Human Intelligence]</div>
          <div className="authSubtitle">Welcome back</div>
        </div>
        <div className="authLoggedIn">
          <div className="authLoggedInLabel">Signed in as</div>
          <div className="authLoggedInEmail">{authenticatedEmail}</div>
          <div className="authLoggedInHint">
            Your chat history is saved forever.
          </div>
          <button type="button" className="authLogoutBtn" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="authPanel">
      <div className="authHeader">
        <div className="authTitle">HI [Human Intelligence]</div>
        <div className="authSubtitle">
          {stage === "form"
            ? mode === "register" ? "Create your account" : "Sign in to your account"
            : "Verify your OTP"}
        </div>
      </div>

      {stage === "form" && (
        <>
          {!loginOnly && (
            <div className="authTabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                className={`authTab ${mode === "register" ? "authTabActive" : ""}`}
                onClick={() => switchMode("register")}
              >
                Register
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                className={`authTab ${mode === "login" ? "authTabActive" : ""}`}
                onClick={() => switchMode("login")}
              >
                Login
              </button>
            </div>
          )}

          <form onSubmit={(e) => void submitForm(e)} className="authForm">
            <label className="authLabel">
              <span>Email</span>
              <input
                type="email" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="authInput" placeholder="you@example.com"
              />
            </label>
            <label className="authLabel">
              <span>Password</span>
              <input
                type="password" required minLength={6}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="authInput" placeholder="At least 6 characters"
              />
            </label>
            {mode === "register" && (
              <label className="authLabel">
                <span>Confirm Password</span>
                <input
                  type="password" required minLength={6} autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="authInput" placeholder="Re-enter password"
                />
              </label>
            )}

            {err && <div className="authErr">{err}</div>}

            <button type="submit" disabled={busy} className="authPrimaryBtn">
              {busy ? "Please wait…" : mode === "register" ? "Create account" : "Continue"}
            </button>
          </form>
        </>
      )}

      {stage === "otp" && (
        <form onSubmit={(e) => void submitOtp(e)} className="authForm">
          <div className="authOtpHint">
            {info ?? `We sent a 6-digit code to ${email}.`}
          </div>
          <label className="authLabel">
            <span>OTP Code</span>
            <input
              type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
              required autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="authInput authOtpInput" placeholder="000000"
            />
          </label>
          {err && <div className="authErr">{err}</div>}
          <button
            type="submit"
            disabled={busy || otp.length !== 6}
            className="authPrimaryBtn"
          >
            {busy ? "Verifying…" : otpSubmitLabel}
          </button>
          <button
            type="button"
            className="authSecondaryBtn"
            onClick={() => { setStage("form"); setOtp(""); setErr(null); setInfo(null); }}
          >
            ← Back
          </button>
        </form>
      )}
    </div>
  );
}