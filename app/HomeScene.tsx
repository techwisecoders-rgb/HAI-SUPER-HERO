"use client";

// Client portion of the splash page. Renders the chakra animation and
// the cookie banner (if not already accepted). The parent server
// component decides whether to mount this with `showBanner`.

import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import { CookieBanner } from "@/components/CookieBanner";

export function HomeScene({ showBanner }: { showBanner: boolean }) {
  const router = useRouter();
  return (
    <main className={styles.wrap}>
      {/* Decorative background + rays (always hidden from a11y) */}
      <div className={styles.bg} aria-hidden />
      <div className={styles.rays} aria-hidden />

      {/* Centering layer for the spine and welcome button. NOT aria-hidden
          because it contains the interactive button. The decorative chakra
          dots inside the spine are individually marked aria-hidden. */}
      <div className={styles.scene}>
        <div className={styles.spine} aria-hidden>
          <div className={`${styles.ck} ${styles.ck9}`} />
          <div className={`${styles.ck} ${styles.ck8}`} />
          <div className={`${styles.ck} ${styles.ck7}`} />
          <div className={`${styles.ck} ${styles.ck6}`} />
          <div className={`${styles.ck} ${styles.ck5}`} />
          <div className={`${styles.ck} ${styles.ck4}`} />
          <div className={`${styles.ck} ${styles.ck3}`} />
        </div>

        {/* The interactive button — sibling of .spine so it inherits the
            .scene flex centering but is NOT inside any aria-hidden element. */}
        <button
          type="button"
          className={styles.welcome}
          onClick={() => router.push("/chat")}
        >
          Welcome To Our World
        </button>
      </div>

      <Link
        href="/projects"
        className={styles.bolt}
        aria-label="Quick access to projects"
      >
        ⚡
      </Link>

      {showBanner && (
        <CookieBanner onAccepted={() => router.push("/chat")} />
      )}
    </main>
  );
}