"use client";

// Business details view + edit form.
//
// The record is always fetched by its unique database id. Saving posts
// through the admin server action, which validates the payload and writes
// it to `public.business_profiles`. Fields that are managed by the system
// (id, owner account, ratings, timestamps) are shown read-only.

import { useCallback, useEffect, useState } from "react";
import styles from "./dashboard.module.css";
import { getBusinessAction, updateBusinessAction } from "./actions";
import type { BusinessProfileRecord } from "@/types";
import { formatDate } from "./workers-panel";

interface FormState {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  ownerName: string;
  ownerBio: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  bannerImageUrl: string;
  logoImageUrl: string;
  category: string;
  status: "draft" | "published" | "suspended";
  workingHours: string;
}

function toForm(business: BusinessProfileRecord): FormState {
  const hours = business.working_hours;
  const hoursText =
    hours && typeof hours === "object" && !Array.isArray(hours)
      ? Object.entries(hours as Record<string, string>)
          .map(([key, value]) => `${key}|${value}`)
          .join("\n")
      : "";
  return {
    name: business.name ?? "",
    slug: business.slug ?? "",
    tagline: business.tagline ?? "",
    description: business.description ?? "",
    ownerName: business.owner_name ?? "",
    ownerBio: business.owner_bio ?? "",
    phone: business.phone ?? "",
    email: business.email ?? "",
    website: business.website ?? "",
    address: business.address ?? "",
    city: business.city ?? "",
    state: business.state ?? "",
    postalCode: business.postal_code ?? "",
    country: business.country ?? "",
    bannerImageUrl: business.banner_image_url ?? "",
    logoImageUrl: business.logo_image_url ?? "",
    category: business.category ?? "",
    status: (business.status ?? "draft") as FormState["status"],
    workingHours: hoursText,
  };
}

