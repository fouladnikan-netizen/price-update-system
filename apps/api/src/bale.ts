import { CollectError } from "./collectError.ts";
import { getBaleConfig, getBaleUserConfig } from "./env.ts";
import { baleFetchedUrl, parseBaleChannel, type BaleChannelRef } from "./baleChannel.ts";

const MESSAGE_LIMIT = 80;
const REQUEST_TIMEOUT_MS = 20_000;

type BaleChat = {
  id?: number | string;
  type?: string;
  title?: string;
  username?: string;
};

type BaleMessage = {
  date?: number;
  text?: string | null;
  caption?: string | null;
  photo?: unknown;
  document?: unknown;
  chat?: BaleChat;
  forward_from_chat?: BaleChat;
};

type BaleUpdate = {
  update_id?: number;
  message?: BaleMessage;
  edited_message?: BaleMessage;
  channel_post?: BaleMessage;
  edited_channel_post?: BaleMessage;
};

type BaleApiResponse = {
  ok?: boolean;
  description?: string;
  result?: unknown;
};

export type BaleRequest = (method: string, body?: Record<string, unknown>) => Promise<unknown>;

export async function defaultBaleRequest(
  method: string,
  body: Record<string, unknown> = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<unknown> {
  const config = getBaleConfig();
  if (!config.configured) {
    throw new CollectError("بازوی سازمانی بله روی سرور تنظیم نشده است.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${config.apiBase}/bot${config.token}/${method}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = (await response.json()) as BaleApiResponse;
    if (!payload.ok) {
      throw new CollectError(describeBaleError(method, payload.description));
    }
    return payload.result;
  } catch (error) {
    if (error instanceof CollectError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new CollectError("پاسخ بازوی بله بیش از حد طول کشید.");
    }
    throw new CollectError("اتصال به API رسمی بله برقرار نشد.");
  } finally {
    clearTimeout(timer);
  }
}

function describeBaleError(_method: string, description: string | undefined): string {
  const text = (description ?? "").toLowerCase();
  if (text.includes("unauthorized") || text.includes("token")) {
    return "توکن بازوی بله نامعتبر است.";
  }
  return "درخواست رسمی بله رد شد.";
}

function formatStamp(value: number | undefined): string {
  if (!value) return "";
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().replace("T", " ").slice(0, 16);
}

function messageText(item: BaleMessage): string {
  const body = (item.text ?? item.caption ?? "").trim();
  const media = item.photo || item.document ? "[فایل یا تصویر کانال]" : "";
  return [body, media].filter(Boolean).join("\n");
}

function updatesOf(result: unknown): BaleUpdate[] {
  return Array.isArray(result) ? (result as BaleUpdate[]) : [];
}

function messageFromUpdate(update: BaleUpdate): BaleMessage | null {
  return update.channel_post ?? update.edited_channel_post ?? update.message ?? update.edited_message ?? null;
}

function isPrivateChat(chat: BaleChat | undefined): boolean {
  const type = (chat?.type ?? "").toLowerCase();
  return type === "private" || type === "bot";
}

function sameChat(chat: BaleChat | undefined, ref: BaleChannelRef): boolean {
  if (!chat) return false;
  if (ref.kind === "username") {
    return (chat.username ?? "").toLowerCase() === ref.username.toLowerCase();
  }
  const id = String(chat.id ?? "");
  return id === ref.chatId || id === `-${ref.chatId}` || id.replace(/^-100/, "") === ref.chatId.replace(/^-100/, "");
}

function messageMatchesSource(item: BaleMessage, ref: BaleChannelRef, botUsername?: string): boolean {
  if (sameChat(item.chat, ref) || sameChat(item.forward_from_chat, ref)) return true;
  const sourceIsBot =
    ref.kind === "username" && Boolean(botUsername) && ref.username.toLowerCase() === botUsername.toLowerCase();
  if (sourceIsBot && isPrivateChat(item.chat)) return true;
  return false;
}

export async function pingBaleBot(
  request: BaleRequest = (method, body) => defaultBaleRequest(method, body ?? {}, 5_000),
): Promise<{
  ok: boolean;
  username?: string;
  error?: string;
}> {
  const config = getBaleConfig();
  if (!config.configured) return { ok: false, error: "توکن بازوی بله تنظیم نشده است." };
  try {
    const me = (await request("getMe")) as { username?: string; first_name?: string };
    return { ok: true, username: me.username || me.first_name };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "اتصال بله برقرار نشد." };
  }
}

export async function collectBaleChannel(
  address: string,
  request: BaleRequest = defaultBaleRequest,
): Promise<{ fetchedUrl: string; text: string }> {
  const bot = getBaleConfig();
  if (!bot.configured && getBaleUserConfig().configured && request === defaultBaleRequest) {
    const { collectBaleChannelAsUser } = await import("./bale-user.ts");
    return collectBaleChannelAsUser(address);
  }
  if (!bot.configured) {
    throw new CollectError(
      "توکن بازوی بله روی سرور نیست. پیام را برای بازو بفرستید و BALE_BOT_TOKEN را در .env بگذارید.",
    );
  }

  const ref = parseBaleChannel(address);
  const me = (await request("getMe").catch(() => ({}))) as { username?: string };
  const webhook = (await request("getWebhookInfo").catch(() => ({ url: "" }))) as { url?: string };
  if (webhook.url) {
    throw new CollectError("وب‌هوک بازوی بله فعال است. برای خواندن صندوق پیام وب‌هوک را خاموش کنید.");
  }

  const updates = updatesOf(await request("getUpdates", { timeout: 0, limit: 100 }));
  const blocks = updates
    .map(messageFromUpdate)
    .filter((item): item is BaleMessage => Boolean(item) && messageMatchesSource(item, ref, me.username))
    .slice(-MESSAGE_LIMIT)
    .map((item) => {
      const text = messageText(item);
      if (!text) return "";
      const stamp = formatStamp(item.date);
      return stamp ? `${stamp}\n${text}` : text;
    })
    .filter(Boolean);

  if (!blocks.length) {
    throw new CollectError(
      "در صندوق بازو پیامی برای این منبع نبود. پیام کانال را برای بازو Forward کنید، یا شناسه منبع را روی خود بازو بگذارید.",
    );
  }

  return {
    fetchedUrl: baleFetchedUrl(ref),
    text: blocks.join("\n\n"),
  };
}
