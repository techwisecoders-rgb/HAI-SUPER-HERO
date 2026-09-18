// GET /api/projects — public read of projects.
// Falls back to bundled seed if the table is empty or missing.

import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";
import { PROJECTS } from "@/content";

export async function GET() {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error || !data || data.length === 0) {
      return NextResponse.json({ projects: PROJECTS });
    }
    return NextResponse.json({ projects: data });
  } catch {
    return NextResponse.json({ projects: PROJECTS });
  }
}
