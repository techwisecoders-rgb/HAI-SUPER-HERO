// /admin — server entry point.
//
// The session is verified *on the server* before anything is rendered: a
// request without a valid administrator session is redirected to the
// existing admin login page. This keeps the dashboard protected on a
// browser refresh, not just on first navigation.

import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/admin/guard";
import { AdminDashboard } from "./dashboard";

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams?: { session?: string | string[] };
}) {
  const admin = await getAdmin();
  if (!admin) {
    // Preserve the deep link (e.g. /admin?session=<uuid>, used by the
    // Telegram notification) across the login round-trip so the admin
    // lands on the right conversation.
    const raw = searchParams?.session;
    const session = Array.isArray(raw) ? raw[0] : raw;
    const next = session
      ? `/admin?session=${encodeURIComponent(session)}`
      : "/admin";
    redirect(`/admin/login?next=${encodeURIComponent(next)}`);
  }

  return <AdminDashboard adminEmail={admin.email} />;
}
