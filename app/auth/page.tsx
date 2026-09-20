"use client";

// /auth — full-page Register / Login / OTP flow.
// After successful verification the user is redirected back to /chat
// and the chat is permanently bound to their account.
//
// useSearchParams() requires a Suspense boundary in Next 14, so the
// page is split into a thin outer wrapper and an inner client body.

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthPanel } from "@/components/AuthPanel";
import { useAuth } from "@/lib/use-auth";
import styles from "./page.module.css";

export default function AuthPage() {
  return (
    <Suspense fallback={<main className={styles.shell} />}>
      <AuthBody />
    </Suspense>
  );
}

function AuthBody() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/chat";
  const isBusinessDestination = next === "/business";
  const initialMode = isBusinessDestination || params.get("mode") === "login" ? "login" : "register";
  const { email: authEmail } = useAuth();

  return (
    <main className={styles.shell}>
      <div className={styles.brand}>
        <h1 className={styles.brandTitle}>HI [Human Intelligence]</h1>
        <p className={styles.brandSub}>We are not from AI, but HI, who created AI.</p>
      </div>

      <div className={styles.card}>
        <AuthPanel
          authenticatedEmail={authEmail}
          initialMode={initialMode}
          otpSubmitLabel={next === "/business" ? "Verify & Continue" : undefined}
          onAuthenticated={() => router.replace(next)}
        />
      </div>

      <div className={styles.footer}>
        {authEmail ? (
          <>
            You&rsquo;re signed in.{" "}
            <span
              className={styles.footerLink}
              onClick={() => router.replace(next)}
            >
              Open chat →
            </span>
          </>
        ) : (
          <>
            By continuing you agree to our{" "}
            <a href="/privacy" className={styles.footerLink}>privacy policy</a>.
          </>
        )}
      </div>
    </main>
  );
}