// Reproduce the "admin can't send" bug end-to-end, then print the
// actual error from the append_admin_message RPC. Also probes the
// admin server action via the running dev server.

const SUPABASE_URL = "https://nsedgabikoipvkqdvwxr.supabase.co";
const K =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zZWRnYWJpa29pcHZrcWR2d3hyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODA5MDQyNCwiZXhwIjoyMTAzNjY2NDI0fQ.XGbiwApGdBxRaDF4V0f_Pv6NfssyYvpviI49wqg99kk";
const APP = "http://localhost:3001";
const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" };

async function rpc(name, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST", headers: H, body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.text() };
}

console.log("=== HAI SUPER HERO admin-send diagnostic ===\n");

// 1. Create a fresh session to chat into.
const sess = await rpc("upsert_session", {
  p_session_id: "11111111-1111-1111-1111-111111111111",
  p_metadata: { ua: "test", lang: "en" },
});
console.log("[1] upsert_session  HTTP", sess.status, sess.body);

// 2. Send a user message so the thread isn't empty.
const userMsg = await rpc("append_user_message", {
  p_session_id: "11111111-1111-1111-1111-111111111111",
  p_text: "Hi from the user side",
});
console.log("[2] append_user_message  HTTP", userMsg.status, userMsg.body);

// 3. Try append_admin_message directly via service role (this is what
//    the server action does on the server).
const adminMsg = await rpc("append_admin_message", {
  p_session_id: "11111111-1111-1111-1111-111111111111",
  p_text: "Hi from the admin side",
});
console.log("[3] append_admin_message  HTTP", adminMsg.status, adminMsg.body);

// 4. Confirm the message landed in the DB.
const list = await fetch(
  `${SUPABASE_URL}/rest/v1/messages?session_id=eq.11111111-1111-1111-1111-111111111111&order=created_at.asc&select=id,sender_type,text`,
  { headers: { apikey: K, Authorization: `Bearer ${K}` } },
);
console.log("[4] messages in DB:", await list.text());

// 5. Confirm the messages table is in the realtime publication (admin
//    chat relies on Realtime to see new messages).
const pub = await fetch(
  `${SUPABASE_URL}/rest/v1/_realtime/publication?select=pubname`,
  { headers: { apikey: K, Authorization: `Bearer ${K}` } },
);
console.log("[5] publications (raw):", pub.status, (await pub.text()).slice(0, 200));

// Cleanup
await fetch(`${SUPABASE_URL}/rest/v1/messages?session_id=eq.11111111-1111-1111-1111-111111111111`, {
  method: "DELETE", headers: { apikey: K, Authorization: `Bearer ${K}` },
});
await fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.11111111-1111-1111-1111-111111111111`, {
  method: "DELETE", headers: { apikey: K, Authorization: `Bearer ${K}` },
});
console.log("\n[cleanup] done");