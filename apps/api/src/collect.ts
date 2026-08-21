import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { parseBaleChannel, balePreviewUrl } from "./baleChannel.ts";
import { CollectError } from "./collectError.ts";
import { getBaleConfig, getBaleUserConfig, getTelegramConfig } from "./env.ts";
import { htmlToText, looksLikeAccessControl } from "./htmlText.ts";
import { parseTelegramChannel } from "./telegramChannel.ts";

export { CollectError } from "./collectError.ts";

export type CollectableType = "website" | "telegram" | "bale";

const USER_AGENT = "PriceUpdateSystem/0.1 (public collector; no login; no captcha bypass)";
export const MAX_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 25_000;

export function isCollectableType(value: string): value is CollectableType {
  return value === "website" || value === "telegram" || value === "bale";
}

export function normalizeCollectUrl(sourceType: CollectableType, address: string): string {
  const raw = address.trim();
  if (!raw) throw new CollectError("آدرس منبع خالی است.");
  if (sourceType === "telegram") return telegramPreviewUrl(raw);
  if (sourceType === "bale") return balePreviewUrl(parseBaleChannel(raw));
  const url = toHttpUrl(raw);
  assertPublicUrl(url);
  return url.toString();
}

function toHttpUrl(value: string): URL {
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new CollectError("آدرس منبع معتبر نیست.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new CollectError("فقط آدرس عمومی http یا https مجاز است.");
  }
  if (url.username || url.password) {
    throw new CollectError("نام کاربری و رمز در آدرس ذخیره یا استفاده نمی‌شود.");
  }
  return url;
}

function telegramPreviewUrl(address: string): string {
  const ref = parseTelegramChannel(address);
  if (ref.kind === "channelId") {
    throw new CollectError(
      "کانال با شناسهٔ داخلی فقط با اکانت سازمانی خوانده می‌شود. اول telegram:login را اجرا کنید.",
    );
  }
  return `https://t.me/s/${ref.username}`;
}

export function isBlockedIp(ip: string): boolean {
  const value = ip.replace(/^::ffff:/, "");
  if (value === "127.0.0.1" || value === "::1" || value === "0.0.0.0" || value === "localhost") return true;
  if (value.startsWith("10.")) return true;
  if (value.startsWith("192.168.")) return true;
  if (value.startsWith("169.254.")) return true;
  const match = value.match(/^172\.(\d+)\./);
  if (match) {
    const second = Number(match[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

export function assertPublicUrl(url: URL): void {
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    throw new CollectError("آدرس داخلی یا خصوصی خوانده نمی‌شود.");
  }
  if (isIP(host) && isBlockedIp(host)) {
    throw new CollectError("آدرس داخلی یا خصوصی خوانده نمی‌شود.");
  }
}

async function assertResolvedPublic(url: URL): Promise<void> {
  assertPublicUrl(url);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return;
  try {
    const results = await lookup(host, { all: true });
    if (!results.length || results.some((item) => isBlockedIp(item.address))) {
      throw new CollectError("آدرس داخلی یا خصوصی خوانده نمی‌شود.");
    }
  } catch (error) {
    if (error instanceof CollectError) throw error;
    throw new CollectError("نام میزبان منبع پیدا نشد.");
  }
}

export type FetchPublicOptions = {
  fetchImpl?: typeof fetch;
  skipDns?: boolean;
};

export async function fetchPublicPage(
  target: string,
  options: FetchPublicOptions = {},
): Promise<{ finalUrl: string; status: number; contentType: string; body: string }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  let current = new URL(target);
  if (!options.skipDns) await assertResolvedPublic(current);
  else assertPublicUrl(current);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetchImpl(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,text/plain;q=0.9,*/*;q=0.1",
          "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.5",
          "User-Agent": USER_AGENT,
        },
      });
    } catch (error) {
      if (error instanceof CollectError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new CollectError("خواندن صفحه عمومی بیش از حد طول کشید.");
      }
      throw new CollectError("خواندن صفحه عمومی انجام نشد.");
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new CollectError("ریدایرکت بدون مقصد معتبر بود.");
      current = new URL(location, current);
      if (!options.skipDns) await assertResolvedPublic(current);
      else assertPublicUrl(current);
      continue;
    }

    const contentType = response.headers.get("content-type") ?? "";
    const { buffer, truncated } = await readLimitedBody(response, MAX_BYTES);
    const body = buffer.toString("utf8");
    if (truncated && !looksLikeHtml(buffer, contentType)) {
      throw new CollectError("حجم صفحه عمومی بیش از حد مجاز است.");
    }
    const blocked = looksLikeAccessControl(body, response.status);
    if (blocked) throw new CollectError(blocked);
    if (!response.ok) {
      throw new CollectError(`صفحه عمومی پاسخ ${response.status} داد.`);
    }
    return { finalUrl: current.toString(), status: response.status, contentType, body };
  }

  throw new CollectError("ریدایرکت بیش از حد مجاز بود.");
}

async function readLimitedBody(
  response: Response,
  maxBytes: number,
): Promise<{ buffer: Buffer; truncated: boolean }> {
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length <= maxBytes) return { buffer, truncated: false };
    return { buffer: buffer.subarray(0, maxBytes), truncated: true };
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    if (size + chunk.length > maxBytes) {
      chunks.push(chunk.subarray(0, maxBytes - size));
      await reader.cancel().catch(() => undefined);
      return { buffer: Buffer.concat(chunks), truncated: true };
    }
    chunks.push(chunk);
    size += chunk.length;
  }
  return { buffer: Buffer.concat(chunks), truncated: false };
}

function looksLikeHtml(buffer: Buffer, contentType: string): boolean {
  if (contentType.toLowerCase().includes("html")) return true;
  const head = buffer.subarray(0, 800).toString("utf8").toLowerCase();
  return head.includes("<html") || head.includes("<!doctype") || head.includes("<table") || head.includes("<div");
}

export async function collectPublicText(
  sourceType: CollectableType,
  address: string,
  options: FetchPublicOptions = {},
): Promise<{ fetchedUrl: string; text: string }> {
  if (sourceType === "telegram") {
    if (!getTelegramConfig().configured) {
      throw new CollectError("تلگرام فعلاً متوقف است تا خطای نشست رفع شود.");
    }
    const { collectTelegramChannel } = await import("./telegram.ts");
    return collectTelegramChannel(address);
  }
  if (sourceType === "bale") {
    if (!getBaleConfig().configured && !getBaleUserConfig().configured) {
      throw new CollectError(
        "توکن بازوی بله روی سرور نیست. پیام را برای بازو Forward کنید و BALE_BOT_TOKEN را بگذارید.",
      );
    }
    const { collectBaleChannel } = await import("./bale.ts");
    return collectBaleChannel(address);
  }
  const fetchedUrl = normalizeCollectUrl(sourceType, address);
  const page = await fetchPublicPage(fetchedUrl, options);
  const text = page.contentType.includes("html") || page.body.includes("<")
    ? htmlToText(page.body)
    : page.body.trim();
  if (!text) throw new CollectError("صفحه عمومی متن قابل استخراج نداشت.");
  return { fetchedUrl: page.finalUrl, text };
}