export function BusinessDetails({
  businessId,
  onBack,
  onSaved,
}: {
  businessId: string;
  onBack: () => void;
  onSaved: (business: BusinessProfileRecord) => void;
}) {
  const [business, setBusiness] = useState<BusinessProfileRecord | null>(null);
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
      const data = await getBusinessAction(businessId);
      setBusiness(data);
      setForm(toForm(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load business");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { void load(); }, [load]);

  const set = (key: keyof FormState) => (value: string) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const cancel = () => {
    if (business) setForm(toForm(business));
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
      const workingHours: Record<string, string> = {};
      for (const line of form.workingHours.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const [key, ...rest] = trimmed.split("|");
        workingHours[key.trim()] = rest.join("|").trim();
      }

      const updated = await updateBusinessAction(businessId, {
        name: form.name.trim(),
        slug: form.slug.trim(),
        tagline: form.tagline.trim(),
        description: form.description.trim(),
        ownerName: form.ownerName.trim(),
        ownerBio: form.ownerBio.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        website: form.website.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        postalCode: form.postalCode.trim(),
        country: form.country.trim(),
        bannerImageUrl: form.bannerImageUrl.trim(),
        logoImageUrl: form.logoImageUrl.trim(),
        category: form.category.trim(),
        status: form.status,
        workingHours,
      });
      setBusiness(updated);
      setForm(toForm(updated));
      setEditing(false);
      setSuccess("Business updated successfully.");
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save business");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !business) {
    return (
      <div className={styles.contentInner}>
        <div className={styles.stateBox}>
          <span className={styles.spinner} aria-hidden="true" />
          Loading business…
        </div>
      </div>
    );
  }

  if (!business || !form) {
    return (
      <div className={styles.contentInner}>
        <button type="button" className={styles.backLink} onClick={onBack}>
          ← Back to Businesses
        </button>
        <div className={`${styles.stateBox} ${styles.stateError}`} role="alert">
          {error ?? "This business could not be found."}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.contentInner}>
      <button type="button" className={styles.backLink} onClick={onBack}>
        ← Back to Businesses
      </button>

      <div>
        <h2 className={styles.sectionTitle}>{business.name}</h2>
        <p className={styles.sectionHint}>Business ID {business.id}</p>
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
              <span className={styles.fieldLabel}>Business name</span>
              <input className={styles.input} value={form.name} required maxLength={160}
                onChange={(e) => set("name")(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>URL slug</span>
              <input className={styles.input} value={form.slug} maxLength={120}
                onChange={(e) => set("slug")(e.target.value)} placeholder="lowercase-with-hyphens" />
              <span className={styles.fieldHint}>Lowercase letters, numbers and hyphens.</span>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Tagline</span>
              <input className={styles.input} value={form.tagline} maxLength={160}
                onChange={(e) => set("tagline")(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Category</span>
              <input className={styles.input} value={form.category} maxLength={120}
                onChange={(e) => set("category")(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Owner name</span>
              <input className={styles.input} value={form.ownerName} maxLength={160}
                onChange={(e) => set("ownerName")(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Email</span>
              <input className={styles.input} type="email" value={form.email} maxLength={254}
                onChange={(e) => set("email")(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Phone</span>
              <input className={styles.input} value={form.phone} maxLength={40}
                onChange={(e) => set("phone")(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Website</span>
              <input className={styles.input} value={form.website} maxLength={500}
                onChange={(e) => set("website")(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Status</span>
              <select className={styles.selectInput} value={form.status} style={{ maxWidth: "none" }}
                onChange={(e) => set("status")(e.target.value)}>
                <option className={styles.selectOption} value="draft">Draft</option>
                <option className={styles.selectOption} value="published">Published</option>
                <option className={styles.selectOption} value="suspended">Suspended</option>
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>City</span>
              <input className={styles.input} value={form.city} maxLength={120}
                onChange={(e) => set("city")(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>State / region</span>
              <input className={styles.input} value={form.state} maxLength={120}
                onChange={(e) => set("state")(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Postal code</span>
              <input className={styles.input} value={form.postalCode} maxLength={30}
                onChange={(e) => set("postalCode")(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Country</span>
              <input className={styles.input} value={form.country} maxLength={120}
                onChange={(e) => set("country")(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Logo image URL</span>
              <input className={styles.input} value={form.logoImageUrl} maxLength={2000}
                onChange={(e) => set("logoImageUrl")(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Banner image URL</span>
              <input className={styles.input} value={form.bannerImageUrl} maxLength={2000}
                onChange={(e) => set("bannerImageUrl")(e.target.value)} />
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span className={styles.fieldLabel}>Address</span>
              <input className={styles.input} value={form.address} maxLength={500}
                onChange={(e) => set("address")(e.target.value)} />
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span className={styles.fieldLabel}>Business description</span>
              <textarea className={styles.textarea} value={form.description} maxLength={5000} rows={5}
                onChange={(e) => set("description")(e.target.value)} />
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span className={styles.fieldLabel}>Owner information</span>
              <textarea className={styles.textarea} value={form.ownerBio} maxLength={2000} rows={4}
                onChange={(e) => set("ownerBio")(e.target.value)} />
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span className={styles.fieldLabel}>Working hours</span>
              <textarea className={styles.textarea} value={form.workingHours} rows={3}
                onChange={(e) => set("workingHours")(e.target.value)}
                placeholder={"One per line, formatted as Day|Hours"} />
              <span className={styles.fieldHint}>One per line, formatted as Day|Hours.</span>
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
              Ratings, review counts and timestamps are managed by the system.
            </span>
          </div>
        </form>
      ) : (
        <>
          <div className={styles.detailGrid}>
            <Detail label="Business ID" value={business.id} mono />
            <Detail label="Business name" value={business.name} />
            <Detail label="URL slug" value={business.slug} />
            <Detail label="Tagline" value={business.tagline} />
            <Detail label="Category" value={business.category} />
            <Detail label="Status" value={business.status} />
            <Detail label="Owner name" value={business.owner_name} />
            <Detail label="Email" value={business.email} />
            <Detail label="Phone" value={business.phone} />
            <Detail label="Website" value={business.website} />
            <Detail label="Address" value={business.address} full />
            <Detail
              label="Location"
              value={[business.city, business.state, business.postal_code, business.country]
                .filter(Boolean)
                .join(", ")}
            />
            <Detail label="Rating" value={String(business.rating_average ?? 0)} />
            <Detail label="Reviews" value={String(business.review_count ?? 0)} />
            <Detail label="Registered" value={formatDate(business.created_at)} />
            <Detail
              label="Working hours"
              value={
                business.working_hours &&
                typeof business.working_hours === "object" &&
                !Array.isArray(business.working_hours)
                  ? Object.entries(business.working_hours as Record<string, string>)
                      .map(([key, value]) => key + ": " + value)
                      .join("\n")
                  : ""
              }
              full
            />
            <Detail label="Logo" value={business.logo_image_url} image />
            <Detail label="Banner" value={business.banner_image_url} image />
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => { setEditing(true); setError(null); setSuccess(null); }}
            >
              Edit business details
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

