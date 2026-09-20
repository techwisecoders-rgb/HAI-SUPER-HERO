"use client";

// useKeyboardAwareInput
// Faithful React port of the original vanilla `visualViewport` listener that
// keeps the chat input bar above the on-screen mobile keyboard. Returns a ref
// to attach to the bar element. Component-scoped — cleanup on unmount is
// automatic (fixes the original's setInterval-leak via global checks).

import { useEffect, useRef } from "react";

export function useKeyboardAwareInput<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const el = ref.current;
    if (!el) return;

    const reposition = () => {
      const vv = (window as unknown as { visualViewport?: VisualViewport }).visualViewport;
      if (!vv) return;
      // dvh already accounts for the keyboard in modern browsers; we use
      // visualViewport to nudge the bar up by the difference just in case.
      const offset = window.innerHeight - vv.height;
      el.style.transform = offset > 0 ? `translateY(${-offset}px)` : "";
    };

    const vv = (window as unknown as { visualViewport?: VisualViewport }).visualViewport;
    if (vv) {
      vv.addEventListener("resize", reposition);
      vv.addEventListener("scroll", reposition);
    }
    window.addEventListener("resize", reposition);
    reposition();

    return () => {
      if (vv) {
        vv.removeEventListener("resize", reposition);
        vv.removeEventListener("scroll", reposition);
      }
      window.removeEventListener("resize", reposition);
    };
  }, []);

  return ref;
}
