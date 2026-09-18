import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type {
  BusinessDeliveryStatus,
  BusinessEntryType,
  BusinessOrderStatus,
  BusinessStatus,
} from "@/types";
import {
  getAuthenticatedBusinessUser,
  getBusinessProfileForUser,
  isUuid,
} from "@/lib/business-auth";
import { getServiceSupabase } from "@/lib/supabase/server";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value === "" ? null : value));

const optionalNumber = () => z.number().nonnegative().optional().nullable();
const optionalBoolean = () => z.boolean().optional();

const ProfileBase = {
  tagline: optionalText(160),
  description: optionalText(5000),
  ownerName: optionalText(160),
  ownerBio: optionalText(2000),
  phone: optionalText(40),
  email: optionalText(254),
  website: optionalText(500),
  address: optionalText(500),
  city: optionalText(120),
  state: optionalText(120),
  postalCode: optionalText(30),
  country: optionalText(120),
  bannerImageUrl: optionalText(1000),
  logoImageUrl: optionalText(1000),
  category: optionalText(120),
  status: z.custom<BusinessStatus>((value) =>
    ["draft", "published", "suspended"].includes(value as string),
  ).optional(),
  workingHours: z.record(z.string(), z.string()).optional().nullable(),
};

export const ProfileCreate = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens")
    .max(120)
    .optional(),
  ...ProfileBase,
});

export const ProfileUpdate = ProfileCreate.partial();

const ListingSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: optionalText(5000),
  imageUrl: optionalText(1000),
  category: optionalText(120),
  price: optionalNumber(),
  priceUnit: optionalText(40),
  active: optionalBoolean(),
  sortOrder: z.number().int().optional(),
});

const DeliveryAreaSchema = z.object({
  area: z.string().trim().min(2).max(180),
  city: optionalText(120),
  state: optionalText(120),
  postalCode: optionalText(30),
  active: optionalBoolean(),
  sortOrder: z.number().int().optional(),
});

const SocialLinkSchema = z.object({
  platform: z.string().trim().min(2).max(80),
  label: optionalText(120),
  url: z.string().trim().min(1).max(1000),
  icon: optionalText(80),
  active: optionalBoolean(),
  sortOrder: z.number().int().optional(),
});

const ReviewSchema = z.object({
  reviewerName: z.string().trim().min(2).max(160),
  rating: z.number().int().min(1).max(5),
  title: optionalText(200),
  body: z.string().trim().min(2).max(5000),
  approved: optionalBoolean(),
});

const StaffRoleSchema = z.object({
  roleName: z.string().trim().min(2).max(160),
  description: optionalText(2000),
  staffCount: z.number().int().nonnegative().optional(),
  active: optionalBoolean(),
  sortOrder: z.number().int().optional(),
});

const EntrySchema = z.object({
  listingId: z.string().uuid().optional().nullable(),
  entryType: z.custom<BusinessEntryType>((value) =>
    ["item", "service", "vacancy"].includes(value as string),
  ).optional(),
  title: z.string().trim().min(2).max(180),
  description: optionalText(5000),
  imageUrl: optionalText(1000),
  price: optionalNumber(),
  active: optionalBoolean(),
  sortOrder: z.number().int().optional(),
});

const OrderItemSchema = z.record(z.string(), z.unknown());
const OrderSchema = z.object({
  customerName: z.string().trim().min(2).max(160),
  customerPhone: z.string().trim().min(5).max(40),
  customerEmail: optionalText(254),
  address: z.string().trim().min(5).max(500),
  items: z.array(OrderItemSchema).min(1).max(100),
  totalAmount: z.number().nonnegative().optional(),
  status: z.custom<BusinessOrderStatus>((value) =>
    ["pending", "accepted", "declined", "completed", "cancelled"].includes(value as string),
  ).optional(),
  deliveryStatus: z.custom<BusinessDeliveryStatus>((value) =>
    ["unassigned", "assigned", "out_for_delivery", "delivered"].includes(value as string),
  ).optional(),
  deliveryBoyName: optionalText(160),
  notes: optionalText(5000),
});

type ResourceName =
  | "listings"
  | "delivery-areas"
  | "social-links"
  | "reviews"
  | "staff"
  | "entries"
  | "orders";

