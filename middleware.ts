// Edge middleware: protects /admin/* routes.
//
// The cookie check below is only a fast pre-filter. The authoritative
// checks are server-side:
//   * app/admin/page.tsx verifies the session before rendering.
//   * Every admin server action and API route calls requireAdmin()
//     (lib/admin/guard.ts), which validates the JWT with Supabase.
//
// Because a signed-out admin must not be able to reach the dashboard by
// refreshing the page, the presence check is enough to bounce an anonymous
// visitor to the login screen; a stale/invalid cookie is rejected by the
// server-side guards.

import { NextResponse, type NextRequest } from "next/server";

// Supabase may split the session cookie into chunks (…-auth-token.0, .1).
const SUPABASE_COOKIE_RE = /^sb-[^-]+-auth-token(\.\d+)?$/;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  // Allow the login page itself.
  if (pathname === "/admin/login") return NextResponse.next();

  const cookies = req.cookies.getAll();
  const hasAuth = cookies.some((c) => SUPABASE_COOKIE_RE.test(c.name) && c.value);
  if (hasAuth) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  // Keep the query string (e.g. ?session=<uuid> from the Telegram
  // notification deep link) so the admin lands on the right screen
  // after signing in.
  url.searchParams.set("next", `${pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
