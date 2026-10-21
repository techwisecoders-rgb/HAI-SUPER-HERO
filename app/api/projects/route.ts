// GET /api/projects — public read of all recent projects, ordered by sort_order.
// An optional ?type=users|businesses|workers filters on person_type (admin-side use only;
// the browser GET stays public but is used by the admin dashboard filter tabs).
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceSupabase } from "@/lib/supabase/server";
import { PROJECTS } from "@/content";
import type { ProjectPersonType, Project } from "@/types";

export const runtime = "nodejs";

async function readProjects(): Promise<Project[]> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase.from("projects").select("*").order("sort_order", { ascending: true });
    if (error || !data || data.length === 0) return PROJECTS as unknown as Project[];
    return data as Project[];
  } catch {
    return PROJECTS as unknown as Project[];
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const typeParam = url.searchParams.get("type") ?? undefined;
    let projects = await readProjects();
    if (typeParam && typeParam !== "") {
      const allowed: ProjectPersonType[] = ["users", "businesses", "workers"];
      if (!allowed.includes(typeParam as ProjectPersonType)) {
        return NextResponse.json({ projects: projects });
      }
      projects = projects.filter((p) => p.person_type === typeParam);
    }
    return NextResponse.json({ projects });
  } catch {
    return NextResponse.json({ projects: await readProjects() });
  }
}

const CreateBody = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  image_url: z.string().trim().min(1),
  url: z.string().trim().min(1).max(2000),
  person_type: z.enum(["users", "businesses", "workers"]),
});

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const supabase = getServiceSupabase();
    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid input" }, { status: 400 });
    const { data, error } = await supabase
      .from("projects")
      .insert(parsed.data)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ project: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

const UpdateBody = CreateBody.partial();

export async function PATCH(req: Request): Promise<NextResponse> {
  try {
    const supabase = getServiceSupabase();
    const parsed = UpdateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid input" }, { status: 400 });
    const id = new URL(req.url).pathname.split("/").pop() ?? "";
    const { data, error } = await supabase
      .from("projects")
      .update(parsed.data)
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ project: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request): Promise<NextResponse> {
  try {
    const supabase = getServiceSupabase();
    const id = new URL(req.url).pathname.split("/").pop() ?? "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-...[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "bad id" }, { status: 400 });
    }
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
