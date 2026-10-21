"use client";

// Worker details view + edit form.
//
// The record is always fetched by its unique database id, so the admin
// always sees the exact row they selected. Saving posts through the admin
// server action, which validates the payload and writes it to
// `public.worker_profiles`.

import { useCallback, useEffect, useState } from "react";
import styles from "./dashboard.module.css";
import { getWorkerAction, updateWorkerAction } from "./actions";
import type { WorkerProfileRecord } from "@/types";
import { professions } from "@/app/worker/professions";
import { formatDate } from "./workers-panel";

const PROFESSION_OPTIONS = professions
  .map((p) => p.value)
  .filter((value) => value && value !== "Select");

interface FormState {
  name: string;
  email: string;
  phone: string;
  location: string;
  qualification: string;
  experience: string;
  profession: string;
  workAvailable: boolean;
  aboutText: string;
  workDescription: string;
  skills: string;
  profileImageUrl: string;
  backgroundImageUrl: string;
  resumeUrl: string;
  socialLinks: string;
  rating: string;
  jobsDone: string;
}

function toForm(worker: WorkerProfileRecord): FormState {
  const skills = Array.isArray(worker.skills) ? (worker.skills as string[]) : [];
  const social = Array.isArray(worker.social_links)
    ? (worker.social_links as Array<{ label?: string; url?: string }>)
    : [];
  return {
    name: worker.name ?? "",
    email: worker.email ?? "",
    phone: worker.phone ?? "",
    location: worker.location ?? "",
    qualification: worker.qualification ?? "",
    experience: worker.experience ?? "",
    profession: worker.profession ?? "",
    workAvailable: Boolean(worker.work_available),
    aboutText: worker.about_text ?? "",
    workDescription: worker.work_description ?? "",
    skills: skills.join(", "),
    profileImageUrl: worker.profile_image_url ?? "",
    backgroundImageUrl: worker.background_image_url ?? "",
    resumeUrl: worker.resume_url ?? "",
    socialLinks: social.map((l) => `${l.label ?? ""}|${l.url ?? ""}`).join("\n"),
    rating: String(worker.rating ?? 0),
    jobsDone: String(worker.jobs_done ?? 0),
  };
}

