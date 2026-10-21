// Telegram Bot API client — SERVER SIDE ONLY.
//
// Every new chat message is mirrored to a Telegram chat so the team can
// answer from their phone instead of watching the admin dashboard.
//
// Configuration (.env.local):
//
//   TELEGRAM_BOT_TOKEN = "123456789:AA..."   // token from @BotFather
//   TELEGRAM_CHAT_ID  = "5987654321"          // user / group / channel id
//
// `TELEGRAM_CHAT_ID` may hold a comma separated list of ids; the message is
// then delivered to every one of them.
//
// How to find your chat id:
//   1. Send any message to your bot (or add the bot to the group).
//   2. Open https://api.telegram.org/bot<TOKEN>/getUpdates
//   3. Copy `result[].message.chat.id`.
//
// Design rules:
//   * Notifications are a "nice to have" — they must NEVER break the chat.
//     Every failure is logged and swallowed; `sendTelegramMessage` resolves
//     to `false` instead of throwing.
//   * Every request is bounded by a timeout so a hanging Telegram API can
//     never stall a chat request.
//   * The bot token is only ever read from server-side env vars. It is never
//     exposed to the browser and never sent to the client.

const TELEGRAM_API_ROOT = "https://api.telegram.org";

/** Telegram refuses messages longer than 4096 characters. */
export const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

/** Give up on Telegram after this many milliseconds. */
const REQUEST_TIMEOUT_MS = 5000;

export type TelegramParseMode = "HTML" | "Markdown" | "MarkdownV2";

export interface TelegramSendOptions {
  /** Defaults to plain text (no parse mode). */
  parseMode?: TelegramParseMode;
  /** Suppresses the link preview of the first URL in the message. */
  disableWebPagePreview?: boolean;
  /** Delivers the message silently (no notification sound). */
  disableNotification?: boolean;
  /** Overrides the configured chat ids. */
  chatIds?: string[];
}

export interface TelegramResult {
  ok: boolean;
  description?: string;
  result?: unknown;
}

/** The bot token, or an empty string when it is not configured. */
export function getTelegramBotToken(): string {
  return (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
}

/**
 * The configured destination chat ids. Supports a comma separated list so
 * one bot can notify several chats (e.g. your personal chat + a group).
 */
export function getTelegramChatIds(): string[] {
  return (process.env.TELEGRAM_CHAT_ID ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

/** True when both the bot token and at least one chat id are configured. */
export function isTelegramConfigured(): boolean {
  return getTelegramBotToken().length > 0 && getTelegramChatIds().length > 0;
}

/** Escape a value so it can safely be embedded in an HTML parse-mode body. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Cut a message down to the maximum length Telegram accepts. */
export function truncateForTelegram(
  value: string,
  max: number = TELEGRAM_MAX_MESSAGE_LENGTH,
): string {
  if (value.length <= max) return value;
  const suffix = "\n… (truncated)";
  return `${value.slice(0, Math.max(0, max - suffix.length))}${suffix}`;
}


/**
 * Call a Telegram Bot API method. Never throws — network and API errors are
 * returned as `{ ok: false, description }`.
 */
export async function callTelegram(
  method: string,
  payload: Record<string, unknown> = {},
): Promise<TelegramResult> {
  const token = getTelegramBotToken();
  if (!token) {
    return { ok: false, description: "TELEGRAM_BOT_TOKEN is not set" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${TELEGRAM_API_ROOT}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      description?: string;
      result?: unknown;
    } | null;
    if (!res.ok || !json?.ok) {
      return {
        ok: false,
        description: json?.description ?? `HTTP ${res.status}`,
      };
    }
    return { ok: true, result: json.result };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, description: message };
  } finally {
    clearTimeout(timer);
  }
}


/**
 * Send a text message to every configured Telegram chat.
 *
 * Resolves to `true` only when every delivery succeeded. Failures are
 * logged — they never reject, so callers can `await` this safely.
 */
export async function sendTelegramMessage(
  text: string,
  options: TelegramSendOptions = {},
): Promise<boolean> {
  const token = getTelegramBotToken();
  if (!token) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN is not set — skipping notification.");
    return false;
  }

  const chatIds = (options.chatIds ?? getTelegramChatIds()).filter(
    (value) => value.length > 0,
  );
  if (chatIds.length === 0) {
    console.warn("[telegram] TELEGRAM_CHAT_ID is not set — skipping notification.");
    return false;
  }

  const body = truncateForTelegram(text);
  let allDelivered = true;

  for (const chatId of chatIds) {
    const payload: Record<string, unknown> = { chat_id: chatId, text: body };
    if (options.parseMode) payload.parse_mode = options.parseMode;
    if (options.disableWebPagePreview) payload.disable_web_page_preview = true;
    if (options.disableNotification) payload.disable_notification = true;

    // Sequential on purpose: a broken chat id must not fire a burst of
    // parallel requests at the Telegram API.
    // eslint-disable-next-line no-await-in-loop
    const res = await callTelegram("sendMessage", payload);
    if (!res.ok) {
      allDelivered = false;
      console.error(
        `[telegram] sendMessage failed for chat ${chatId}: ${res.description ?? "unknown error"}`,
      );
    }
  }

  return allDelivered;
}

/**
 * Read the bot identity (username) — used by the admin "test notification"
 * endpoint and the smoke-test script to confirm the token is valid.
 */
export async function getTelegramBotInfo(): Promise<
  { ok: true; username: string; name: string } | { ok: false; error: string }
> {
  const res = await callTelegram("getMe");
  if (!res.ok) {
    return { ok: false, error: res.description ?? "unknown error" };
  }
  const bot = (res.result ?? {}) as { username?: string; first_name?: string };
  return {
    ok: true,
    username: bot.username ?? "",
    name: bot.first_name ?? "",
  };
}
