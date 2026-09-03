"use client";

// /register — "Register as a worker" (2-step OTP-gated flow).
//
// Step 1: fill out the form, click Submit Registration. The server
//         inserts a *pending* worker_registrations row and (if an
//         email was supplied) emails a 6-digit OTP.
// Step 2: OtpGate renders inline. The user enters the 6-digit code,
//         which is verified via /api/worker/verify-otp and marks
//         the registration as verified.

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WORK_TYPES } from "@/content";
import { OtpGate } from "@/components/OtpGate";
import styles from "./page.module.css";

const AVAILABILITY_OPTIONS = [
  "Full-time", "Part-time", "Weekends only", "On-call", "Flexible",
] as const;

type Stage = "form" | "otp" | "done";

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const back = params.get("back") ?? "/chat";

  const [form, setForm] = useState({
    fullName: "", phone: "", email: "", address: "", workType: "",
    workDescription: "", qualification: "", yearsExperience: "", availability: "",
  });
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage>("form");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [note, setNote] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setNote(null);
    if (!form.fullName.trim() || form.fullName.trim().length < 2) {
      setNote({ kind: "err", msg: "Please enter your full name." }); return;
    }
    if (!/^[0-9]{10}$/.test(form.phone)) {
      setNote({ kind: "err", msg: "Enter a valid 10-digit phone number." }); return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setNote({ kind: "err", msg: "Enter a valid email or leave it blank." }); return;
    }
    if (!form.address.trim()) {
      setNote({ kind: "err", msg: "Address is required." }); return;
    }
    if (!form.workType) {
      setNote({ kind: "err", msg: "Pick a work type." }); return;
    }
    if (!form.workDescription.trim()) {
      setNote({ kind: "err", msg: "Describe the work you do." }); return;
    }

    setBusy(true);
    try {
      const r = await fetch("/api/worker/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          address: form.address.trim(),
          workType: form.workType,
          workDescription: form.workDescription.trim(),
          qualification: form.qualification.trim() || undefined,
          yearsExperience: form.yearsExperience.trim() || undefined,
          availability: form.availability || undefined,
        }),
      });
      const data = (await r.json().catch(() => null)) as
        | { ok: true; registrationId: string; requiresOtp: boolean; message?: string }
        | { error: string }
        | null;
      if (!r.ok || !data || "error" in data) {
        setNote({ kind: "err", msg: ("error" in (data ?? {}) ? (data as { error: string }).error : null) ?? "Failed to submit." });
        return;
      }
      setPendingId(data.registrationId);
      if (data.requiresOtp) {
        setNote({ kind: "ok", msg: data.message ?? "A 6-digit code has been sent to your email." });
        setStage("otp");
      } else {
        setNote({ kind: "ok", msg: data.message ?? "Registration saved." });
        setStage("done");
        setTimeout(() => router.push(back), 1800);
      }
    } catch {
      setNote({ kind: "err", msg: "Network error." });
    } finally {
      setBusy(false);
    }
  }

  if (stage === "otp" && form.email && pendingId) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <button type="button" className={styles.back} onClick={() => setStage("form")} aria-label="Back">←</button>
          <h1 className={styles.title}>Confirm Registration</h1>
        </header>
        <div className={styles.body}>
          <div className={styles.card}>
            <p className={styles.summary}>
              Your registration for <strong>{form.workType}</strong> has been saved. Enter the 6-digit code we sent to <strong>{form.email}</strong> to confirm.
            </p>
            <OtpGate
              email={form.email}
              purpose="worker_registration"
              extra={{ registrationId: pendingId }}
              verifyEndpoint="/api/worker/verify-otp"
              onVerified={() => {
                setNote({ kind: "ok", msg: "Registration confirmed!" });
                setStage("done");
                setTimeout(() => router.push(back), 1500);
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
        <header className={styles.header}><h1 className={styles.title}>Registration Confirmed</h1></header>
        <div className={styles.body}>
          <div className={styles.card}>
            <p className={styles.summary}>Thanks, {form.fullName}! Your worker profile has been saved.</p>
            <button type="button" className={styles.submitBtn} onClick={() => router.push(back)}>Continue</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => router.push(back)} aria-label="Back">←</button>
        <h1 className={styles.title}>Register Your Work</h1>
      </header>
      <div className={styles.body}>
        <form className={styles.card} onSubmit={(e) => void submit(e)}>
          <p className={styles.intro}>
            Tell us about the work you do. We will send a 6-digit code to your email to confirm your registration.
          </p>
          <label className={styles.label}>Full Name <span className={styles.req}>*</span></label>
          <input className={styles.input} value={form.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder="Your full name" required maxLength={120} />

          <label className={styles.label}>Phone <span className={styles.req}>*</span></label>
          <input className={styles.input} type="tel" inputMode="numeric" value={form.phone} onChange={(e) => update("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile number" required maxLength={10} />

          <label className={styles.label}>Email <span className={styles.muted}>(required for confirmation)</span></label>
          <input className={styles.input} type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" maxLength={254} />

          <label className={styles.label}>Full Address <span className={styles.req}>*</span></label>
          <input className={styles.input} value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="House, street, city, state, pincode" required maxLength={500} />

          <label className={styles.label}>Work Type <span className={styles.req}>*</span></label>
          <select className={styles.input} value={form.workType} onChange={(e) => update("workType", e.target.value)} required>
            <option value="" disabled>Select work type</option>
            {WORK_TYPES.map((w) => (<option key={w} value={w}>{w}</option>))}
          </select>

          <label className={styles.label}>Describe the work <span className={styles.req}>*</span></label>
          <textarea className={`${styles.input} ${styles.textarea}`} value={form.workDescription} onChange={(e) => update("workDescription", e.target.value)} placeholder="Describe the work you do" required maxLength={2000} />

          <label className={styles.label}>Qualification</label>
          <input className={styles.input} value={form.qualification} onChange={(e) => update("qualification", e.target.value)} placeholder="Education / certifications" maxLength={200} />

          <label className={styles.label}>Years of Experience</label>
          <input className={styles.input} value={form.yearsExperience} onChange={(e) => update("yearsExperience", e.target.value)} placeholder="e.g. 3" maxLength={40} />

          <label className={styles.label}>Availability</label>
          <select className={styles.input} value={form.availability} onChange={(e) => update("availability", e.target.value)}>
            <option value="">Select availability</option>
            {AVAILABILITY_OPTIONS.map((a) => (<option key={a} value={a}>{a}</option>))}
          </select>

          <button type="submit" disabled={busy} className={styles.submitBtn}>
            {busy ? "Submitting…" : "Submit Registration"}
          </button>

          <p className={`${styles.note} ${note?.kind === "ok" ? styles.noteOk : ""} ${note?.kind === "err" ? styles.noteErr : ""}`} role="status">
            {note?.msg ?? ""}
          </p>
        </form>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className={styles.page} />}>
      <RegisterForm />
    </Suspense>
  );
}