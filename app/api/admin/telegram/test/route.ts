// GET  /api/admin/telegram/test — report the Telegram configuration.
// POST /api/admin/telegram/test — send a test notification to Telegram.
//
// Admin-only. The bot token and chat id are never returned to the client —
// only whether they are configured and how many chats are targeted.
//
// The button behind this endpoint lives in the admin console
// (app/admin/conversations-panel.tsx) so the team can verify the Telegram
// wiring without opening the logs.

import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/admin/http";
import { sendTelegramTestMessage, telegramStatus } from "@/lib/telegram/notify";
import { getTelegramBotInfo } from "@/lib/telegram/send";

export const runtime = "nodejs";

export async function GET() {
  return withAdmin(async () => {
    const status = telegramStatus();
    let bot = "";
    if (status.configured) {
      const info = await getTelegramBotInfo();
      if (info.ok) bot = info.username ? `@${info.username}` : info.name;
    }
    return NextResponse.json({
      ok: true,
      configured: status.configured,
      chatCount: status.chatIds.length,
      adminRepliesEnabled: status.adminRepliesEnabled,
      bot,
    });
  });
}

export async function POST() {
  return withAdmin(async () => {
    const result = await sendTelegramTestMessage();
    if (!result.sent) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "Telegram delivery failed" },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, sent: true });
  });
}
