// GET /api/businesses/list — admin-only list of every business profile.
//
// Protected by lib/admin/guard.ts: the caller must present a valid
// Supabase Auth session that resolves to an administrator. Business owners
// use the separate `app_users` cookie system and therefore cannot pass
// this check.

import { NextResponse, type NextRequest } from "next/server";
import { withAdmin } from "@/lib/admin/http";
import { BusinessListQuery, listBusinesses } from "@/lib/admin/directory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withAdmin(async () => {
    const { searchParams } = new URL(req.url);
    const raw = Object.fromEntries(searchParams.entries());

    const parsed = BusinessListQuery.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid query parameters" },
        { status: 400 },
      );
    }

    const result = await listBusinesses(parsed.data);
    return NextResponse.json(result);
  });
}
