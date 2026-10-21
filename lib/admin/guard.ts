// Server-side authorization guard for every admin-only entry point.
//
// Administrators authenticate with Supabase Auth (app/admin/login/page.tsx).
// Worker and business owners use a completely different mechanism (the
// `app_users` table + the `accompany_app_user` cookie — see
// lib/business-auth.ts), so they never hold a Supabase Auth session and can
// therefore never satisfy the session check below.
//
// Two independent, server-side checks are performed:
//
//   1. Session: `auth.getUser()` asks Supabase to validate the JWT that the
//      browser sent. A forged or absent cookie cannot pass this.
//   2. Entitlement: the role claim is read from the *server's* copy of the
//      user record. `app_metadata` is only writable with the service-role
//      key, so it is the trusted location for a role claim.
//
// Policy, chosen to stay compatible with the existing `public.is_admin()`
// Postgres function (which treats any authenticated Supabase user as an
// admin because admin accounts are provisioned in the Supabase dashboard and
// there is no public sign-up):
//
//   * If ADMIN_EMAILS is set, it is authoritative — only those accounts pass.
//   * Otherwise a user that carries an explicit *non*-admin role claim is
//     rejected (403), and every other authenticated user keeps working.
//
// Nothing here trusts a client-side flag, a browser-editable cookie, or the
// mere presence of a cookie.

import { getServerSupabase } from "@/lib/supabase/server-user";

export class AdminAuthError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "AdminAuthError";
    this.code = code;
    this.status = status;
  }
}

export interface AdminUser {
  id: string;
  email: string | null;
}

interface RoleBearingUser {
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}

/** Read a role claim out of the user record. */
function roleClaim(user: RoleBearingUser): string {
  const appMeta = user.app_metadata ?? {};
  const appRole = appMeta.role ?? appMeta.is_admin;
  if (appRole === true) return "admin";
  if (typeof appRole === "string" && appRole.trim()) return appRole.trim().toLowerCase();

  const userMeta = user.user_metadata ?? {};
  const userRole = userMeta.role;
  if (typeof userRole === "string" && userRole.trim()) return userRole.trim().toLowerCase();

  return "";
}

/**
 * Optional allow-list of admin e-mail addresses (comma separated).
 * When provided it becomes the single source of truth.
 */
function adminEmailAllowList(): string[] {
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Decide whether an already-authenticated user may act as an administrator.
 * `user` must be the record returned by Supabase (server-side lookup).
 */
export function isAdminEntitled(user: RoleBearingUser): boolean {
  const allowList = adminEmailAllowList();
  if (allowList.length > 0) {
    const email = (user.email ?? "").trim().toLowerCase();
    return email.length > 0 && allowList.includes(email);
  }

  // No allow-list configured: fall back to the project's existing
  // `public.is_admin()` semantics, but honour an explicit non-admin role.
  const role = roleClaim(user);
  if (role && role !== "admin") return false;
  return true;
}

/**
 * Require a verified administrator.
 * Throws AdminAuthError(401) without a valid session and (403) for an
 * authenticated user without admin entitlement.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const sb = getServerSupabase();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) {
    throw new AdminAuthError("not_authenticated", "Authentication required", 401);
  }

  const user = data.user;
  if (!isAdminEntitled(user)) {
    throw new AdminAuthError("not_authorized", "Administrator privileges required", 403);
  }

  return { id: user.id, email: user.email ?? null };
}

/** Same as `requireAdmin` but never throws. */
export async function getAdmin(): Promise<AdminUser | null> {
  try {
    return await requireAdmin();
  } catch {
    return null;
  }
}