interface ResourceConfig {
  table: string;
  schema: z.AnyZodObject;
  sort?: "sort_order" | "created_at";
  toRow: (input: Record<string, unknown>, businessId: string) => Record<string, unknown>;
  validate?: (input: Record<string, unknown>, businessId: string) => Promise<string | null>;
}

const resources = {
  listings: {
    table: "business_listings",
    schema: ListingSchema,
    sort: "sort_order" as const,
    toRow: (input, businessId) => ({
      business_id: businessId,
      title: input.title,
      description: input.description ?? null,
      image_url: input.imageUrl ?? null,
      category: input.category ?? null,
      price: input.price ?? null,
      price_unit: input.priceUnit ?? null,
      active: input.active ?? true,
      sort_order: input.sortOrder ?? 0,
    }),
  },
  "delivery-areas": {
    table: "business_delivery_areas",
    schema: DeliveryAreaSchema,
    sort: "sort_order" as const,
    toRow: (input, businessId) => ({
      business_id: businessId,
      area: input.area,
      city: input.city ?? null,
      state: input.state ?? null,
      postal_code: input.postalCode ?? null,
      active: input.active ?? true,
      sort_order: input.sortOrder ?? 0,
    }),
  },
  "social-links": {
    table: "business_social_links",
    schema: SocialLinkSchema,
    sort: "sort_order" as const,
    toRow: (input, businessId) => ({
      business_id: businessId,
      platform: input.platform,
      label: input.label ?? null,
      url: input.url,
      icon: input.icon ?? null,
      active: input.active ?? true,
      sort_order: input.sortOrder ?? 0,
    }),
  },
  reviews: {
    table: "business_reviews",
    schema: ReviewSchema,
    sort: "created_at" as const,
    toRow: (input, businessId) => ({
      business_id: businessId,
      reviewer_name: input.reviewerName,
      rating: input.rating,
      title: input.title ?? null,
      body: input.body,
      approved: input.approved ?? false,
    }),
  },
  staff: {
    table: "business_staff_roles",
    schema: StaffRoleSchema,
    sort: "sort_order" as const,
    toRow: (input, businessId) => ({
      business_id: businessId,
      role_name: input.roleName,
      description: input.description ?? null,
      staff_count: input.staffCount ?? 1,
      active: input.active ?? true,
      sort_order: input.sortOrder ?? 0,
    }),
  },
  entries: {
    table: "business_entries",
    schema: EntrySchema,
    sort: "sort_order" as const,
    toRow: (input, businessId) => ({
      business_id: businessId,
      listing_id: input.listingId ?? null,
      entry_type: input.entryType ?? "item",
      title: input.title,
      description: input.description ?? null,
      image_url: input.imageUrl ?? null,
      price: input.price ?? null,
      active: input.active ?? true,
      sort_order: input.sortOrder ?? 0,
    }),
    validate: async (input, businessId) => {
      if (!input.listingId) return null;
      const supabase = getServiceSupabase();
      const { data, error } = await supabase
        .from("business_listings")
        .select("id")
        .eq("id", input.listingId)
        .eq("business_id", businessId)
        .maybeSingle();
      if (error) return "Could not validate listing";
      return data ? null : "Listing does not belong to this business";
    },
  },
  orders: {
    table: "business_orders",
    schema: OrderSchema,
    sort: "created_at" as const,
    toRow: (input, businessId) => ({
      business_id: businessId,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      customer_email: input.customerEmail ?? null,
      address: input.address,
      items: input.items,
      total_amount: input.totalAmount ?? 0,
      status: input.status ?? "pending",
      delivery_status: input.deliveryStatus ?? "unassigned",
      delivery_boy_name: input.deliveryBoyName ?? null,
      notes: input.notes ?? null,
    }),
  },
} satisfies Record<ResourceName, ResourceConfig>;

export type BusinessResourceName = keyof typeof resources;

export function getResourceConfig(name: string): ResourceConfig | null {
  return (resources as Record<string, ResourceConfig>)[name] ?? null;
}

