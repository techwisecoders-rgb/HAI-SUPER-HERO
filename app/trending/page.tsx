"use client";

import type { SyntheticEvent } from "react";
import styles from "./page.module.css";

export default function TrendingPage() {
  const forwardAppNavigation = (event: SyntheticEvent<HTMLIFrameElement>) => {
    const embeddedWindow = event.currentTarget.contentWindow;
    if (!embeddedWindow) return;

    const embeddedUrl = new URL(embeddedWindow.location.href);
    if (
      embeddedUrl.origin === window.location.origin &&
      embeddedUrl.pathname !== "/trending-original.html"
    ) {
      window.location.assign(embeddedUrl.href);
    }
  };

  return (
    <main className={styles.page}>
      <iframe
        className={styles.content}
        src="/trending-original.html"
        title="Trending Works"
        onLoad={forwardAppNavigation}
      />
    </main>
  );
}
