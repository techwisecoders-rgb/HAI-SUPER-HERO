// GET /api/categories — public read of all categories with items, sorted.
// If the tables are missing (SQL not run yet), fall back to the bundled seed
// data so the trending page still renders something useful.

import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";
import { CATEGORIES } from "@/content";

export async function GET() {
  try {
    const supabase = getServiceSupabase();
    const [{ data: cats }, { data: items }] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order", { ascending: true }),
      supabase.from("category_items").select("*").order("sort_order", { ascending: true }),
    ]);

    // If the table is empty (e.g. SQL not run), fall back to bundled seed.
    if (!cats || cats.length === 0) {
      return NextResponse.json({ categories: CATEGORIES });
    }

    const merged = cats.map((c) => ({
      ...c,
      items: (items ?? []).filter((i) => i.category_id === c.id),
    }));
    return NextResponse.json({ categories: merged });
  } catch {
    // Tables don't exist yet (SQL migrations not run). Fall back gracefully.
    return NextResponse.json({ categories: CATEGORIES });
  }
}
