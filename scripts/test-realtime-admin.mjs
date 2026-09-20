// End-to-end test of the admin "send message" flow WITHOUT the UI.
// It does what sendAdminMessageAction() does: invokes the
// append_admin_message RPC. The admin client (browser) should then
// see the new message via realtime.
//
// We also create a "shadow" realtime listener using the same
// supabase-js package the browser uses, to verify that the
// postgres_changes event fires on insert.

import { createClient } from "@supabase/supabase-js";

const URL = "https://nsedgabikoipvkqdvwxr.supabase.co";
const K =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zZWRnYWJpa29pcHZrcWR2d3hyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODA5MDQyNCwiZXhwIjoyMTAzNjY2NDI0fQ.XGbiwApGdBxRaDF4V0f_Pv6NfssyYvpviI49wqg99kk";
const SESSION_ID = "22222222-2222-2222-2222-222222222222";

// 1) Spin up a realtime listener on the anon connection (mirrors the
//    admin's browser subscription).
const anon = createClient(URL, K, { realtime: { params: { eventsPerSecond: 10 } } });
const received = [];
const ch = anon
  .channel(`probe-${SESSION_ID}`)
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "messages", filter: `session_id=eq.${SESSION_ID}` },
    (payload) => {
      received.push(payload.new);
      console.log("[realtime] saw insert:", payload.new);
    },
  )
  .subscribe((status) => console.log("[realtime] channel status:", status));

// 2) Wait for the channel to be ready, then insert a message via the
//    service-role RPC (what the server action does).
await new Promise((r) => setTimeout(r, 2500));

console.log("\n[sending admin message via RPC…]");
const r = await fetch(`${URL}/rest/v1/rpc/append_admin_message`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: K, Authorization: `Bearer ${K}` },
  body: JSON.stringify({ p_session_id: SESSION_ID, p_text: "realtime probe " + Date.now() }),
});
console.log("[send] HTTP", r.status, await r.text());

// 3) Give realtime a moment to deliver, then summarize.
await new Promise((r) => setTimeout(r, 2500));
console.log("\n[result] realtime events received:", received.length);
if (received.length === 0) {
  console.log("FAIL: realtime did not deliver the insert.");
} else {
  console.log("OK: realtime delivered the admin message to a listener.");
}

anon.removeChannel(ch);
await new Promise((r) => setTimeout(r, 500));

// cleanup
await fetch(`${URL}/rest/v1/messages?session_id=eq.${SESSION_ID}`, {
  method: "DELETE",
  headers: { apikey: K, Authorization: `Bearer ${K}` },
});
await fetch(`${URL}/rest/v1/sessions?id=eq.${SESSION_ID}`, {
  method: "DELETE",
  headers: { apikey: K, Authorization: `Bearer ${K}` },
});
console.log("[cleanup] done");