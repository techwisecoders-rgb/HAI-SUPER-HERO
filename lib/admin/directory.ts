// Admin read/write helpers for worker and business profiles.
//
// Data access uses the existing server-side Supabase client (service role),
// which is the data-access pattern already used across this project — see
// app/admin/actions.ts, app/api/worker/profile/route.ts and
// app/api/business/route.ts. The Prisma schema in prisma/schema.prisma
// documents the same two tables; no second source of truth is introduced.
//
// The tables are the real ones:
//   worker_profiles    (supabase/migrations/0020_worker_profiles.sql)
//   business_profiles  (supabase/migrations/0018_business_hub.sql)

import { z } from "zod";
import { getServiceSupabase } from "@/lib/supabase/server";
import { isUuid } from "@/lib/admin/http";
import type {
  BusinessProfileRecord,
  PagedResult,
  WorkerProfileRecord,
} from "@/types";

export type { BusinessProfileRecord, PagedResult, WorkerProfileRecord };

export const MAX_PER_PAGE = 100;
export const DEFAULT_PER_PAGE = 20;

// ---------- list query parsing ----------

const SORTABLE_WORKER_COLUMNS = [
  "created_at",
  "updated_at",
  "name",
  "email",
  "phone",
  "location",
  "profession",
  "rating",
  "jobs_done",
] as const;

const SORTABLE_BUSINESS_COLUMNS = [
  "created_at",
  "updated_at",
  "name",
  "email",
  "phone",
  "city",
  "category",
  "status",
  "rating_average",
] as const;

export const WorkerListQuery = z.object({
  search: z.string().trim().max(200).optional(),
  profession: z.string().trim().max(100).optional(),
  location: z.string().trim().max(200).optional(),
  availability: z.enum(["all", "available", "unavailable"]).optional(),
  sort: z.enum(SORTABLE_WORKER_COLUMNS).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).max(100000).optional(),
  perPage: z.coerce.number().int().min(1).max(MAX_PER_PAGE).optional(),
});

export const BusinessListQuery = z.object({
  search: z.string().trim().max(200).optional(),
  category: z.string().trim().max(100).optional(),
  location: z.string().trim().max(200).optional(),
  status: z.enum(["all", "draft", "published", "suspended"]).optional(),
  sort: z.enum(SORTABLE_BUSINESS_COLUMNS).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).max(100000).optional(),
  perPage: z.coerce.number().int().min(1).max(MAX_PER_PAGE).optional(),
});

export type WorkerListInput = z.infer<typeof WorkerListQuery>;
export type BusinessListInput = z.infer<typeof BusinessListQuery>;

/** Escape the characters that are special inside a PostgREST `or=` filter. */
function escapeLikeValue(value: string): string {
  return value.replace(/[%_\\,()]/g, (match) => `\\${match}`);
}

// ---------- workers ----------

export async function listWorkers(
  input: WorkerListInput,
): Promise<PagedResult<WorkerProfileRecord>> {
  const supabase = getServiceSupabase();
  const page = input.page ?? 1;
  const perPage = input.perPage ?? DEFAULT_PER_PAGE;
  const search = input.search?.trim();
  const profession = input.profession?.trim();
  const location = input.location?.trim();
  const availability = input.availability ?? "all";
  const sort = input.sort ?? "created_at";
  const order = input.order ?? "desc";

  let query = supabase
    .from("worker_profiles")
    .select("*", { count: "exact" })
    .order(sort, { ascending: order === "asc" })
    .range((page - 1) * perPage, page * perPage - 1);

  if (search) {
    const term = escapeLikeValue(search);
    // `or=` supports ILIKE on each searchable column.
    query = query.or(
      [
        `name.ilike.%${term}%`,
        `email.ilike.%${term}%`,
        `phone.ilike.%${term}%`,
        `profession.ilike.%${term}%`,
        `location.ilike.%${term}%`,
      ].join(","),
    );
  }
  if (profession) query = query.eq("profession", profession);
  if (location) query = query.ilike("location", `%${escapeLikeValue(location)}%`);
  if (availability === "available") query = query.eq("work_available", true);
  if (availability === "unavailable") query = query.eq("work_available", false);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    items: (data ?? []) as WorkerProfileRecord[],
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getWorkerById(id: string): Promise<WorkerProfileRecord | null> {
  if (!isUuid(id)) return null;
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("worker_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as WorkerProfileRecord | null) ?? null;
}

// ---------- businesses ----------

export async function listBusinesses(
  input: BusinessListInput,
): Promise<PagedResult<BusinessProfileRecord>> {
  const supabase = getServiceSupabase();
  const page = input.page ?? 1;
  const perPage = input.perPage ?? DEFAULT_PER_PAGE;
  const search = input.search?.trim();
  const category = input.category?.trim();
  const location = input.location?.trim();
  const status = input.status ?? "all";
  const sort = input.sort ?? "created_at";
  const order = input.order ?? "desc";

  let query = supabase
    .from("business_profiles")
    .select("*", { count: "exact" })
    .order(sort, { ascending: order === "asc" })
    .range((page - 1) * perPage, page * perPage - 1);

  if (search) {
    const term = escapeLikeValue(search);
    query = query.or(
      [
        `name.ilike.%${term}%`,
        `email.ilike.%${term}%`,
        `phone.ilike.%${term}%`,
        `owner_name.ilike.%${term}%`,
        `category.ilike.%${term}%`,
        `city.ilike.%${term}%`,
      ].join(","),
    );
  }
  if (category) query = query.eq("category", category);
  if (location) {
    const term = escapeLikeValue(location);
    query = query.or([`city.ilike.%${term}%`, `address.ilike.%${term}%`].join(","));
  }
  if (status !== "all") query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    items: (data ?? []) as BusinessProfileRecord[],
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getBusinessById(id: string): Promise<BusinessProfileRecord | null> {
  if (!isUuid(id)) return null;
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BusinessProfileRecord | null) ?? null;
}



