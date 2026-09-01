"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PROJECTS, FOUNDERS, CONTACT } from "@/content";
import type { Project } from "@/types";
import styles from "./page.module.css";

const CAROUSEL_MS = 5000;

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(PROJECTS);
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

  useEffect(() => {
    if (projects.length < 2) return;
    const id = setInterval(() => { setActive((a) => (a + 1) % projects.length); }, CAROUSEL_MS);
    return () => clearInterval(id);
  }, [projects.length]);

  return (
    <main className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => router.back()}>â†</button>
        <h1>Our Recent Projects</h1>
      </header>

      <div className={styles.carousel}>
        <div className={styles.carouselTrack} ref={trackRef}>
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
          <button type="button" onClick={() => setActive((a) => (a - 1 + projects.length) % Math.max(projects.length, 1))} aria-label="Previous project">â®</button>
          <button type="button" onClick={() => setActive((a) => (a + 1) % Math.max(projects.length, 1))} aria-label="Next project">â¯</button>
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
              <div className={styles.avatar}>ðŸŽ“</div>
              <div className={styles.founderInfo}>
                <span className={styles.founderName}>{f.name}</span>
                <span className={styles.founderRole}>{f.role}</span>
              </div>
            </div>
          ))}

          <a href={`tel:${CONTACT.phone}`} className={styles.contact}>
            <div className={styles.contactIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <div className={styles.contactInfo}>
              <span className={styles.contactLabel}>Phone</span>
              <span className={styles.contactValue}>{CONTACT.phone}</span>
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
