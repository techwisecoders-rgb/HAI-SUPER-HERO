// /about/page.tsx — Dedicated About page (linked from the chat top bar).
//   1. Sticky header with the animated "HAI SUPER HERO" page title
//   2. Hero image (Unsplash placeholder; swap for /public/about/hero.jpg)
//   3. Full About Us card: founders, contact links, privacy, copyright

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FOUNDERS, CONTACT } from "@/content";
import type { ContactSettings } from "@/types";
import styles from "./page.module.css";

const HERO_IMAGE_URL =
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1400&q=80";
const HERO_IMAGE_ALT = "HAI SUPER HERO team collaborating on a project";
export default function AboutPage() {
  const router = useRouter();
  const [contact, setContact] = useState<ContactSettings>({
    phone: CONTACT.phone,
    whatsapp: CONTACT.whatsapp,
  });

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

  return (
    <main className={styles.wrap}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.back}
          onClick={() => router.back()}
          aria-label="Back to previous page"
        >
          ←
        </button>
        <h1 className={styles.heroTitle}>HAI SUPER HERO</h1>
      </header>

      <section className={styles.heroImageWrap}>
        <img
          src={HERO_IMAGE_URL}
          alt={HERO_IMAGE_ALT}
          className={styles.heroImage}
          loading="lazy"
        />
      </section>

      <section className={styles.about}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <div className={styles.contactInfo}>
              <span className={styles.contactLabel}>Phone</span>
              <span className={styles.contactValue}>{contact.phone}</span>
            </div>
          </a>

          <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noopener noreferrer" className={styles.contact}>
            <div className={styles.contactIcon}>
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M19.05 4.91A10 10 0 0 0 4.18 18.16L3 22l3.92-1.16A10 10 0 1 0 19.05 4.91Zm-7.04 15.4h-.01a8.36 8.36 0 0 1-4.26-1.16l-.31-.18-2.32.69.7-2.27-.2-.33a8.36 8.36 0 1 1 15.51-4.43 8.36 8.36 0 0 1-8.35 8.35Zm4.59-6.27c-.25-.13-1.5-.74-1.73-.82-.23-.08-.4-.13-.57.13-.17.25-.66.83-.8 1-.15.17-.3.18-.55.06-.25-.13-1.07-.39-2.03-1.25a7.66 7.66 0 0 1-1.41-1.75c-.15-.25-.02-.39.11-.51.11-.11.25-.3.38-.45.13-.15.17-.25.25-.42.08-.17.04-.32-.02-.45-.06-.13-.57-1.36-.78-1.87-.2-.49-.42-.43-.57-.43h-.49a.94.94 0 0 0-.68.32 2.86 2.86 0 0 0-.9 2.13 4.97 4.97 0 0 0 1.04 2.64 11.4 11.4 0 0 0 4.37 3.86c1.62.7 2.25.76 3.06.64a2.6 2.6 0 0 0 1.71-1.21 2.1 2.1 0 0 0 .15-1.21c-.06-.11-.23-.18-.48-.3Z" />
              </svg>
            </div>
            <div className={styles.contactInfo}>
              <span className={styles.contactLabel}>WhatsApp</span>
              <span className={styles.contactValue}>{contact.whatsapp}</span>
            </div>
          </a>

          <a href={`mailto:${CONTACT.email}`} className={styles.contact}>
            <div className={styles.contactIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Privacy Policy
            </Link>
          </div>

          <p className={styles.copy}>© {new Date().getFullYear()} ALL RIGHTS RESERVED</p>
        </div>
      </section>
    </main>
  );
}