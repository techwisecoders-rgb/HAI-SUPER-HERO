import { NextResponse, type NextRequest } from "next/server";
import {
  deleteResource,
  getResourceConfig,
  updateResource,
} from "@/app/api/business/lib";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { resource: string; id: string } },
) {
  const config = getResourceConfig(params.resource);
  if (!config) return NextResponse.json({ error: "Unknown business resource" }, { status: 404 });
  return updateResource(req, config, params.id);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { resource: string; id: string } },
) {
  const config = getResourceConfig(params.resource);
  if (!config) return NextResponse.json({ error: "Unknown business resource" }, { status: 404 });
  return deleteResource(req, config, params.id);
}
