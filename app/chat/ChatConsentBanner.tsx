"use client";

import { CookieBanner } from "@/components/CookieBanner";

export default function ChatConsentBanner() {
  return (
    <CookieBanner
      onAccepted={() => {
        window.dispatchEvent(new Event("hai-consent-accepted"));
      }}
    />
  );
}
