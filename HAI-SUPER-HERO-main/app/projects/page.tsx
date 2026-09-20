"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PROJECTS, FOUNDERS, CONTACT } from "@/content";
import type { Project, ContactSettings } from "@/types";
import styles from "./page.module.css";

const CAROUSEL_MS = 5000;

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(PROJECTS);
  const [contact, setContact] = useState<ContactSettings>({
    phone: CONTACT.phone,
    whatsapp: CONTACT.whatsapp,
  });
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/projects")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.projects?.length) setProjects(d.projects); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Fetch admin-editable contact numbers for the About Us section so
  // the WhatsApp link can use the current admin setting (falls back
  // to bundled CONTACT constants if the API/DB is unavailable).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/contact")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.contact) return;
        setContact({
          phone: d.contact.phone ?? CONTACT.phone,
          whatsapp: d.contact.whatsapp ?? CONTACT.whatsapp,
        });
      })
      .catch(() => { /* keep defaults */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (projects.length < 2) return;
    const id = setInterval(() => { setActive((a) => (a + 1) % projects.length); }, CAROUSEL_MS);
    return () => clearInterval(id);
  }, [projects.length]);

  return (
    <main className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => router.back()}>←</button>
        <h1>Our Recent Projects</h1>
      </header>

      <div className={styles.carousel}>
        <div
          className={styles.carouselTrack}
          ref={trackRef}
          style={{ transform: `translateX(-${active * 100}%)` }}
        >
          {projects.map((p) => (
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer noopener" className={styles.slide}>
              <img src={p.image_url} alt={p.title} loading="lazy" />
              <div className={styles.overlay}>
                <h2>{p.title}</h2>
                {p.description && <p>{p.description}</p>}
              </div>
            </a>
          ))}
        </div>
        <div className={styles.buttons}>
          <button type="button" onClick={() => setActive((a) => (a - 1 + projects.length) % Math.max(projects.length, 1))} aria-label="Previous project">❮</button>
          <button type="button" onClick={() => setActive((a) => (a + 1) % Math.max(projects.length, 1))} aria-label="Next project">❯</button>
        </div>
        <div className={styles.dots}>
          {projects.map((p, i) => (
            <button
              key={p.id}
              type="button"
              aria-label={`Go to project ${i + 1}`}
              className={`${styles.dot} ${i === active ? styles.active : ""}`}
              onClick={() => setActive(i)}
            />
          ))}
        </div>
      </div>

      <section className={styles.about}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h2>About Us</h2>
          </div>

          <p className={styles.cardLabel}>Founders</p>

          {FOUNDERS.map((f) => (
            <div key={f.name} className={styles.founder}>
              <div className={styles.avatar}>🎓</div>
              <div className={styles.founderInfo}>
                <span className={styles.founderName}>{f.name}</span>
                <span className={styles.founderRole}>{f.role}</span>
              </div>
            </div>
          ))}

          <a href={`tel:${contact.phone}`} className={styles.contact}>
            <div className={styles.contactIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <div className={styles.contactInfo}>
              <span className={styles.contactLabel}>Phone</span>
              <span className={styles.contactValue}>{contact.phone}</span>
            </div>
          </a>

          <a
            href={`https://wa.me/${contact.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.contact}
          >
            <div className={styles.contactIcon}>
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M17.6 6.3A7.85 7.85 0 0 0 12 4a7.94 7.94 0 0 0-6.8 12L4 20l4.1-1.1A7.94 7.94 0 0 0 20 12a7.85 7.85 0 0 0-2.4-5.7zM12 18.6a6.6 6.6 0 0 1-3.4-.9l-.2-.1-2.4.6.6-2.4-.1-.2A6.6 6.6 0 1 1 18.6 12 6.6 6.6 0 0 1 12 18.6zm3.6-5c-.2-.1-1.2-.6-1.4-.7-.2-.1-.3-.1-.4.1l-.6.7c-.1.2-.2.2-.4.1a5.4 5.4 0 0 1-2.7-2.4c-.2-.3.2-.3.6-1 .1-.1 0-.2 0-.3l-.7-1.6c-.2-.4-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1.1 2.7.1.2 1.8 2.8 4.5 3.9.6.3 1.1.4 1.5.5a3.6 3.6 0 0 0 1.6.1c.5-.1 1.2-.5 1.4-1l.2-1c0-.2-.1-.2-.3-.3z" />
              </svg>
            </div>
            <div className={styles.contactInfo}>
              <span className={styles.contactLabel}>WhatsApp</span>
              <span className={styles.contactValue}>{contact.whatsapp}</span>
            </div>
          </a>

          <a href={`mailto:${CONTACT.email}`} className={styles.contact}>
            <div className={styles.contactIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div className={styles.contactInfo}>
              <span className={styles.contactLabel}>Email</span>
              <span className={styles.contactValue}>{CONTACT.email}</span>
            </div>
          </a>

          <div className={styles.privacyRow}>
            <Link href={CONTACT.privacyHref} className={styles.privacyBtn}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Privacy Policy
            </Link>
          </div>

          <p className={styles.copy}>Â© {new Date().getFullYear()} ALL RIGHTS RESERVED</p>
        </div>
      </section>
    </main>
  );
}
