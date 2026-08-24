import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadTelegramBotOffset, saveTelegramBotOffset } from "./appliedPrices.ts";
import { getTelegramBotConfig } from "./env.ts";
import { saveRawText, type RawTextMeta, RAW_DIR } from "./rawFiles.ts";
import {
  defaultTelegramBotRequest,
  pingTelegramBot,
  redactSecret,
  type TelegramBotRequest,
} from "./telegramBot.ts";

export const TELEGRAM_BOT_HEALTH_REPLY =
  "ربات محلی وصل است. استخراج قیمت و انتشار وب‌سایت خاموش است.";

export const TELEGRAM_BOT_ALLOWED_UPDATES = ["message", "edited_message"] as const;

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const LOCAL_LOG_FILE = resolve(REPO_ROOT, "data/raw-inputs/telegram-bot.log");

type TelegramChat = {
  id?: number | string;
  type?: string;
  title?: string;
  username?: string;
};

type TelegramUser = {
  id?: number | string;
  username?: string;
  first_name?: string;
};

type TelegramForwardOrigin = {
  type?: string;
  sender_user?: TelegramUser;
  sender_user_name?: string;
  chat?: TelegramChat;
  author_signature?: string;
  message_id?: number;
};

export type TelegramMessage = {
  message_id?: number;
  date?: number;
  text?: string | null;
  caption?: string | null;
  chat?: TelegramChat;
  forward_date?: number;
  forward_from?: TelegramUser;
  forward_from_chat?: TelegramChat;
  forward_sender_name?: string;
  forward_origin?: TelegramForwardOrigin;
};

export type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
};

export type TelegramRawSave = (input: {
  fileName: string;
  sourceUrl: string;
  text: string;
}) => RawTextMeta;

export type TelegramInboxDeps = {
  request: TelegramBotRequest;
  saveRaw?: TelegramRawSave;
  log?: (line: string) => void;
  now?: () => Date;
  loadOffset?: () => number;
  saveOffset?: (offset: number) => void;
  token?: string;
};

export type TelegramIngestResult = {
  processed: number;
  saved: number;
  sent: number;
  lastUpdateId: number;
};

export function messageBody(message: TelegramMessage): string {
  return (message.text ?? message.caption ?? "").trim();
}

export function isPrivateChat(chat: TelegramChat | undefined): boolean {
  return (chat?.type ?? "").toLowerCase() === "private";
}

export function isChannelChat(chat: TelegramChat | undefined): boolean {
  const type = (chat?.type ?? "").toLowerCase();
  return type === "channel";
}

export function isForwarded(message: TelegramMessage): boolean {
  return Boolean(
    message.forward_from_chat ||
      message.forward_from ||
      message.forward_origin ||
      message.forward_sender_name ||
      message.forward_date,
  );
}

export function isHealthCommand(text: string): boolean {
  const first = text.trim().split(/\s+/)[0] ?? "";
  const cmd = first.split("@")[0]?.toLowerCase();
  return cmd === "/health";
}

function chatLabel(chat: TelegramChat | undefined): string {
  if (!chat) return "";
  if (chat.username) return `@${chat.username}`;
  if (chat.title) return chat.title;
  if (chat.id != null) return `id:${chat.id}`;
  return "";
}

function userLabel(user: TelegramUser | undefined): string {
  if (!user) return "";
  if (user.username) return `@${user.username}`;
  if (user.first_name) return user.first_name;
  if (user.id != null) return `id:${user.id}`;
  return "";
}

export function describeOrigin(message: TelegramMessage): string {
  const origin = message.forward_origin;
  if (origin?.type === "channel" && origin.chat) {
    return `forward:channel:${chatLabel(origin.chat) || "channel"}`;
  }
  if (origin?.type === "chat" && origin.chat) {
    return `forward:chat:${chatLabel(origin.chat) || "chat"}`;
  }
  if (origin?.type === "user" && origin.sender_user) {
    return `forward:user:${userLabel(origin.sender_user) || "user"}`;
  }
  if (origin?.type === "hidden_user") {
    return `forward:hidden:${origin.sender_user_name || "user"}`;
  }
  if (message.forward_from_chat) {
    return `forward:${chatLabel(message.forward_from_chat) || "chat"}`;
  }
  if (message.forward_from) {
    return `forward:user:${userLabel(message.forward_from) || "user"}`;
  }
  if (message.forward_sender_name) {
    return `forward:hidden:${message.forward_sender_name}`;
  }
  const chat = message.chat;
  if (isPrivateChat(chat)) {
    return `private:${chatLabel(chat) || "user"}`;
  }
  return chatLabel(chat) || "telegram";
}

export function telegramSourceUrl(message: TelegramMessage): string {
  const chatId = message.chat?.id ?? "unknown";
  const messageId = message.message_id ?? "unknown";
  return `telegram:bot:chat/${chatId}/message/${messageId}`;
}

