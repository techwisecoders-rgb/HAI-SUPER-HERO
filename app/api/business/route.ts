import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedBusinessUser, getBusinessProfileForUser } from "@/lib/business-auth";
import { getServiceSupabase } from "@/lib/supabase/server";
import { ProfileCreate, createUniqueSlug } from "@/app/api/business/lib";

export const runtime = "nodejs";

const RESOURCE_TABLES = {
  listings: "business_listings",
  delivery_areas: "business_delivery_areas",
  social_links: "business_social_links",
  reviews: "business_reviews",
  staff_roles: "business_staff_roles",
  entries: "business_entries",
  orders: "business_orders",
} as const;

function profileToDb(input: z.infer<typeof ProfileCreate>, userId: string, slug: string) {
  return {
    user_id: userId,
    slug,
    name: input.name,
    tagline: input.tagline ?? null,
    description: input.description ?? null,
    owner_name: input.ownerName ?? null,
    owner_bio: input.ownerBio ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    website: input.website ?? null,
    address: input.address ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    postal_code: input.postalCode ?? null,
    country: input.country ?? null,
    banner_image_url: input.bannerImageUrl ?? null,
    logo_image_url: input.logoImageUrl ?? null,
    category: input.category ?? null,
    status: input.status ?? "draft",
    working_hours: input.workingHours ?? {},
    published_at: input.status === "published" ? new Date().toISOString() : null,
  };
}

function updateProfileToDb(input: Record<string, unknown>) {
  const row: Record<string, unknown> = {};
  const fields: Record<string, string> = {
    name: "name",
    slug: "slug",
    tagline: "tagline",
    description: "description",
    ownerName: "owner_name",
    ownerBio: "owner_bio",
    phone: "phone",
    email: "email",
    website: "website",
    address: "address",
    city: "city",
    state: "state",
    postalCode: "postal_code",
    country: "country",
    bannerImageUrl: "banner_image_url",
    logoImageUrl: "logo_image_url",
    category: "category",
    status: "status",
    workingHours: "working_hours",
  };
  for (const [clientKey, dbKey] of Object.entries(fields)) {
    if (!(clientKey in input)) continue;
    const value = input[clientKey];
    row[dbKey] = dbKey === "working_hours" ? (value ?? {}) : value;
  }
  if ("status" in input) {
    row.published_at = input.status === "published" ? new Date().toISOString() : null;
  }
  return row;
}

async function aggregate(profile: Awaited<ReturnType<typeof getBusinessProfileForUser>>) {
  const supabase = getServiceSupabase();
  const entries = await Promise.all(
    Object.entries(RESOURCE_TABLES).map(async ([key, table]) => {
      const recent = key === "reviews" || key === "orders";
      const order = recent ? "created_at" : "sort_order";
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("business_id", profile!.id)
        .order(order, { ascending: !recent });
      return [key, error ? [] : (data ?? [])] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedBusinessUser(req);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const profile = await getBusinessProfileForUser(user.id);
  if (!profile) return NextResponse.json({ profile: null });
  const data = await aggregate(profile);
  return NextResponse.json({
    profile,
    listings: data.listings,
    delivery_areas: data.delivery_areas,
    social_links: data.social_links,
    reviews: data.reviews,
    staff_roles: data.staff_roles,
    entries: data.entries,
    orders: data.orders,
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedBusinessUser(req);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const existing = await getBusinessProfileForUser(user.id);
  if (existing) return NextResponse.json({ error: "Business profile already exists" }, { status: 409 });
  const parsed = ProfileCreate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const slug = await createUniqueSlug(parsed.data.name, user.id);
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("business_profiles")
    .insert(profileToDb(parsed.data, user.id, slug) as never)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthenticatedBusinessUser(req);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const profile = await getBusinessProfileForUser(user.id);
  if (!profile) return NextResponse.json({ error: "Business profile not found" }, { status: 404 });
  const json = await req.json().catch(() => null);
  const parsed = ProfileCreate.partial().safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("business_profiles")
    .update(updateProfileToDb(parsed.data) as never)
    .eq("id", profile.id)
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedBusinessUser(req);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const profile = await getBusinessProfileForUser(user.id);
  if (!profile) return NextResponse.json({ error: "Business profile not found" }, { status: 404 });
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("business_profiles")
    .delete()
    .eq("id", profile.id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
