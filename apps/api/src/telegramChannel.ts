import { CollectError } from "./collectError.ts";

export type TelegramChannelRef =
  | { kind: "username"; username: string }
  | { kind: "channelId"; channelId: string };

export function parseTelegramChannel(address: string): TelegramChannelRef {
  const raw = address.trim();
  if (!raw) throw new CollectError("آدرس منبع خالی است.");
  const handle = raw.match(/^@([A-Za-z0-9_]{3,})$/);
  if (handle) return { kind: "username", username: handle[1] };

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new CollectError("آدرس منبع معتبر نیست.");
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "t.me" && host !== "telegram.me") {
    throw new CollectError("برای تلگرام فقط لینک یا شناسه کانال مجاز است.");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "joinchat" || parts[0]?.startsWith("+") || parts[0]?.startsWith("%2B")) {
    throw new CollectError("لینک دعوت خوانده نمی‌شود. اول با اکانت سازمانی عضو شوید، بعد شناسه کانال را بگذارید.");
  }
  if (parts[0] === "c") {
    const channelId = parts[1]?.replace(/\D/g, "");
    if (!channelId) throw new CollectError("شناسه کانال تلگرام نامعتبر است.");
    return { kind: "channelId", channelId };
  }
  const username = parts[0] === "s" ? parts[1] : parts[0];
  if (!username || !/^[A-Za-z0-9_]{3,}$/.test(username)) {
    throw new CollectError("شناسه کانال تلگرام نامعتبر است.");
  }
  return { kind: "username", username };
}

export function telegramEntity(ref: TelegramChannelRef): string {
  return ref.kind === "username" ? ref.username : `-100${ref.channelId}`;
}

export function telegramFetchedUrl(ref: TelegramChannelRef): string {
  return ref.kind === "username" ? `https://t.me/${ref.username}` : `https://t.me/c/${ref.channelId}`;
}
