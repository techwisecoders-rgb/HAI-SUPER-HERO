import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HAI SUPER HERO",
  description: "HAI SUPER HERO — the next generation of human + AI companionship.",
  // Static SVG icon — generated at build time from public/icon.svg.
  // Used as the favicon and as the icon shown in OS-level push
  // notifications (Notification API picks up the smallest declared icon).
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
