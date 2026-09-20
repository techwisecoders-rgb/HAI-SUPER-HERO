import { NextResponse, type NextRequest } from "next/server";
import { APP_USER_COOKIE, SESSION_COOKIE } from "@/lib/cookies";
import { getServiceSupabase } from "@/lib/supabase/server";
export const runtime = "nodejs";
function uuid(value: string | undefined) { return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null; }
export async function POST(req: NextRequest) {
  const userId = uuid(req.cookies.get(APP_USER_COOKIE)?.value), sessionId = uuid(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId && !sessionId) return NextResponse.json({ error: "A session or login is required" }, { status: 401 });
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file supplied" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "File must be 5 MB or smaller" }, { status: 400 });
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);
  if (!allowed.has(file.type)) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  const owner = userId || sessionId!;
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${owner}/${crypto.randomUUID()}.${ext}`;
  try {
    const supabase = getServiceSupabase();
    const { error } = await supabase.storage.from("worker-media").upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ url: supabase.storage.from("worker-media").getPublicUrl(path).data.publicUrl });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 500 }); }
}
