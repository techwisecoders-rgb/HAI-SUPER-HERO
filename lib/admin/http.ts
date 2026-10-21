// Helpers shared by the admin API routes: consistent error responses and
// a single place where the admin entitlement is enforced.

import { NextResponse } from "next/server";
import { AdminAuthError, requireAdmin, type AdminUser } from "@/lib/admin/guard";

export interface ApiErrorBody {
  error: string;
  code?: string;
}

/** Convert any thrown value into a structured JSON error response. */
export function toErrorResponse(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof AdminAuthError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * Run `handler` with a verified administrator, mapping any failure to a
 * structured error response. Every admin read/write endpoint must go
 * through this helper.
 */
export async function withAdmin(
  handler: (admin: AdminUser) => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    const admin = await requireAdmin();
    return await handler(admin);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Reject a non-UUID identifier before it reaches the database. */
export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}
