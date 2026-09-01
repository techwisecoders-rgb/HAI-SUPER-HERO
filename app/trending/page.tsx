"use client";

// Trending Works page (faithful port of the original).
// Notes:
//   - Categories are rendered in visual order: Technical, Educational,
//     Business, Personal, Creative, Home, Transport. The original code's
//     onclick indices were intentionally scrambled; we use the natural index.
//   - Tapping a category image drops a "I am looking for X..." message into
//     the chat (matches the original `openChatFromTrending` behavior).
//   - Tapping a popular query drops the query into the chat (matches the
//     original `openChatFromPopularQuery` behavior).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORIES, POPULAR_QUERIES } from "@/content";
import type { Category, PopularQuery } from "@/types";
import styles from "./page.module.css";

const CAROUSEL_MS = 4000;

export default function TrendingPage() {
  const router = useRouter();
  const [cats, setCats] = useState<Category[]>(CATEGORIES);
  const [queries, setQueries] = useState<PopularQuery[]>(POPULAR_QUERIES);
  const [active, setActive] = useState(0);
  const [slide, setSlide] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const carouselTrackRef = useRef<HTMLDivElement | null>(null);

  // Pull from API (DB). If it fails, fall back to seed content.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, b] = await Promise.all([
          fetch("/api/categories").then((r) => (r.ok ? r.json() : null)),
          fetch("/api/popular").then((r) => (r.ok ? r.json() : null)),
        ]);
        if (!cancelled) {
          if (a?.categories?.length) setCats(a.categories);
          if (b?.popular?.length) setQueries(b.popular);
        }
      } catch { /* keep seed */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Reset slide when category changes.
  useEffect(() => { setSlide(0); }, [active]);

  // Auto-rotate the image carousel every 4s, only while this page is mounted.
  useEffect(() => {
    const len = cats[active]?.items?.length ?? 0;
    if (len < 2) return;
    const id = setInterval(() => {
      setSlide((s) => (s + 1) % len);
    }, CAROUSEL_MS);
    return () => clearInterval(id);
  }, [active, cats]);

  // Apply translateX to both tracks whenever active/slide change.
  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(-${active * 100}%)`;
    }
  }, [active]);
  useEffect(() => {
    if (carouselTrackRef.current) {
      carouselTrackRef.current.style.transform = `translateX(-${slide * 100}%)`;
    }
  }, [slide, active, cats]);

  // Cookie-aware: ensure a server-minted session exists, then send the
  // prefill message and navigate to /chat. We never generate a UUID on
  // the client — the server is the single source of truth so the cookie
  // and the DB row always agree.
  const openChatWith = async (text: string) => {
    const { SESSION_COOKIE } = await import("@/lib/cookies");
    const Cookies = (await import("js-cookie")).default;
    let sid = Cookies.get(SESSION_COOKIE);
    if (!sid || !/^[0-9a-f-]{36}$/i.test(sid)) {
      // Ask the server to mint one and write the cookie via Set-Cookie.
      try {
        const r = await fetch("/api/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "bootstrap" }),
        });
        if (r.ok) {
          const data = (await r.json()) as { sessionId?: string };
          if (data.sessionId) {
            Cookies.set(SESSION_COOKIE, data.sessionId, {
              expires: 365,
              sameSite: "lax",
              path: "/",
            });
            sid = data.sessionId;
          }
        }
      } catch { /* fall through */ }
    }
    if (sid) {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      }).catch(() => {});
    }
    router.push("/chat");
  };

  const current = cats[active];
  const currentItems = current?.items ?? [];

  return (
    <main className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => router.push("/chat")}>←</button>
        <h1>Trending Works</h1>
      </header>

      <section className={styles.categorySection}>
        <div className={styles.categoryCarousel}>
          <button
            type="button"
            className={styles.categoryArrow}
            onClick={() => setActive((a) => (a - 1 + cats.length) % cats.length)}
            aria-label="Previous category"
          >❮</button>
          <div className={styles.categoryWindow}>
            <div className={styles.categoryTrack} ref={trackRef}>
              {cats.map((c, i) => (
                <div
                  key={c.id}
                  className={`${styles.categoryItem} ${i === active ? styles.active : ""}`}
                  onClick={() => setActive(i)}
                >
                  <h2>{c.name}</h2>
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            className={styles.categoryArrow}
            onClick={() => setActive((a) => (a + 1) % cats.length)}
            aria-label="Next category"
          >❯</button>
        </div>
        <div className={styles.categoryDots}>
          {cats.map((c, i) => (
            <button
              key={c.id}
              type="button"
              aria-label={`Go to ${c.name}`}
              className={`${styles.categoryDot} ${i === active ? styles.active : ""}`}
              onClick={() => setActive(i)}
            />
          ))}
        </div>
      </section>

      <div className={styles.categoryDescription}>
        <h2>{current?.name}</h2>
      </div>

      <div className={styles.carousel}>
        <div className={styles.carouselTrack} ref={carouselTrackRef}>
          {currentItems.map((it) => (
            <div
              key={it.id}
              className={styles.slide}
              onClick={() => openChatWith(`I am looking for ${it.caption}. So Could you please let me get the details`)}
            >
              <img src={it.image_url} alt={it.caption} loading="lazy" />
              <div className={styles.caption}>
                <h3>{it.caption}</h3>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.carouselButtons}>
          <button type="button" onClick={() => setSlide((s) => (s - 1 + currentItems.length) % Math.max(currentItems.length, 1))} aria-label="Previous slide">❮</button>
          <button type="button" onClick={() => setSlide((s) => (s + 1) % Math.max(currentItems.length, 1))} aria-label="Next slide">❯</button>
        </div>
        <div className={styles.carouselDots}>
          {currentItems.map((it, i) => (
            <button
              key={it.id}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              className={`${styles.carouselDot} ${i === slide ? styles.active : ""}`}
              onClick={(e) => { e.stopPropagation(); setSlide(i); }}
            />
          ))}
        </div>
      </div>

      <section className={styles.popularQueriesSection}>
        <h2>Popular Queries:</h2>
        {queries.map((q: PopularQuery) => (
          <button
            key={q.id}
            type="button"
            className={styles.query}
            onClick={() => openChatWith(q.text)}
          >
            <span className={styles.queryStar}>★</span>
            <span className={styles.queryText}>{q.text}</span>
          </button>
        ))}
      </section>

      <div className={styles.projectsButtonContainer}>
        <Link href="/projects" className={styles.projectsButton}>OUR RECENT PROJECTS</Link>
      </div>
    </main>
  );
}