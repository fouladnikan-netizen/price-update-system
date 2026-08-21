import { CollectError } from "./collectError.ts";
import { getBaleUserConfig } from "./env.ts";
import { baleFetchedUrl, parseBaleChannel, type BaleChannelRef } from "./baleChannel.ts";

const MESSAGE_LIMIT = 80;

type BaleUserChat = {
  id?: string;
  username?: string;
  title?: string;
};

type BaleUserMessage = {
  date?: number;
  content?: string;
  text?: string;
  caption?: string;
};

export type BaleUserClientLike = {
  connect: () => Promise<void>;
  disconnect?: () => Promise<void>;
  get_me?: () => Promise<{ username?: string; name?: string; id?: number }>;
  search_username: (query: string) => Promise<{ group?: BaleUserChat; user?: BaleUserChat }>;
  get_chat: (chatId: string) => Promise<BaleUserChat | undefined>;
  load_history: (chatId: string, fromDate: number, limit: number) => Promise<BaleUserMessage[]>;
};

export type BaleUserClientFactory = (session: string) => BaleUserClientLike | Promise<BaleUserClientLike>;

let sharedClient: BaleUserClientLike | null = null;

export async function defaultBaleUserClientFactory(session: string): Promise<BaleUserClientLike> {
  const mod = (await import("balejs")) as { Client: new (auth: string) => BaleUserClientLike };
  const client = new mod.Client(session);
  await client.connect();
  return client;
}

function formatStamp(value: number | undefined): string {
  if (!value) return "";
  const date = new Date(value > 1e12 ? value : value * 1000);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().replace("T", " ").slice(0, 16);
}

function messageText(item: BaleUserMessage): string {
  const body = (item.content ?? item.text ?? item.caption ?? "").trim();
  return body;
}

async function resolveMemberChat(client: BaleUserClientLike, ref: BaleChannelRef): Promise<string> {
  if (ref.kind === "chatId") {
    const id = ref.chatId.replace(/^-100/, "").replace(/^-/, "");
    const chat = await client.get_chat(`${id}|3`);
    if (!chat?.id) {
      throw new CollectError(
        "این کانال برای اکانت سازمانی قابل خواندن نیست. با همان شماره‌ای که وارد شده‌اید عضو شوید؛ از دعوت‌نامه خصوصی عبور نمی‌شود.",
      );
    }
    return chat.id;
  }

  const found = await client.search_username(ref.username);
  const chat = found.group ?? found.user;
  if (!chat?.id) {
    throw new CollectError(
      "این کانال برای اکانت سازمانی قابل خواندن نیست. با همان شماره‌ای که وارد شده‌اید عضو شوید؛ از دعوت‌نامه خصوصی عبور نمی‌شود.",
    );
  }
  return chat.id;
}

export async function collectBaleChannelAsUser(
  address: string,
  createClient: BaleUserClientFactory = defaultBaleUserClientFactory,
): Promise<{ fetchedUrl: string; text: string }> {
  const config = getBaleUserConfig();
  if (!config.configured) {
    throw new CollectError("نشست اکانت سازمانی بله روی سرور تنظیم نشده است. npm run bale:login را اجرا کنید.");
  }
  const ref = parseBaleChannel(address);
  if (!sharedClient) {
    sharedClient = await createClient(config.session);
  }

  let chatId: string;
  try {
    chatId = await resolveMemberChat(sharedClient, ref);
  } catch (error) {
    if (error instanceof CollectError) throw error;
    throw new CollectError(
      "این کانال برای اکانت سازمانی قابل خواندن نیست. با همان شماره‌ای که وارد شده‌اید عضو شوید؛ از دعوت‌نامه خصوصی عبور نمی‌شود.",
    );
  }

  let messages: BaleUserMessage[];
  try {
    messages = await sharedClient.load_history(chatId, -1, MESSAGE_LIMIT);
  } catch {
    throw new CollectError(
      "این کانال برای اکانت سازمانی قابل خواندن نیست. با همان شماره‌ای که وارد شده‌اید عضو شوید؛ از دعوت‌نامه خصوصی عبور نمی‌شود.",
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
    fetchedUrl: baleFetchedUrl(ref),
    text: blocks.join("\n\n"),
  };
}
