import { CollectError } from "./collectError.ts";
import { getTelegramConfig } from "./env.ts";
import { parseTelegramChannel, telegramEntity, telegramFetchedUrl } from "./telegramChannel.ts";

const MESSAGE_LIMIT = 80;

type TelegramMessage = {
  date?: number | Date | null;
  message?: string | null;
  caption?: string | null;
  photo?: unknown;
  document?: unknown;
};

type TelegramClientLike = {
  connect: () => Promise<void>;
  checkAuthorization: () => Promise<boolean>;
  getMessages: (entity: string, options: { limit: number }) => Promise<TelegramMessage[]>;
};

export type TelegramClientFactory = (input: {
  apiId: number;
  apiHash: string;
  session: string;
}) => TelegramClientLike | Promise<TelegramClientLike>;

let sharedClient: TelegramClientLike | null = null;

export async function defaultTelegramClientFactory(input: {
  apiId: number;
  apiHash: string;
  session: string;
}): Promise<TelegramClientLike> {
  const { TelegramClient } = await import("telegram");
  const { StringSession } = await import("telegram/sessions/index.js");
  return new TelegramClient(new StringSession(input.session), input.apiId, input.apiHash, {
    connectionRetries: 3,
  }) as unknown as TelegramClientLike;
}

function formatStamp(value: number | Date | null | undefined): string {
  const date = value instanceof Date ? value : typeof value === "number" ? new Date(value * 1000) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toISOString().replace("T", " ").slice(0, 16);
}

function messageText(item: TelegramMessage): string {
  const body = (item.message ?? item.caption ?? "").trim();
  const media = item.photo || item.document ? "[فایل یا تصویر کانال]" : "";
  return [body, media].filter(Boolean).join("\n");
}

export async function collectTelegramChannel(
  address: string,
  createClient: TelegramClientFactory = defaultTelegramClientFactory,
): Promise<{ fetchedUrl: string; text: string }> {
  const config = getTelegramConfig();
  if (!config.configured) {
    throw new CollectError("اکانت سازمانی تلگرام روی سرور تنظیم نشده است.");
  }
  const ref = parseTelegramChannel(address);
  if (!sharedClient) {
    sharedClient = await createClient({
      apiId: config.apiId,
      apiHash: config.apiHash,
      session: config.session,
    });
    await sharedClient.connect();
    if (!(await sharedClient.checkAuthorization())) {
      sharedClient = null;
      throw new CollectError("نشست تلگرام منقضی است. از پوشه apps/api دستور npm run telegram:login را اجرا کنید.");
    }
  }

  let messages: TelegramMessage[];
  try {
    messages = await sharedClient.getMessages(telegramEntity(ref), { limit: MESSAGE_LIMIT });
  } catch {
    throw new CollectError(
      "این کانال برای اکانت سازمانی قابل خواندن نیست. اول با همان اکانت عضو شوید؛ از دعوت‌نامه خصوصی عبور نمی‌شود.",
    );
  }

  const blocks = [...messages]
    .reverse()
    .map((item) => {
      const text = messageText(item);
      if (!text) return "";
      const stamp = formatStamp(item.date);
      return stamp ? `${stamp}\n${text}` : text;
    })
    .filter(Boolean);

  if (!blocks.length) throw new CollectError("کانال متن قیمت قابل استخراج نداشت.");
  return {
    fetchedUrl: telegramFetchedUrl(ref),
    text: blocks.join("\n\n"),
  };
}