export async function requireBusinessOwner(req: NextRequest) {
  const user = await getAuthenticatedBusinessUser(req);
  if (!user) {
    return {
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }
  const profile = await getBusinessProfileForUser(user.id);
  if (!profile) {
    return {
      response: NextResponse.json(
        { error: "Create your business profile before managing this section" },
        { status: 404 },
      ),
    };
  }
  return { user, profile };
}

export async function listResource(req: NextRequest, config: ResourceConfig) {
  const owner = await requireBusinessOwner(req);
  if ("response" in owner) return owner.response;
  const supabase = getServiceSupabase();
  const query = supabase.from(config.table as never).select("*").eq("business_id", owner.profile.id);
  const ordered =
    config.sort === "created_at"
      ? query.order("created_at", { ascending: false })
      : query
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false });
  const { data, error } = await ordered;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function createResource(req: NextRequest, config: ResourceConfig) {
  const owner = await requireBusinessOwner(req);
  if ("response" in owner) return owner.response;
  const json = await req.json().catch(() => null);
  const parsed = config.schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const input = parsed.data as Record<string, unknown>;
  const validationError = await config.validate?.(input, owner.profile.id);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from(config.table as never)
    .insert(config.toRow(input, owner.profile.id) as never)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}

function toUpdateRow(config: ResourceConfig, input: Record<string, unknown>) {
  const row: Record<string, unknown> = {};
  const maps: Record<string, Record<string, string>> = {
    business_listings: {
      title: "title", description: "description", imageUrl: "image_url",
      category: "category", price: "price", priceUnit: "price_unit",
      active: "active", sortOrder: "sort_order",
    },
    business_delivery_areas: {
      area: "area", city: "city", state: "state", postalCode: "postal_code",
      active: "active", sortOrder: "sort_order",
    },
    business_social_links: {
      platform: "platform", label: "label", url: "url", icon: "icon",
      active: "active", sortOrder: "sort_order",
    },
    business_reviews: {
      reviewerName: "reviewer_name", rating: "rating", title: "title",
      body: "body", approved: "approved",
    },
    business_staff_roles: {
      roleName: "role_name", description: "description", staffCount: "staff_count",
      active: "active", sortOrder: "sort_order",
    },
    business_entries: {
      listingId: "listing_id", entryType: "entry_type", title: "title",
      description: "description", imageUrl: "image_url", price: "price",
      active: "active", sortOrder: "sort_order",
    },
    business_orders: {
      customerName: "customer_name", customerPhone: "customer_phone",
      customerEmail: "customer_email", address: "address", items: "items",
      totalAmount: "total_amount", status: "status",
      deliveryStatus: "delivery_status", deliveryBoyName: "delivery_boy_name",
      notes: "notes",
    },
  };
  const map = maps[config.table] ?? {};
  for (const [key, db] of Object.entries(map)) {
    if (key in input && input[key] !== undefined) row[db] = input[key] ?? null;
  }
  return row;
}

export async function updateResource(
  req: NextRequest,
  config: ResourceConfig,
  id: string,
) {
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid record id" }, { status: 400 });
  const owner = await requireBusinessOwner(req);
  if ("response" in owner) return owner.response;
  const json = await req.json().catch(() => null);
  const parsed = config.schema.partial().safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const input = parsed.data as Record<string, unknown>;
  const validationError = await config.validate?.(input, owner.profile.id);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  const supabase = getServiceSupabase();
  const existing = await supabase
    .from(config.table as never)
    .select("id")
    .eq("id", id)
    .eq("business_id", owner.profile.id)
    .maybeSingle();
  if (existing.error || !existing.data) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }
  const { data, error } = await supabase
    .from(config.table as never)
    .update(toUpdateRow(config, input) as never)
    .eq("id", id)
    .eq("business_id", owner.profile.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function deleteResource(
  req: NextRequest,
  config: ResourceConfig,
  id: string,
) {
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid record id" }, { status: 400 });
  const owner = await requireBusinessOwner(req);
  if ("response" in owner) return owner.response;
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from(config.table as never)
    .delete()
    .eq("id", id)
    .eq("business_id", owner.profile.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "business"
  );
}

export async function createUniqueSlug(name: string, userId: string) {
  const base = slugify(name);
  const candidate = `${base}-${userId.slice(0, 8)}`;
  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from("business_profiles")
    .select("id")
    .eq("slug", candidate)
    .maybeSingle();
  return data ? `${candidate}-${Date.now().toString(36)}` : candidate;
}
