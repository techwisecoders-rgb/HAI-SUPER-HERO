// Admin update operations for worker and business profiles.
//
// Every payload is validated with Zod on the server and only the columns
// that exist in the live schema are written. System-managed columns
// (id, user_id, session_id, created_at, updated_at, rating_average,
// review_count, published_at) are never writable from the dashboard.

import { z } from "zod";
import { getServiceSupabase } from "@/lib/supabase/server";
import { isUuid } from "@/lib/admin/http";
import type { BusinessProfileRecord, WorkerProfileRecord } from "@/types";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value === "" ? null : value));

const optionalUrl = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value === "" ? null : value));

/** Accepts a plain http(s) URL or a bare host such as "www.example.com". */
const urlLike = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((value) => {
    if (value === "" || value === undefined) return null;
    return value;
  })
  .refine(
    (value) => {
      if (value === null) return true;
      if (/^https?:\/\//i.test(value)) {
        try {
          const url = new URL(value);
          return url.protocol === "http:" || url.protocol === "https:";
        } catch {
          return false;
        }
      }
      // A bare host like "www.example.com" is accepted.
      return /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(value);
    },
    { message: "Enter a valid URL" },
  );

export const WorkerUpdateBody = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z
      .string()
      .trim()
      .email("Enter a valid email address")
      .max(254)
      .optional()
      .nullable()
      .transform((value) => (value === "" ? null : value)),
    phone: z.string().trim().max(40).optional(),
    location: z.string().trim().max(500).optional(),
    qualification: z.string().trim().max(200).optional(),
    experience: z.string().trim().max(80).optional(),
    profession: z.string().trim().min(1).max(100).optional(),
    profileImageUrl: urlLike,
    backgroundImageUrl: urlLike,
    workAvailable: z.boolean().optional(),
    skills: z.array(z.string().trim().max(200)).max(100).optional(),
    aboutText: z.string().trim().max(10000).optional(),
    workDescription: z.string().trim().max(10000).optional(),
    resumeUrl: urlLike,
    socialLinks: z
      .array(
        z.object({
          label: z.string().trim().max(120).optional(),
          url: z.string().trim().max(2000).optional(),
        }),
      )
      .max(100)
      .optional(),
    rating: z.coerce.number().min(0).max(5).optional(),
    jobsDone: z.coerce.number().int().min(0).max(100000000).optional(),
  })
  .strict();

export type WorkerUpdateInput = z.infer<typeof WorkerUpdateBody>;

const WORKER_COLUMN_MAP: Record<string, string> = {
  name: "name",
  email: "email",
  phone: "phone",
  location: "location",
  qualification: "qualification",
  experience: "experience",
  profession: "profession",
  profileImageUrl: "profile_image_url",
  backgroundImageUrl: "background_image_url",
  workAvailable: "work_available",
  skills: "skills",
  aboutText: "about_text",
  workDescription: "work_description",
  resumeUrl: "resume_url",
  socialLinks: "social_links",
  rating: "rating",
  jobsDone: "jobs_done",
};

export async function updateWorker(
  id: string,
  input: WorkerUpdateInput,
): Promise<WorkerProfileRecord | null> {
  if (!isUuid(id)) return null;

  const row: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(WORKER_COLUMN_MAP)) {
    if (!(key in input)) continue;
    const value = (input as Record<string, unknown>)[key];
    if (value === undefined) continue;
    row[column] = value;
  }
  if (Object.keys(row).length === 0) {
    // Nothing to change — return the record untouched.
    const { data, error } = await getServiceSupabase()
      .from("worker_profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as WorkerProfileRecord | null) ?? null;
  }

  const { data, error } = await getServiceSupabase()
    .from("worker_profiles")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as WorkerProfileRecord | null) ?? null;
}

// ---------- businesses ----------

export const BusinessUpdateBody = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens")
      .max(120)
      .optional(),
    tagline: optionalText(160),
    description: optionalText(5000),
    ownerName: optionalText(160),
    ownerBio: optionalText(2000),
    phone: optionalText(40),
    email: z
      .string()
      .trim()
      .email("Enter a valid email address")
      .max(254)
      .optional()
      .nullable()
      .transform((value) => (value === "" ? null : value)),
    website: urlLike,
    address: optionalText(500),
    city: optionalText(120),
    state: optionalText(120),
    postalCode: optionalText(30),
    country: optionalText(120),
    bannerImageUrl: urlLike,
    logoImageUrl: urlLike,
    category: optionalText(120),
    status: z.enum(["draft", "published", "suspended"]).optional(),
    workingHours: z.record(z.string(), z.string()).optional().nullable(),
  })
  .strict();

export type BusinessUpdateInput = z.infer<typeof BusinessUpdateBody>;

const BUSINESS_COLUMN_MAP: Record<string, string> = {
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

export async function updateBusiness(
  id: string,
  input: BusinessUpdateInput,
): Promise<BusinessProfileRecord | null> {
  if (!isUuid(id)) return null;

  const row: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(BUSINESS_COLUMN_MAP)) {
    if (!(key in input)) continue;
    const value = (input as Record<string, unknown>)[key];
    if (value === undefined) continue;
    row[column] = value;
  }
  if (Object.keys(row).length === 0) {
    const { data, error } = await getServiceSupabase()
      .from("business_profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as BusinessProfileRecord | null) ?? null;
  }

  const { data, error } = await getServiceSupabase()
    .from("business_profiles")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BusinessProfileRecord | null) ?? null;
}
