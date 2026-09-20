"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./page.module.css";
export const cx = (...names: string[]) => names.map(name => styles[name]).filter(Boolean).join(" ");

export function Section({ title, edit, children }: { title: string; edit?: () => void; children: ReactNode }) {
  return <section className={cx("extra-section")}><div className={cx("extra-section-header")}><h2 className={cx("extra-section-title")}>{title}</h2>{edit && <button type="button" className={cx("section-edit")} onClick={edit} aria-label={`Edit ${title}`}>✎</button>}</div>{children}</section>;
}

export function WorkerModal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => previous?.focus();
  }, []);
  return <div className={cx("modal-overlay", "show")} onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <div className={cx("modal-box")} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onKeyDown={e => {
      if (e.key === "Escape") { e.stopPropagation(); close(); }
      if (e.key === "Tab") {
        const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href], select:not(:disabled)') || []);
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { e.preventDefault(); first?.focus(); }
      }
    }}><div className={cx("modal-header")}><h2 className={cx("modal-title")}>{title}</h2><button type="button" className={cx("modal-close")} onClick={close} aria-label="Close dialog">×</button></div><div className={cx("modal-body")}>{children}</div></div>
  </div>;
}

export function UploadZone({ label, multiple = false, pdf = false, disabled, upload }: { label: string; multiple?: boolean; pdf?: boolean; disabled: boolean; upload: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return <div className={cx("upload-drop-zone")} role="button" tabIndex={disabled ? -1 : 0} aria-label={label} aria-disabled={disabled}
    onClick={() => { if (!disabled) input.current?.click(); }}
    onKeyDown={e => { if (!disabled && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); input.current?.click(); } }}
    onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!disabled) upload(Array.from(e.dataTransfer.files).slice(0, multiple ? undefined : 1)); }}>
    <span className={cx("upload-drop-icon")}>{pdf ? "📄" : "🖼️"}</span><strong>{label}</strong><small>Drag and drop or click to browse · 5 MB per file</small>
    <input ref={input} type="file" hidden disabled={disabled} multiple={multiple} accept={`image/jpeg,image/png,image/webp,image/gif${pdf ? ",application/pdf" : ""}`} onClick={e => e.stopPropagation()} onChange={e => { upload(Array.from(e.target.files || [])); e.target.value = ""; }} />
  </div>;
}
