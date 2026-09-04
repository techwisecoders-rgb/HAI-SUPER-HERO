"use client";

// ThinkingIndicator
//
// Vertical column of status-message bubbles shown after a user sends
// a message, until either:
//   * a real admin (human) reply arrives (sender_type === "admin"), or
//   * the parent unmounts it.
//
// An "auto" reply (sender_type === "auto") does NOT stop the indicator
// because a real human reply can still follow (this matches the
// reference HTML's behaviour where auto replies are shown in the same
// style as the thinking bubble).
//
// Behaviour:
//   * One bubble appears immediately with STATUS_MESSAGES[0].
//   * Every STATUS_INTERVAL_MS, a new bubble is appended below the
//     existing ones with the next status message. Previous bubbles
//     STAY on screen (no disappearing).
//   * EVERY bubble shows the three-dot up-and-down animation while it
//     is the most-recent one. Earlier bubbles render their text
//     statically (no dots).
//   * After all STATUS_MESSAGES have been shown, the cycle restarts
//     from the beginning, so the indicator can keep streaming status
//     updates while waiting for an admin reply.
//
// Strings may contain literal "\n" sequences; they render as line breaks
// because the .text CSS rule has `white-space: pre-line`.

import { useEffect, useState } from "react";
import styles from "./ThinkingIndicator.module.css";

const STATUS_MESSAGES = [
  "YOUR SUPER HERO IS HERE...!!",
  "I WILL INCARNATE INTO THE \nMAHA AVATARS \nBASED UPON YOUR WISHES AND ALLOTED WORKS...",
  "INITIALIZING MY SUPER POWER...",
  "CONNECTING TO \nHUMAN INTELLIGENCE:\nI AM NOT THE AI, \nBUT HI, WHO CREATED AI...",
  "UNDERSTANDING YOUR MESSAGE...",
  "ANALYZING THE CONTEXT...",
  "PROCESSING THE DATA...",
  "CHECKING THE SERVER...",
  "SEARCHING FOR THE INFORMATION...",
  "RECEIVING THE SIGNALS...",
  "VERIFYING THE QUALITY...",
  "EVALUATING THE ANSWERS...",
  "ORGANIZING IN THE WAY...",
  "OPTIMIZING THE RESULTS...",
  "REFINING THE STRUCTURE...",
  "ASSEMBLING IN THE ORDER...",
  "ALMOST GETTING \nEVERYTHING READY...",
  "COMPLETING THE PROCESS...",
  "BUILDING THE RESPONSE...",
  "VALIDATING THE DETAILS...",
  "PERFORMING FINAL CHECKS...",
  "FINALIZING THE REPLY...",
  "PREPARING TO \nACCOMPLISH THE TASK...",
  "YOUR SUPER HERO IS READY \nTO DO YOUR WORK...",
];

/** Gap between successive status bubbles, in milliseconds. */
const STATUS_INTERVAL_MS = 10_000;

interface Props {
  /** Optional aria label override. */
  label?: string;
}

export function ThinkingIndicator({ label }: Props) {
  // Number of status bubbles currently shown. Starts at 1 (the first
  // bubble is visible immediately on mount) and grows by 1 every
  // STATUS_INTERVAL_MS. After reaching STATUS_MESSAGES.length the cycle
  // restarts from 1, so the user keeps seeing new status updates.
  const [shown, setShown] = useState(1);

  useEffect(() => {
    let cancelled = false;
    let n = 1;
    function tick() {
      if (cancelled) return;
      n = (n % STATUS_MESSAGES.length) + 1; // 1 → 2 → … → 24 → 1 → 2 → …
      setShown(n);
      timeoutId = window.setTimeout(tick, STATUS_INTERVAL_MS);
    }
    let timeoutId = window.setTimeout(tick, STATUS_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  const total = shown;
  const lastIndex = total - 1;

  return (
    <div className={styles.stack} role="status" aria-live="polite" aria-label={label ?? "Thinking"}>
      {Array.from({ length: total }, (_, i) => {
        const isLatest = i === lastIndex;
        return (
          <div key={i} className={styles.bubble}>
            {isLatest ? (
              <div className={styles.dots} aria-hidden>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
            ) : null}
            <div className={styles.text}>{STATUS_MESSAGES[i]}</div>
          </div>
        );
      })}
    </div>
  );
}