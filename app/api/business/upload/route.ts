import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedBusinessUser, getBusinessProfileForUser } from "@/lib/business-auth";
import { getServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedBusinessUser(req);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const profile = await getBusinessProfileForUser(user.id);
  if (!profile) return NextResponse.json({ error: "Business profile not found" }, { status: 404 });

  const form = await req.formData();
  const value = form.get("file");
  if (!(value instanceof File)) return NextResponse.json({ error: "Image file is required" }, { status: 400 });
  if (!ALLOWED.has(value.type)) return NextResponse.json({ error: "Use JPG, PNG, WEBP, or GIF" }, { status: 400 });
  if (value.size > MAX_BYTES) return NextResponse.json({ error: "Image must be 5 MB or smaller" }, { status: 400 });

  const supabase = getServiceSupabase();
  const { data: bucket } = await supabase.storage.getBucket("business-media");
  if (!bucket) {
    const { error: bucketError } = await supabase.storage.createBucket("business-media", { public: true });
    if (bucketError && !bucketError.message.toLowerCase().includes("already exists")) {
      return NextResponse.json({ error: bucketError.message }, { status: 500 });
    }
  }

  const extension = value.type.split("/")[1] || "bin";
  const path = `${profile.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await value.arrayBuffer());
  const { error } = await supabase.storage.from("business-media").upload(path, bytes, {
    contentType: value.type,
    upsert: false,
    cacheControl: "31536000",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: publicUrl } = supabase.storage.from("business-media").getPublicUrl(path);
  return NextResponse.json({ url: publicUrl.publicUrl }, { status: 201 });
}
