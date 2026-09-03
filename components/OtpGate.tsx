"use client";

// OtpGate
//
// Two-step email-OTP gate. Used by:
//   * /register (worker registration)  — purpose='worker_registration'
//   * /profile (quick profile save)    — purpose='quick_profile'
//
// Flow:
//   Stage 1: the parent component shows an email + "Send code" button.
//            On click, we POST /api/otp/send with { email, purpose }
//            and advance to stage 2.
//   Stage 2: 6-digit input + "Verify" button. On click we POST
//            /api/otp/verify with { email, purpose, otp }.
//            On success we call onVerified().
//
// Parent decides what happens after the OTP is verified (e.g. mark a
// registration as confirmed, write the profile, etc.). This component
// is purely the OTP UI + the API plumbing.

import { useState } from "react";
import styles from "./OtpGate.module.css";

export type OtpPurpose = "quick_profile" | "worker_registration";

interface Props {
  /** The email to send the OTP to (required). */
  email: string;
  /** Which OTP bucket to use (see lib/email/send.ts + the migrations). */
  purpose: OtpPurpose;
  /** Called after the OTP is successfully verified. */
  onVerified: () => void | Promise<void>;
  /** Optional helper text under the title. */
  hint?: string;
  /** Used to label the "Send code" button. */
  actionLabel?: string;
  /**
   * Extra body fields included in BOTH the send and the verify POSTs.
   * Useful for worker-registration: passes `registrationId` so the
   * dedicated /api/worker/verify-otp endpoint can mark the row.
   */
  extra?: Record<string, unknown>;
  /**
   * Which endpoint to POST the verify call to. Defaults to
   * `/api/otp/verify`. Set to `/api/worker/verify-otp` for the
   * worker-registration flow (which atomically also marks the
   * worker_registrations row verified).
   */
  verifyEndpoint?: "/api/otp/verify" | "/api/worker/verify-otp";
}

type Stage = "send" | "verify";

export function OtpGate({
  email,
  purpose,
  onVerified,
  hint,
  actionLabel = "Send code",
  extra,
  verifyEndpoint = "/api/otp/verify",
}: Props) {
  const [stage, setStage] = useState<Stage>("send");
  const [otp, setOtp] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    setErr(null);
    setInfo(null);
    setBusy(true);
    try {
      const r = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, purpose, ...(extra ?? {}) }),
      });
      const data = (await r.json().catch(() => null)) as
        | { ok?: true; emailSent?: boolean; message?: string }
        | { error?: string }
        | null;
      if (!r.ok) {
        const msg = (data && "error" in (data as { error?: string }) ? (data as { error: string }).error : null);
        setErr(msg ?? "Could not send the code. Try again.");
        return;
      }
      setInfo(
        (data && "message" in (data as { message?: string }) ? (data as { message?: string }).message : null) ??
          "Check your email for the 6-digit code.",
      );
      setStage("verify");
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setErr(null);
    setInfo(null);
    if (!/^\d{6}$/.test(otp)) {
      setErr("Enter the 6-digit code from your email.");
      return;
    }
    setBusy(true);
    try {
      // For the generic endpoint we send {email, purpose, otp, ...extra}.
      // For the worker endpoint we send {registrationId, otp} (no
      // email/purpose needed because the registrationId is the lookup
      // key — extra is merged only for the generic path).
      const body: Record<string, unknown> =
        verifyEndpoint === "/api/worker/verify-otp"
          ? { otp, ...(extra ?? {}) }
          : { email, purpose, otp, ...(extra ?? {}) };
      const r = await fetch(verifyEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await r.json().catch(() => null)) as { ok?: true } | { error?: string } | null;
      if (!r.ok || !data || !("ok" in data) || !data.ok) {
        const msg = (data && "error" in (data as { error?: string }) ? (data as { error: string }).error : null) ?? "Verification failed";
        setErr(msg);
        return;
      }
      await onVerified();
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.gate}>
      {stage === "send" ? (
        <div className={styles.row}>
          {hint && <p className={styles.hint}>{hint}</p>}
          <button
            type="button"
            disabled={busy || !email}
            className={styles.primary}
            onClick={() => void sendCode()}
          >
            {busy ? "Sending…" : actionLabel}
          </button>
        </div>
      ) : (
        <div className={styles.row}>
          <p className={styles.hint}>
            We sent a 6-digit code to <strong>{email}</strong>. Enter it below to continue.
          </p>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoFocus
            className={styles.otpInput}
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            disabled={busy}
          />
          {err && <div className={styles.err}>{err}</div>}
          {info && <div className={styles.info}>{info}</div>}
          <button
            type="button"
            disabled={busy || otp.length !== 6}
            className={styles.primary}
            onClick={() => void verifyCode()}
          >
            {busy ? "Verifying…" : "Verify"}
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => { setStage("send"); setOtp(""); setErr(null); setInfo(null); }}
            disabled={busy}
          >
            ← Use a different email
          </button>
        </div>
      )}
    </div>
  );
}