export function buildRawRecord(
  message: TelegramMessage,
  receivedAt: Date,
): { fileName: string; sourceUrl: string; text: string; logLine: string } {
  const text = messageBody(message) || "[no text]";
  const origin = describeOrigin(message);
  const receivedIso = receivedAt.toISOString();
  const record = [
    "[telegram-bot]",
    `received_at: ${receivedIso}`,
    `message_id: ${message.message_id ?? ""}`,
    `chat_id: ${message.chat?.id ?? ""}`,
    `chat_type: ${message.chat?.type ?? ""}`,
    `origin: ${origin}`,
    "---",
    text,
  ].join("\n");
  const logLine = JSON.stringify({
    receivedAt: receivedIso,
    messageId: message.message_id ?? null,
    chatId: message.chat?.id ?? null,
    chatType: message.chat?.type ?? null,
    origin,
    text,
  });
  return {
    fileName: "telegram-bot.txt",
    sourceUrl: telegramSourceUrl(message),
    text: record,
    logLine,
  };
}

export function appendTelegramBotLog(line: string): void {
  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(LOCAL_LOG_FILE, line.endsWith("\n") ? line : `${line}\n`, { flag: "a" });
}

function defaultLog(line: string): void {
  appendTelegramBotLog(line);
  console.log(line);
}

export async function ingestTelegramUpdates(
  updates: TelegramUpdate[],
  deps: TelegramInboxDeps,
): Promise<TelegramIngestResult> {
  const list = Array.isArray(updates) ? updates : [];
  const loadOffset = deps.loadOffset ?? loadTelegramBotOffset;
  const saveRaw = deps.saveRaw ?? saveRawText;
  const log = deps.log ?? defaultLog;
  const now = deps.now ?? (() => new Date());
  const token = deps.token ?? getTelegramBotConfig().token;
  let lastUpdateId = loadOffset();
  let saved = 0;
  let sent = 0;

  for (const update of list) {
    lastUpdateId = Math.max(lastUpdateId, Number(update.update_id) || 0);
    const message = update.message ?? update.edited_message;
    if (!message) continue;
    const text = messageBody(message);
    const forwarded = isForwarded(message);
    if (!text && !forwarded) continue;

    const record = buildRawRecord(message, now());
    saveRaw({
      fileName: record.fileName,
      sourceUrl: record.sourceUrl,
      text: record.text,
    });
    saved += 1;
    log(redactSecret(record.logLine, token));

    if (!isHealthCommand(text)) continue;
    if (!isPrivateChat(message.chat) || isChannelChat(message.chat)) continue;
    const chatId = message.chat?.id;
    if (chatId == null) continue;
    await deps.request("sendMessage", {
      chat_id: chatId,
      text: TELEGRAM_BOT_HEALTH_REPLY,
    }).catch(() => undefined);
    sent += 1;
  }

  return { processed: list.length, saved, sent, lastUpdateId };
}

export async function processTelegramInbox(
  deps: TelegramInboxDeps,
  timeout = 0,
): Promise<TelegramIngestResult> {
  const loadOffset = deps.loadOffset ?? loadTelegramBotOffset;
  const saveOffset = deps.saveOffset ?? saveTelegramBotOffset;
  const offset = loadOffset();
  const updates = (await deps.request("getUpdates", {
    timeout,
    limit: 100,
    offset: offset || undefined,
    allowed_updates: [...TELEGRAM_BOT_ALLOWED_UPDATES],
  })) as TelegramUpdate[];
  const result = await ingestTelegramUpdates(Array.isArray(updates) ? updates : [], {
    ...deps,
    loadOffset,
  });
  if (Array.isArray(updates) && updates.length) {
    saveOffset(result.lastUpdateId + 1);
  }
  return result;
}

export async function runTelegramBotWorker(options?: {
  request?: TelegramBotRequest;
  signal?: AbortSignal;
}): Promise<void> {
  const config = getTelegramBotConfig();
  if (!config.configured) {
    console.error("TELEGRAM_BOT_TOKEN را در فایل .env بگذارید. توکن را در گیت نگذارید.");
    process.exitCode = 1;
    return;
  }
  const request =
    options.request ??
    ((method, body) => defaultTelegramBotRequest(method, body ?? {}, 20_000, options.signal));
  const ping = await pingTelegramBot(request);
  if (!ping.ok) {
    console.error(ping.error ?? "اتصال ربات تلگرام برقرار نشد.");
    process.exitCode = 1;
    return;
  }
  const username = ping.username ? `@${ping.username}` : "ربات تلگرام";
  console.log(`telegram bot worker listening as ${username}`);
  console.log("mode: long polling; extraction off; website publish off; no channel sends");

  try {
    await request("deleteWebhook", { drop_pending_updates: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "deleteWebhook failed";
    console.error(redactSecret(message, config.token));
    process.exitCode = 1;
    return;
  }

  const signal = options.signal;
  while (!signal?.aborted) {
    try {
      await processTelegramInbox({ request, token: config.token }, 25);
    } catch (error) {
      if (signal?.aborted) break;
      const message = error instanceof Error ? error.message : "telegram bot poll failed";
      console.error(redactSecret(message, config.token));
      await new Promise((resolveWait) => setTimeout(resolveWait, 2_000));
    }
  }
}
