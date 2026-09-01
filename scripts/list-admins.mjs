import { createClient } from "@supabase/supabase-js";

const URL = "https://nsedgabikoipvkqdvwxr.supabase.co";
const K =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zZWRnYWJpa29pcHZrcWR2d3hyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODA5MDQyNCwiZXhwIjoyMTAzNjY2NDI0fQ.XGbiwApGdBxRaDF4V0f_Pv6NfssyYvpviI49wqg99kk";

const admin = createClient(URL, K, { auth: { autoRefreshToken: false, persistSession: false } });

const r = await admin.auth.admin.listUsers();
if (r.error) {
  console.error("listUsers error:", r.error);
} else {
  console.log("Users in auth.users:");
  for (const u of r.data.users) {
    console.log(` - ${u.id}  ${u.email}  confirmed=${!!u.email_confirmed_at}  last_sign_in=${u.last_sign_in_at ?? "-"}`);
  }
  console.log(`Total: ${r.data.users.length}`);
}