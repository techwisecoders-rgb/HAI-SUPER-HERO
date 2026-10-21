// Standalone Telegram smoke test. Verifies that TELEGRAM_BOT_TOKEN +
// TELEGRAM_CHAT_ID in .env.local can actually deliver a message.
//
// Usage: node scripts/test-telegram.mjs ["custom message"]
//
// Exits with code 0 on success, 1 on failure.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  // tiny inline .env loader — strip optional surrounding quotes
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
} else {
  console.error(`No .env.local found at ${envPath}`);
  process.exit(1);
}

const TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

if (!TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN missing in .env.local");
  process.exit(1);
}
if (CHAT_IDS.length === 0) {
  console.error("TELEGRAM_CHAT_ID missing in .env.local");
  process.exit(1);
}

const API = "https://api.telegram.org";

async function api(method, payload = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${API}/bot${TOKEN}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  } catch (e) {
    return { status: 0, json: null, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

// 1) Confirm the token is valid and show which bot it belongs to.
console.log("Checking bot identity ...");
const me = await api("getMe");
if (me.error) {
  console.error("FAIL: could not reach Telegram:", me.error);
  process.exit(1);
}
if (!me.json?.ok) {
  console.error("FAIL: invalid token —", me.json?.description ?? `HTTP ${me.status}`);
  process.exit(1);
}
console.log(`  bot: @${me.json.result?.username ?? "?"} (${me.json.result?.first_name ?? "?"})`);

// 2) Send the test message to every configured chat.
const text =
  process.argv[2] ||
  `✅ [HAI SUPER HERO] Telegram test — ${new Date().toISOString()}\n\nEvery new visitor message will be pushed here.`;

let failed = false;
for (const chatId of CHAT_IDS) {
  console.log(`Sending test message to chat ${chatId} ...`);
  const sent = await api("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
  if (sent.error) {
    console.error("FAIL:", sent.error);
    failed = true;
    continue;
  }
  if (!sent.json?.ok) {
    console.error("FAIL:", sent.json?.description ?? `HTTP ${sent.status}`);
    failed = true;
    continue;
  }
  console.log("  OK messageId:", sent.json.result?.message_id);
}

if (failed) {
  console.error("\nTelegram delivery FAILED.");
  process.exit(1);
}
console.log("\nTelegram delivery OK — check the chat on your phone.");
