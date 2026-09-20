"use client";

import { FormEvent, useEffect, useState, type ReactNode } from "react";
import styles from "./page.module.css";

export interface ResourceField {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "checkbox" | "select" | "json";
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  help?: string;
}

export interface ResourceColumn {
  key: string;
  label: string;
  format?: (value: unknown, item: Record<string, unknown>) => ReactNode;
}

export interface ResourceAction {
  label: string;
  tone?: "primary" | "danger" | "neutral";
  payload: Record<string, unknown>;
  hidden?: (item: Record<string, unknown>) => boolean;
}

interface ResourceSectionProps {
  title: string;
  blurb: string;
  resource: string;
  items: Record<string, unknown>[];
  fields: ResourceField[];
  columns: ResourceColumn[];
  defaults: Record<string, unknown>;
  emptyMessage: string;
  actions?: (item: Record<string, unknown>) => ResourceAction[];
  onSaved: () => void;
}

function apiField(key: string) {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function valueFor(field: ResourceField, value: unknown): string | number {
  if (field.type === "number") return typeof value === "number" ? value : "";
  if (value === null || value === undefined) return "";
  return String(value);
}

export default function ResourceSection({
  title,
  blurb,
  resource,
  items,
  fields,
  columns,
  defaults,
  emptyMessage,
  actions,
  onSaved,
}: ResourceSectionProps) {
  const [form, setForm] = useState<Record<string, unknown>>(defaults);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    setForm(defaults);
    setEditingId(null);
    // The parent passes fresh object literals; resetting on every render would erase edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, items.length]);

  function update(key: string, value: unknown) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startEdit(item: Record<string, unknown>) {
    const next: Record<string, unknown> = {};
    for (const field of fields) {
      next[field.key] = item[apiField(field.key)] ?? item[field.key] ?? defaults[field.key] ?? "";
    }
    setForm(next);
    setEditingId(String(item.id));
    setNotice(null);
  }

  function reset() {
    setForm(defaults);
    setEditingId(null);
    setNotice(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    const payload: Record<string, unknown> = { ...form };
    for (const field of fields) {
      if (field.type === "number") {
        const raw = String(payload[field.key] ?? "");
        payload[field.key] = raw === "" ? null : Number(raw);
      } else if (field.type === "checkbox") {
        payload[field.key] = payload[field.key] === true;
      } else if (field.type === "select" && payload[field.key] === "") {
        payload[field.key] = null;
      } else if (field.type === "json") {
        try {
          payload[field.key] = JSON.parse(String(payload[field.key] || "[]"));
        } catch {
          setBusy(false);
          setNotice({ kind: "err", text: `${field.label} must be valid JSON.` });
          return;
        }
      } else if (typeof payload[field.key] === "string") {
        payload[field.key] = String(payload[field.key]).trim();
      }
    }
    try {
      const url = editingId ? `/api/business/${resource}/${editingId}` : `/api/business/${resource}`;
      const response = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok || data?.error) throw new Error(data?.error ?? "Could not save record");
      reset();
      onSaved();
      setNotice({ kind: "ok", text: editingId ? "Changes saved." : "Record added." });
    } catch (error) {
      setNotice({ kind: "err", text: error instanceof Error ? error.message : "Network error." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this record? This cannot be undone.")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/business/${resource}/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete record");
      onSaved();
    } catch (error) {
      setNotice({ kind: "err", text: error instanceof Error ? error.message : "Network error." });
    } finally {
      setBusy(false);
    }
  }

  async function runAction(item: Record<string, unknown>, action: ResourceAction) {
    setBusy(true);
    try {
      const response = await fetch(`/api/business/${resource}/${String(item.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action.payload),
      });
      if (!response.ok) throw new Error("Could not update record");
      onSaved();
    } catch (error) {
      setNotice({ kind: "err", text: error instanceof Error ? error.message : "Network error." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.section} id={resource}>
      <div className={styles.sectionHeading}>
        <div>
          <h2>{title}</h2>
          <p>{blurb}</p>
        </div>
        <span className={styles.countPill}>{items.length}</span>
      </div>

      <form className={styles.editor} onSubmit={submit}>
        <div className={styles.editorTitle}>
          <strong>{editingId ? "Edit record" : "Add new record"}</strong>
          {editingId && <button type="button" className={styles.textBtn} onClick={reset}>Cancel edit</button>}
        </div>
        <div className={styles.fieldGrid}>
          {fields.map((field) => (
            <label className={`${styles.field} ${field.type === "textarea" || field.type === "json" ? styles.fieldWide : ""}`} key={field.key}>
              <span>{field.label}{field.required && <b> *</b>}</span>
              {field.type === "textarea" ? (
                <textarea required={field.required} value={valueFor(field, form[field.key])} onChange={(event) => update(field.key, event.target.value)} placeholder={field.help} />
              ) : field.type === "json" ? (
                <textarea required={field.required} className={styles.codeInput} value={valueFor(field, form[field.key])} onChange={(event) => update(field.key, event.target.value)} placeholder={field.help} />
              ) : field.type === "checkbox" ? (
                <input type="checkbox" checked={form[field.key] === true} onChange={(event) => update(field.key, event.target.checked)} />
              ) : field.type === "select" ? (
                <select value={String(form[field.key] ?? "")} onChange={(event) => update(field.key, event.target.value)}>
                  <option value="">Select...</option>
                  {field.options?.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
              ) : field.type === "number" ? (
                <input type="number" step="0.01" min="0" required={field.required} value={valueFor(field, form[field.key])} onChange={(event) => update(field.key, event.target.value)} />
              ) : (
                <input type="text" required={field.required} value={valueFor(field, form[field.key])} onChange={(event) => update(field.key, event.target.value)} placeholder={field.help} />
              )}
            </label>
          ))}
        </div>
        <div className={styles.formActions}>
          <button className={styles.primaryBtn} disabled={busy}>{editingId ? "Save changes" : "Add record"}</button>
          {notice && <span className={notice.kind === "err" ? styles.formError : styles.formOk}>{notice.text}</span>}
        </div>
      </form>

      <div className={styles.tableWrap}>
        {items.length === 0 ? (
          <div className={styles.emptyState}>{emptyMessage}</div>
        ) : (
          <table className={styles.table}>
            <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}<th>Actions</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={String(item.id)}>
                  {columns.map((column) => (
                    <td key={column.key}>{column.format ? column.format(item[column.key], item) : String(item[column.key] ?? "—")}</td>
                  ))}
                  <td>
                    <div className={styles.rowActions}>
                      <button type="button" className={styles.smallBtn} onClick={() => startEdit(item)}>Edit</button>
                      <button type="button" className={`${styles.smallBtn} ${styles.dangerText}`} onClick={() => remove(String(item.id))}>Delete</button>
                      {actions?.(item).filter((action) => !action.hidden?.(item)).map((action) => (
                        <button type="button" className={`${styles.smallBtn} ${action.tone === "danger" ? styles.dangerText : ""}`} key={action.label} onClick={() => void runAction(item, action)}>{action.label}</button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

