// GET /api/popular — public read of popular queries.
// Falls back to bundled seed if the table is empty or missing.

import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";
import { POPULAR_QUERIES } from "@/content";

export async function GET() {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("popular_queries")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error || !data || data.length === 0) {
      return NextResponse.json({ popular: POPULAR_QUERIES });
    }
    return NextResponse.json({ popular: data });
  } catch {
    return NextResponse.json({ popular: POPULAR_QUERIES });
  }
}
