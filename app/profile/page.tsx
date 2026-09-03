"use client";

// /profile — Quick-profile with OTP-gated save + Login for returning users.
//
// Flow:
//   1. On first visit (no companion_app_email cookie): show the
//      "Quick Profile" form (Name + Email + City). On Save we cache
//      locally and show the OTP gate. The user enters the 6-digit
//      code, then we POST /api/profile/save to write display_name
//      + city onto the app_users row.
//   2. On return visits WITH companion_app_email cookie: show a
//      "Login" button. Clicking it shows the OTP gate. On verify
//      we redirect back to the original page (the user is logged in
//      via the existing cookies).

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Cookies from "js-cookie";
import { APP_EMAIL_COOKIE } from "@/lib/cookies";
import { OtpGate } from "@/components/OtpGate";
import styles from "./page.module.css";

const PROFILE_CACHE_KEY = "accompanyQuickProfile";
const PROFILE_NAME_KEY = "accompanyQuickName";

interface QuickProfile {
  name: string;
  email: string;
  city: string;
}

type Stage = "form" | "otp" | "done";

function ProfileBody() {
  const router = useRouter();
  const params = useSearchParams();
  const back = params.get("back") ?? "/chat";

  const [form, setForm] = useState<QuickProfile>({ name: "", email: "", city: "" });
  const [stage, setStage] = useState<Stage>("form");
  const [authedEmail, setAuthedEmail] = useState<string | null>(() => Cookies.get(APP_EMAIL_COOKIE) ?? null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // Load cached profile on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROFILE_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as Partial<QuickProfile>;
        setForm({
          name: typeof cached.name === "string" ? cached.name : "",
          email: typeof cached.email === "string" ? cached.email : "",
          city: typeof cached.city === "string" ? cached.city : "",
        });
      }
    } catch { /* ignore */ }
  }, []);

  // Click-outside closes the menu.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (!t.closest(`.${styles.headerRight}`)) setMenuOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  function update<K extends keyof QuickProfile>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function cacheProfile() {
    try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(form)); } catch { /* ignore */ }
  }

  function startNewChat() {
    setMenuOpen(false);
    router.push("/chat?new=1");
  }
  function openSearch() {
    setMenuOpen(false);
    router.push("/chat?focus=search");
  }
  function openRegister() {
    setMenuOpen(false);
    router.push(`/register?back=${encodeURIComponent("/profile")}`);
  }

  // ---------- Render branches ----------

  // Login flow — already authed on this device.
  if (authedEmail && stage === "form") {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <button type="button" className={styles.back} onClick={() => router.push(back)} aria-label="Back">←</button>
          <h1 className={styles.title}>Welcome Back</h1>
          <div className={styles.headerRight}>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Menu"
              aria-expanded={menuOpen}
              onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
              </svg>
            </button>
            {menuOpen && (
              <div className={styles.menu} role="menu">
                <button type="button" className={styles.menuItem} onClick={startNewChat} role="menuitem">New chat</button>
                <button type="button" className={styles.menuItem} onClick={openSearch} role="menuitem">Search</button>
                <button type="button" className={styles.menuItem} onClick={openRegister} role="menuitem">Register as a worker</button>
              </div>
            )}
          </div>
        </header>

        <div className={styles.body}>
          <div className={styles.card}>
            <p className={styles.intro}>
              You are signed in as <strong>{authedEmail}</strong>. Tap Login to verify and continue.
            </p>
            <button type="button" className={styles.submitBtn} onClick={() => setStage("otp")}>
              Login
            </button>
            <button type="button" className={styles.registerLink} onClick={() => router.push(`/register?back=${encodeURIComponent("/profile")}`)}>
              Want to register as a worker? Fill the full form →
            </button>
          </div>
        </div>
      </main>
    );
  }

  // OTP stage — used by both first-time (save profile) and Login (verify).
  if (stage === "otp") {
    const email = (form.email || authedEmail || "").trim();
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <button type="button" className={styles.back} onClick={() => setStage("form")} aria-label="Back">←</button>
          <h1 className={styles.title}>Verify with OTP</h1>
        </header>
        <div className={styles.body}>
          <div className={styles.card}>
            <p className={styles.intro}>
              We will send a 6-digit code to <strong>{email}</strong>. Enter it below to {authedEmail ? "sign in" : "save your profile"}.
            </p>
            <OtpGate
              email={email}
              purpose="quick_profile"
              onVerified={async () => {
                if (!authedEmail) {
                  const send = await fetch("/api/otp/send", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ email, purpose: "quick_profile" }),
                  });
                  if (!send.ok) return;
                  const v = window.prompt("A new 6-digit code has been sent to your email. Please enter it to save your profile:");
                  if (!v || !/^\d{6}$/.test(v)) return;
                  const save = await fetch("/api/profile/save", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ email, displayName: form.name, city: form.city, otp: v }),
                  });
                  if (!save.ok) {
                    const d = (await save.json().catch(() => null)) as { error?: string } | null;
                    setNote({ kind: "err", msg: d?.error ?? "Could not save profile." });
                    return;
                  }
                  try {
                    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(form));
                    localStorage.setItem(PROFILE_NAME_KEY, form.name);
                  } catch { /* ignore */ }
                  setNote({ kind: "ok", msg: "Profile saved successfully!" });
                  setAuthedEmail(email);
                  setStage("done");
                  setTimeout(() => router.push(back), 1200);
                } else {
                  setNote({ kind: "ok", msg: "Welcome back!" });
                  setStage("done");
                  setTimeout(() => router.push(back), 1000);
                }
              }}
            />
            <p className={`${styles.note} ${note?.kind === "ok" ? styles.noteOk : ""} ${note?.kind === "err" ? styles.noteErr : ""}`} role="status">
              {note?.msg ?? ""}
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (stage === "done") {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>{authedEmail ? "Logged in" : "Profile Saved"}</h1>
        </header>
        <div className={styles.body}>
          <div className={styles.card}>
            <p className={styles.intro}>
              {authedEmail ? `Signed in as ${authedEmail}.` : `Thanks, ${form.name}! Your profile is saved.`}
            </p>
            <button type="button" className={styles.submitBtn} onClick={() => router.push(back)}>
              Continue
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Default form stage — first-time visitors fill this out.
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => router.push(back)} aria-label="Back">←</button>
        <h1 className={styles.title}>Quick Profile</h1>
        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
            </svg>
          </button>
          {menuOpen && (
            <div className={styles.menu} role="menu">
              <button type="button" className={styles.menuItem} onClick={startNewChat} role="menuitem">New chat</button>
              <button type="button" className={styles.menuItem} onClick={openSearch} role="menuitem">Search</button>
              <button type="button" className={styles.menuItem} onClick={openRegister} role="menuitem">Register as a worker</button>
            </div>
          )}
        </div>
      </header>

      <div className={styles.body}>
        <form className={styles.card} onSubmit={(e) => { e.preventDefault(); cacheProfile(); setStage("otp"); }}>
          <p className={styles.intro}>
            Tell us a little about yourself so we can address you by name. We will send a 6-digit code to your email to confirm.
          </p>

          <label className={styles.label}>Name <span className={styles.req}>*</span></label>
          <input className={styles.input} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Your name" required maxLength={120} autoFocus />

          <label className={styles.label}>Email <span className={styles.req}>*</span></label>
          <input className={styles.input} type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" required maxLength={254} />

          <label className={styles.label}>City</label>
          <input className={styles.input} value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="Your city" maxLength={80} />

          <button type="submit" className={styles.submitBtn}>
            Save Profile
          </button>

          <button type="button" className={styles.registerLink} onClick={() => router.push(`/register?back=${encodeURIComponent("/profile")}`)}>
            Want to register as a worker? Fill the full form →
          </button>
        </form>
      </div>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<main className={styles.page} />}>
      <ProfileBody />
    </Suspense>
  );
}