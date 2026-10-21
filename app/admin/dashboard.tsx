"use client";

// The admin dashboard shell.
//
// Layout (top to bottom):
//   * "Admin Dashboard" heading
//   * navigation area: [Workers] [Businesses]  |  [Register as a Business]
//                                                       [Sign Out]
//   * the active panel (Conversations, Workers or Businesses)
//
// The Sign Out button sits directly below the "Register as a Business"
// button, sharing its left edge and width, as required by the spec.

import { useCallback, useState } from "react";
import styles from "./dashboard.module.css";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { ConversationsPanel } from "./conversations-panel";
import { WorkersPanel } from "./workers-panel";
import { BusinessesPanel } from "./businesses-panel";
import { RegisterBusinessModal } from "./register-business-modal";
import { signOutAction } from "./actions";

type Section = "conversations" | "workers" | "businesses";

export function AdminDashboard({ adminEmail }: { adminEmail: string | null }) {
  const [section, setSection] = useState<Section>("conversations");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);
    try {
      // 1. Invalidate the session server-side (removes the auth cookies).
      await signOutAction();
      // 2. Clear the browser client's copy of the session as well.
      try {
        await getBrowserSupabase().auth.signOut();
      } catch {
        // The server already invalidated the session; a failure to clear the
        // local copy must not block the sign-out.
      }
      // 3. A full navigation guarantees no cached admin state survives.
      window.location.href = "/admin/login";
    } catch (error) {
      setSignOutError(
        error instanceof Error ? error.message : "Could not sign out. Please try again.",
      );
      setSigningOut(false);
    }
  }, [signingOut]);

  return (
    <div className={styles.dashboard}>
      <header className={styles.topBar}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Admin Dashboard</h1>
          <p className={styles.subtitle}>
            {adminEmail ? `Signed in as ${adminEmail}` : "Manage workers, businesses and conversations"}
          </p>
        </div>

        <nav className={styles.navArea} aria-label="Admin sections">
          <div className={styles.navGroup}>
            <button
              type="button"
              className={`${styles.navButton} ${section === "workers" ? styles.navButtonActive : ""}`}
              aria-pressed={section === "workers"}
              onClick={() => setSection("workers")}
            >
              Workers
            </button>
            <button
              type="button"
              className={`${styles.navButton} ${section === "businesses" ? styles.navButtonActive : ""}`}
              aria-pressed={section === "businesses"}
              onClick={() => setSection("businesses")}
            >
              Businesses
            </button>
          </div>

          <div className={styles.actionStack}>
            <button
              type="button"
              className={styles.registerButton}
              onClick={() => setRegisterOpen(true)}
            >
              Register as a Business
            </button>
            <button
              type="button"
              className={styles.signOutButton}
              onClick={() => void handleSignOut()}
              disabled={signingOut}
            >
              {signingOut ? "Signing out…" : "Sign Out"}
            </button>
          </div>
        </nav>
      </header>

      {signOutError && (
        <p className={styles.alertError} role="alert" style={{ margin: "0.75rem 1.25rem 0" }}>
          {signOutError}
        </p>
      )}

      <main className={styles.content}>
        {section === "workers" && <WorkersPanel />}
        {section === "businesses" && <BusinessesPanel />}
        {section === "conversations" && <ConversationsPanel onNavigate={setSection} />}
      </main>

      {registerOpen && <RegisterBusinessModal onClose={() => setRegisterOpen(false)} />}
    </div>
  );
}
