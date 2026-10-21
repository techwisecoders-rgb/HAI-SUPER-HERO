// GET /api/workers/list — admin-only list of every worker profile.
//
// Protected by lib/admin/guard.ts: the caller must present a valid
// Supabase Auth session that resolves to an administrator. Worker and
// business owners use the separate `app_users` cookie system and therefore
// cannot pass this check.

import { NextResponse, type NextRequest } from "next/server";
import { withAdmin } from "@/lib/admin/http";
import { WorkerListQuery, listWorkers } from "@/lib/admin/directory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withAdmin(async () => {
    const { searchParams } = new URL(req.url);
    const raw = Object.fromEntries(searchParams.entries());

    const parsed = WorkerListQuery.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid query parameters" },
        { status: 400 },
      );
    }

    const result = await listWorkers(parsed.data);
    return NextResponse.json(result);
  });
}
