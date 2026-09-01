import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HAI SUPER HERO",
  description: "HAI SUPER HERO — the next generation of human + AI companionship.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