export function WorkerDetails({
  workerId,
  onBack,
  onSaved,
}: {
  workerId: string;
  onBack: () => void;
  onSaved: (worker: WorkerProfileRecord) => void;
}) {
  const [worker, setWorker] = useState<WorkerProfileRecord | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWorkerAction(workerId);
      setWorker(data);
      setForm(toForm(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load worker");
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => { void load(); }, [load]);

  const set = (key: keyof FormState) => (value: string | boolean) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const cancel = () => {
    if (worker) setForm(toForm(worker));
    setEditing(false);
    setError(null);
    setSuccess(null);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const socialLinks = form.socialLinks
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [label, url] = line.split("|");
          return { label: (label ?? "").trim(), url: (url ?? "").trim() };
        });

      const updated = await updateWorkerAction(workerId, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        location: form.location.trim(),
        qualification: form.qualification.trim(),
        experience: form.experience.trim(),
        profession: form.profession.trim(),
        workAvailable: form.workAvailable,
        aboutText: form.aboutText,
        workDescription: form.workDescription,
        skills: form.skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        profileImageUrl: form.profileImageUrl.trim(),
        backgroundImageUrl: form.backgroundImageUrl.trim(),
        resumeUrl: form.resumeUrl.trim(),
        socialLinks,
        rating: Number(form.rating),
        jobsDone: Number(form.jobsDone),
      });
      setWorker(updated);
      setForm(toForm(updated));
      setEditing(false);
      setSuccess("Worker updated successfully.");
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save worker");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !worker) {
    return (
      <div className={styles.contentInner}>
        <div className={styles.stateBox}>
          <span className={styles.spinner} aria-hidden="true" />
          Loading worker…
        </div>
      </div>
    );
  }

  if (!worker || !form) {
    return (
      <div className={styles.contentInner}>
        <button type="button" className={styles.backLink} onClick={onBack}>
          ← Back to Workers
        </button>
        <div className={`${styles.stateBox} ${styles.stateError}`} role="alert">
          {error ?? "This worker could not be found."}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.contentInner}>
      <button type="button" className={styles.backLink} onClick={onBack}>
        ← Back to Workers
      </button>

      <div>
        <h2 className={styles.sectionTitle}>{worker.name || "Unnamed worker"}</h2>
        <p className={styles.sectionHint}>Worker ID {worker.id}</p>
      </div>

      {error && (
        <p className={`${styles.alert} ${styles.alertError}`} role="alert">
          {error}
        </p>
      )}
      {success && !editing && (
        <p className={`${styles.alert} ${styles.alertSuccess}`} role="status">
          {success}
        </p>
      )}

      {editing ? (
        <form className={styles.form} onSubmit={save} noValidate>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Full name</span>
              <input className={styles.input} value={form.name}
                onChange={(e) => set("name")(e.target.value)} required maxLength={120} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Email</span>
              <input className={styles.input} type="email" value={form.email}
                onChange={(e) => set("email")(e.target.value)} maxLength={254} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Phone number</span>
              <input className={styles.input} value={form.phone}
                onChange={(e) => set("phone")(e.target.value)} maxLength={40} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Location</span>
              <input className={styles.input} value={form.location}
                onChange={(e) => set("location")(e.target.value)} maxLength={500} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Profession</span>
              <select className={styles.selectInput} value={form.profession}
                onChange={(e) => set("profession")(e.target.value)} style={{ maxWidth: "none" }}>
                {PROFESSION_OPTIONS.map((p) => (
                  <option className={styles.selectOption} key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Qualification</span>
              <input className={styles.input} value={form.qualification}
                onChange={(e) => set("qualification")(e.target.value)} maxLength={200} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Experience</span>
              <input className={styles.input} value={form.experience}
                onChange={(e) => set("experience")(e.target.value)} maxLength={80} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Skills</span>
              <input className={styles.input} value={form.skills}
                onChange={(e) => set("skills")(e.target.value)} placeholder="Comma separated" />
              <span className={styles.fieldHint}>Separate skills with commas.</span>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Rating (0–5)</span>
              <input className={styles.input} type="number" min={0} max={5} step={0.01}
                value={form.rating} onChange={(e) => set("rating")(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Jobs completed</span>
              <input className={styles.input} type="number" min={0} step={1}
                value={form.jobsDone} onChange={(e) => set("jobsDone")(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Profile image URL</span>
              <input className={styles.input} value={form.profileImageUrl}
                onChange={(e) => set("profileImageUrl")(e.target.value)} maxLength={2000} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Background image URL</span>
              <input className={styles.input} value={form.backgroundImageUrl}
                onChange={(e) => set("backgroundImageUrl")(e.target.value)} maxLength={2000} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Resume URL</span>
              <input className={styles.input} value={form.resumeUrl}
                onChange={(e) => set("resumeUrl")(e.target.value)} maxLength={2000} />
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span className={styles.fieldLabel}>Profile description</span>
              <textarea className={styles.textarea} value={form.aboutText}
                onChange={(e) => set("aboutText")(e.target.value)} maxLength={10000} rows={5} />
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span className={styles.fieldLabel}>Work description</span>
              <textarea className={styles.textarea} value={form.workDescription}
                onChange={(e) => set("workDescription")(e.target.value)} maxLength={10000} rows={5} />
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span className={styles.fieldLabel}>Social links</span>
              <textarea className={styles.textarea} value={form.socialLinks}
                onChange={(e) => set("socialLinks")(e.target.value)}
                placeholder={"One per line, formatted as label|url"} rows={3} />
              <span className={styles.fieldHint}>One per line, formatted as label|url.</span>
            </label>
            <label className={styles.checkboxRow}>
              <input type="checkbox" checked={form.workAvailable}
                onChange={(e) => set("workAvailable")(e.target.checked)} />
              Available for work
            </label>
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryButton} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <button type="button" className={styles.secondaryButton} onClick={cancel} disabled={saving}>
              Cancel
            </button>
            <span className={styles.readOnlyNote}>
              ID, account links and timestamps are managed by the system.
            </span>
          </div>
        </form>
      ) : (
        <>
          <div className={styles.detailGrid}>
            <Detail label="Worker ID" value={worker.id} mono />
            <Detail label="Full name" value={worker.name} />
            <Detail label="Email" value={worker.email} />
            <Detail label="Phone number" value={worker.phone} />
            <Detail label="Profession" value={worker.profession} />
            <Detail label="Location" value={worker.location} />
            <Detail label="Qualification" value={worker.qualification} />
            <Detail label="Experience" value={worker.experience} />
            <Detail label="Status"
              value={worker.work_available ? "Available for work" : "Not currently available"} />
            <Detail label="Rating" value={String(worker.rating ?? 0)} />
            <Detail label="Jobs completed" value={String(worker.jobs_done ?? 0)} />
            <Detail label="Registered" value={formatDate(worker.created_at)} />
            <Detail label="Last updated" value={formatDate(worker.updated_at)} />
            <Detail
              label="Skills"
              value={Array.isArray(worker.skills) && worker.skills.length
                ? (worker.skills as string[]).join(", ")
                : ""}
            />
            <Detail label="Profile description" value={worker.about_text} full />
            <Detail label="Work description" value={worker.work_description} full />
            <Detail
              label="Social links"
              value={Array.isArray(worker.social_links) && worker.social_links.length
                ? (worker.social_links as Array<{ label?: string; url?: string }>)
                    .map((l) => [l.label, l.url].filter(Boolean).join(": "))
                    .join("\n")
                : ""}
              full
            />
            <Detail label="Resume" value={worker.resume_url} full />
            <Detail label="Profile image" value={worker.profile_image_url} image />
            <Detail label="Background image" value={worker.background_image_url} image />
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => { setEditing(true); setError(null); setSuccess(null); }}
            >
              Edit worker details
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  full,
  image,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  full?: boolean;
  image?: boolean;
  mono?: boolean;
}) {
  const text = (value ?? "").trim();
  return (
    <div className={`${styles.detailCard} ${full ? styles.detailFull : ""}`}>
      <span className={styles.detailLabel}>{label}</span>
      {image && text ? (
        <img className={styles.detailImage} src={text} alt={label} />
      ) : mono && text ? (
        <span className={styles.detailValue} style={{ fontFamily: "ui-monospace, monospace" }}>
          {text}
        </span>
      ) : text ? (
        <span className={styles.detailValue}>{text}</span>
      ) : (
        <span className={`${styles.detailValue} ${styles.detailValueMuted}`}>Not set</span>
      )}
    </div>
  );
}

