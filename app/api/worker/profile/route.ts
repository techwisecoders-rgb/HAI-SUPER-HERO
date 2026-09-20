import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { APP_USER_COOKIE, SESSION_COOKIE } from "@/lib/cookies";
import { getServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ProfilePatch = z.object({
  name: z.string().trim().max(120).optional(), phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(254).nullable().optional(), location: z.string().trim().max(500).optional(),
  qualification: z.string().trim().max(200).optional(), experience: z.string().trim().max(80).optional(),
  profession: z.string().trim().max(100).optional(), profileImageUrl: z.string().max(2000).nullable().optional(),
  backgroundImageUrl: z.string().max(2000).nullable().optional(), workAvailable: z.boolean().optional(),
  skills: z.array(z.string().trim().max(200)).max(100).optional(), aboutText: z.string().max(10000).optional(),
  workDescription: z.string().max(10000).optional(), resumeUrl: z.string().max(2000).nullable().optional(),
  works: z.array(z.record(z.string(), z.unknown())).max(200).optional(), featured: z.array(z.string().max(300)).max(100).optional(),
  socialLinks: z.array(z.record(z.string(), z.unknown())).max(100).optional(), rating: z.number().min(0).max(5).optional(),
  jobsDone: z.number().int().min(0).max(100000000).optional(),
}).strict();

function uuid(value: string | undefined) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null;
}
function identity(req: NextRequest) {
  return { userId: uuid(req.cookies.get(APP_USER_COOKIE)?.value), sessionId: uuid(req.cookies.get(SESSION_COOKIE)?.value) };
}
async function findProfile(userId: string | null, sessionId: string | null) {
  const supabase = getServiceSupabase();
  if (userId) {
    const { data, error } = await supabase.from("worker_profiles").select("*").eq("user_id", userId).maybeSingle();
    if (error) throw error; if (data) return data;
  }
  if (sessionId) {
    const { data, error } = await supabase.from("worker_profiles").select("*").eq("session_id", sessionId).maybeSingle();
    if (error) throw error;
    if (data) {
      // Once an anonymous session becomes a logged-in app user, claim the
      // existing profile so it follows the user across devices/sessions.
      if (userId && !data.user_id) {
        const { data: claimed, error: claimError } = await supabase.from("worker_profiles").update({ user_id: userId }).eq("id", data.id).select("*").single();
        if (claimError) throw claimError;
        return claimed;
      }
      return data;
    }
  }
  return null;
}
async function backfillFromRegistration(userId: string | null, sessionId: string | null) {
  const supabase = getServiceSupabase();
  let query = supabase.from("worker_registrations").select("*").order("created_at", { ascending: false }).limit(1);
  if (userId) query = query.eq("user_id", userId); else if (sessionId) query = query.eq("session_id", sessionId); else return null;
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  const { data: created, error: createError } = await supabase.from("worker_profiles").insert({
    user_id: userId, session_id: sessionId, email: data.email, name: data.full_name, phone: data.phone,
    location: data.address, qualification: data.qualification ?? "", experience: data.years_experience ?? "",
    profession: data.work_type || "electrician", work_description: data.work_description || "", work_available: true,
  }).select("*").single();
  return createError ? null : created;
}

export async function GET(req: NextRequest) {
  const { userId, sessionId } = identity(req);
  if (!userId && !sessionId) return NextResponse.json({ profile: null });
  try { return NextResponse.json({ profile: (await findProfile(userId, sessionId)) ?? await backfillFromRegistration(userId, sessionId) }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Could not load worker profile" }, { status: 500 }); }
}

export async function PATCH(req: NextRequest) {
  const { userId, sessionId } = identity(req);
  if (!userId && !sessionId) return NextResponse.json({ error: "A session or login is required" }, { status: 401 });
  const parsed = ProfilePatch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid worker profile" }, { status: 400 });
  try {
    const supabase = getServiceSupabase();
    let profile = await findProfile(userId, sessionId) ?? await backfillFromRegistration(userId, sessionId);
    const maps: Record<string, string> = {
      name:"name", phone:"phone", email:"email", location:"location", qualification:"qualification", experience:"experience",
      profession:"profession", profileImageUrl:"profile_image_url", backgroundImageUrl:"background_image_url", workAvailable:"work_available",
      skills:"skills", aboutText:"about_text", workDescription:"work_description", resumeUrl:"resume_url", works:"works", featured:"featured",
      socialLinks:"social_links", rating:"rating", jobsDone:"jobs_done",
    };
    const row: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) row[maps[key]] = value;
    if (profile) {
      const { data, error } = await supabase.from("worker_profiles").update(row).eq("id", profile.id).select("*").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ profile: data });
    }
    const { data, error } = await supabase.from("worker_profiles").insert({ user_id: userId, session_id: sessionId, ...row }).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ profile: data }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save worker profile" }, { status: 500 }); }
}
