"use client";

// "Register as a Business" dialog.
//
// The behaviour is unchanged from the original dashboard: the admin enters
// an e-mail, a password and a confirmation, and a business login is
// created through the existing createBusinessAction server action. The
// business owner then signs in at /business and creates their profile.

import { useState } from "react";
import styles from "./admin.module.css";
import { createBusinessAction } from "./actions";

export function RegisterBusinessModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const result = await createBusinessAction({ email, password, confirmPassword });
      setSuccess(`Business credentials created for ${result.email}.`);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not create business credentials");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.modalBackdrop} role="presentation">
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="business-registration-title"
      >
        <div className={styles.modalHeader}>
          <div>
            <h2 id="business-registration-title" className={styles.modalTitle}>
              Register as business
            </h2>
            <p className={styles.modalDescription}>
              Create login credentials for a business owner. They will sign in at /business and create their profile there.
            </p>
          </div>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close business registration"
          >
            ×
          </button>
        </div>

        <form className={styles.businessForm} onSubmit={submit}>
          <label className={styles.businessField}>
            <span>Business email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={styles.businessInput}
              placeholder="owner@business.com"
            />
          </label>
          <label className={styles.businessField}>
            <span>Password</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={styles.businessInput}
              placeholder="At least 6 characters"
            />
          </label>
          <label className={styles.businessField}>
            <span>Confirm password</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={styles.businessInput}
              placeholder="Re-enter password"
            />
          </label>

          {error && <p className={styles.businessError} role="alert">{error}</p>}
          {success && <p className={styles.businessSuccess} role="status">{success}</p>}

          <div className={styles.businessActions}>
            <button
              type="button"
              className={styles.businessCancel}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type={success ? "button" : "submit"}
              disabled={busy}
              className={styles.businessSubmit}
              onClick={success ? onClose : undefined}
            >
              {success ? "Done" : busy ? "Creating…" : "Create credentials"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
