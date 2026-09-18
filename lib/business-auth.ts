import type { NextRequest } from "next/server";
import { APP_USER_COOKIE } from "@/lib/cookies";
import { getServiceSupabase } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AuthenticatedBusinessUser {
  id: string;
  email: string;
  display_name: string | null;
  city: string | null;
}

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Resolve the application auth cookie to a real app_users row. */
export async function getAuthenticatedBusinessUser(
  req: NextRequest,
): Promise<AuthenticatedBusinessUser | null> {
  const userId = req.cookies.get(APP_USER_COOKIE)?.value;
  if (!isUuid(userId)) return null;

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("app_users")
    .select("id, email, display_name, city")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

/** Fetch the authenticated user's one business profile, if it exists. */
export async function getBusinessProfileForUser(userId: string) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}
