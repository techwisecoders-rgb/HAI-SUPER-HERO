"use client";

// ThinkingIndicator
//
// Bouncing-dots + rotating-status-text indicator shown after a user sends
// a message, until either:
//   * a real admin (human) reply arrives (sender_type === "admin"), or
//   * the parent unmounts it.
//
// An "auto" reply (sender_type === "auto") does NOT stop the indicator
// because a real human reply can still follow (this matches the
// reference HTML's behaviour where auto replies are shown in the same
// style as the thinking bubble).

import { useEffect, useState } from "react";
import styles from "./ThinkingIndicator.module.css";

const STATUS_LINES = [
  "Thinking…",
  "Looking for the best match…",
  "Checking our team…",
  "Almost there…",
  "Connecting you with help…",
];

interface Props {
  /** Optional aria label override. */
  label?: string;
}

export function ThinkingIndicator({ label }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % STATUS_LINES.length);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.row} role="status" aria-live="polite" aria-label={label ?? "Thinking"}>
      <div className={styles.bubble}>
        <div className={styles.dots}>
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </div>
        <div className={styles.text}>{STATUS_LINES[idx]}</div>
      </div>
    </div>
  );
}