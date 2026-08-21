import { CollectError } from "./collectError.ts";

export type BaleChannelRef =
  | { kind: "username"; username: string }
  | { kind: "chatId"; chatId: string };

const BALE_HOSTS = new Set(["ble.ir", "bale.ai", "web.bale.ai"]);

export function parseBaleChannel(address: string): BaleChannelRef {
  const raw = address.trim();
  if (!raw) throw new CollectError("آدرس منبع خالی است.");

  const handle = raw.match(/^@([A-Za-z0-9_]{3,})$/);
  if (handle) return { kind: "username", username: handle[1] };

  if (/^-?\d{5,}$/.test(raw)) return { kind: "chatId", chatId: raw };

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new CollectError("آدرس منبع معتبر نیست.");
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (!BALE_HOSTS.has(host)) {
    throw new CollectError("برای بله فقط لینک ble.ir یا شناسه کانال مجاز است.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const first = parts[0]?.replace(/^@/, "") ?? "";
  if (!first || first === "join" || first === "joinchat" || first.startsWith("+") || first.startsWith("%2B")) {
    throw new CollectError("لینک دعوت خوانده نمی‌شود. اول بازوی سازمانی را ادمین کانال کنید، بعد شناسه کانال را بگذارید.");
  }
  if (/^-?\d{5,}$/.test(first) || first === "c") {
    const chatId = first === "c" ? parts[1]?.replace(/[^\d-]/g, "") : first;
    if (!chatId) throw new CollectError("شناسه کانال بله نامعتبر است.");
    return { kind: "chatId", chatId };
  }
  if (!/^[A-Za-z0-9_]{3,}$/.test(first)) {
    throw new CollectError("شناسه کانال بله نامعتبر است.");
  }
  return { kind: "username", username: first };
}

export function baleChatId(ref: BaleChannelRef): string {
  return ref.kind === "username" ? `@${ref.username}` : ref.chatId;
}

export function baleFetchedUrl(ref: BaleChannelRef): string {
  return ref.kind === "username" ? `https://ble.ir/${ref.username}` : `https://ble.ir/c/${ref.chatId.replace(/^-/, "")}`;
}

export function balePreviewUrl(ref: BaleChannelRef): string {
  if (ref.kind === "chatId") {
    throw new CollectError("کانال با شناسهٔ داخلی فقط با بازوی سازمانی خوانده می‌شود. اول BALE_BOT_TOKEN را بگذارید.");
  }
  return `https://ble.ir/${ref.username}`;
}
