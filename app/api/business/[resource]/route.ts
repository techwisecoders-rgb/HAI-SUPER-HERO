import { NextResponse, type NextRequest } from "next/server";
import {
  createResource,
  getResourceConfig,
  listResource,
} from "@/app/api/business/lib";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { resource: string } }) {
  const config = getResourceConfig(params.resource);
  if (!config) return NextResponse.json({ error: "Unknown business resource" }, { status: 404 });
  return listResource(req, config);
}

export async function POST(req: NextRequest, { params }: { params: { resource: string } }) {
  const config = getResourceConfig(params.resource);
  if (!config) return NextResponse.json({ error: "Unknown business resource" }, { status: 404 });
  return createResource(req, config);
}
