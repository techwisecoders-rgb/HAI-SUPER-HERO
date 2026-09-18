// Admin layout — applies to /admin and /admin/login. Keeps the consumer
// theme but uses a calmer "internal tool" feel.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HAI SUPER HERO · Admin",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh text-white/90">
      {children}
    </div>
  );
}
