// Edge middleware: protects /admin/* routes by checking for a Supabase
// auth session cookie. If absent, redirects to /admin/login.
//
// NOTE: this only checks for the *presence* of the Supabase auth cookie.
// Real auth validation (JWT verification) happens in route handlers and
// server components via getServerSupabase().getUser().

import { NextResponse, type NextRequest } from "next/server";

const SUPABASE_COOKIE_RE = /^sb-[^-]+-auth-token$/;

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
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
