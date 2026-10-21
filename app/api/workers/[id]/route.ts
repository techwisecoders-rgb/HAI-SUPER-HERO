// GET  /api/workers/[id] — admin-only detail for a single worker profile.
// PATCH /api/workers/[id] — admin-only update of a single worker profile.
//
// The record is always addressed by its unique database id.

import { NextResponse, type NextRequest } from "next/server";
import { withAdmin, isUuid } from "@/lib/admin/http";
import { getWorkerById } from "@/lib/admin/directory";
import { WorkerUpdateBody, updateWorker } from "@/lib/admin/updates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Context) {
  return withAdmin(async () => {
    if (!isUuid(params.id)) {
      return NextResponse.json({ error: "Invalid worker id" }, { status: 400 });
    }
    const worker = await getWorkerById(params.id);
    if (!worker) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }
    return NextResponse.json({ worker });
  });
}

export async function PATCH(req: NextRequest, { params }: Context) {
  return withAdmin(async () => {
    if (!isUuid(params.id)) {
      return NextResponse.json({ error: "Invalid worker id" }, { status: 400 });
    }

    const parsed = WorkerUpdateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid worker data" },
        { status: 400 },
      );
    }

    const worker = await updateWorker(params.id, parsed.data);
    if (!worker) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }
    return NextResponse.json({ worker });
  });
}
