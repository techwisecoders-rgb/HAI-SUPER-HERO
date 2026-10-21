// GET  /api/businesses/[id] — admin-only detail for a single business.
// PATCH /api/businesses/[id] — admin-only update of a single business.
//
// The record is always addressed by its unique database id.

import { NextResponse, type NextRequest } from "next/server";
import { withAdmin, isUuid } from "@/lib/admin/http";
import { getBusinessById } from "@/lib/admin/directory";
import { BusinessUpdateBody, updateBusiness } from "@/lib/admin/updates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Context) {
  return withAdmin(async () => {
    if (!isUuid(params.id)) {
      return NextResponse.json({ error: "Invalid business id" }, { status: 400 });
    }
    const business = await getBusinessById(params.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }
    return NextResponse.json({ business });
  });
}

export async function PATCH(req: NextRequest, { params }: Context) {
  return withAdmin(async () => {
    if (!isUuid(params.id)) {
      return NextResponse.json({ error: "Invalid business id" }, { status: 400 });
    }

    const parsed = BusinessUpdateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid business data" },
        { status: 400 },
      );
    }

    const business = await updateBusiness(params.id, parsed.data);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }
    return NextResponse.json({ business });
  });
}
