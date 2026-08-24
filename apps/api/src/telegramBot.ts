import { CollectError } from "./collectError.ts";
import { getTelegramBotConfig } from "./env.ts";

const REQUEST_TIMEOUT_MS = 20_000;

type TelegramApiResponse = {
  ok?: boolean;
  description?: string;
  result?: unknown;
};

export type TelegramBotRequest = (method: string, body?: Record<string, unknown>) => Promise<unknown>;

export function redactSecret(value: string, secret: string): string {
  if (!secret) return value;
  return value.split(secret).join("[redacted]");
}

export function describeTelegramBotError(description: string | undefined): string {
  const text = (description ?? "").toLowerCase();
  if (text.includes("unauthorized") || text.includes("token")) {
    return "توکن ربات تلگرام نامعتبر است.";
  }
  if (text.includes("webhook") && text.includes("getupdates")) {
    return "وب‌هوک ربات فعال است. Worker محلی فقط Long Polling است.";
  }
  return "درخواست ربات تلگرام رد شد.";
}

export async function defaultTelegramBotRequest(
  method: string,
  body: Record<string, unknown> = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
  signal?: AbortSignal,
): Promise<unknown> {
  const config = getTelegramBotConfig();
  if (!config.configured) {
    throw new CollectError("توکن ربات تلگرام تنظیم نشده است.");
  }
  if (signal?.aborted) {
    throw new CollectError("پاسخ ربات تلگرام بیش از حد طول کشید.");
  }
  const longPollSeconds = Number(body.timeout) || 0;
  const waitMs = longPollSeconds > 0 ? (longPollSeconds + 5) * 1000 : timeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), waitMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const response = await fetch(`${config.apiBase}/bot${config.token}/${method}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = (await response.json()) as TelegramApiResponse;
    if (!payload.ok) {
      throw new CollectError(describeTelegramBotError(payload.description));
    }
    return payload.result;
  } catch (error) {
    if (error instanceof CollectError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new CollectError("پاسخ ربات تلگرام بیش از حد طول کشید.");
    }
    throw new CollectError("اتصال به Bot API تلگرام برقرار نشد.");
  } finally {
    signal?.removeEventListener("abort", onAbort);
    clearTimeout(timer);
  }
}

export async function pingTelegramBot(
  request: TelegramBotRequest = (method, body) => defaultTelegramBotRequest(method, body ?? {}, 5_000),
): Promise<{ ok: boolean; username?: string; error?: string }> {
  const config = getTelegramBotConfig();
  if (!config.configured) return { ok: false, error: "توکن ربات تلگرام تنظیم نشده است." };
  try {
    const me = (await request("getMe")) as { username?: string; first_name?: string };
    return { ok: true, username: me.username || me.first_name };
  } catch (error) {
    const message = error instanceof Error ? error.message : "اتصال ربات تلگرام برقرار نشد.";
    return { ok: false, error: redactSecret(message, config.token) };
  }
}
