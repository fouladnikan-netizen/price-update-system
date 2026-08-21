import { tehranJalaliKey } from "../../web/src/intake/dates.ts";
import { toRegisteredRial } from "../../web/src/intake/rial.ts";
import { loadBaleOffset, saveAppliedPrices, saveBaleOffset, type AppliedDailyPrice } from "./appliedPrices.ts";
import { defaultBaleRequest, type BaleRequest } from "./bale.ts";
import { persistDailyPriceUpserts, readDailyPrices } from "./dailyPersist.ts";
import { extractPrices } from "./extract.ts";
import type { ObservationMatch } from "./match.ts";
import { loadMetaNumber, saveMetaNumber } from "./opsStore.ts";
import { persistenceEnabled } from "./pg.ts";
import { applyPricePolicy, BOT_POLICY_HELP, isHelpCommand, parsePricePolicy } from "./pricePolicy.ts";
import { saveRawText } from "./rawFiles.ts";

const PILOT_GROUP = "rebar";
const PILOT_CATEGORY = "ribbed";
const POLL_MS = 8_000;

type InboxChat = { id?: number | string; type?: string; username?: string; title?: string };
type InboxMessage = {
  date?: number;
  text?: string | null;
  caption?: string | null;
  chat?: InboxChat;
  forward_from_chat?: InboxChat;
  photo?: unknown;
  document?: unknown;
};
type InboxUpdate = {
  update_id?: number;
  message?: InboxMessage;
  edited_message?: InboxMessage;
  channel_post?: InboxMessage;
};

export function sourceLabel(message: InboxMessage): string {
  const from = message.forward_from_chat;
  return from?.title || (from?.username ? `@${from.username}` : "بازو بله");
}

export function messageBody(message: InboxMessage): string {
  return (message.text ?? message.caption ?? "").trim();
}

export function dailyRowsFromObservations(
  observations: ObservationMatch[],
  sourceName: string,
  date = tehranJalaliKey(),
): AppliedDailyPrice[] {
  const now = new Date().toISOString();
  const rows: AppliedDailyPrice[] = [];
  for (const obs of observations) {
    if (!obs.productCode || !obs.brandId) continue;
    if (obs.status === "unmatched" || obs.status === "archived") continue;
    const factoryPrice = toRegisteredRial(obs.factoryPrice, obs.unit);
    const warehousePrice = toRegisteredRial(obs.warehousePrice, obs.unit);
    if (factoryPrice == null && warehousePrice == null) continue;
    rows.push({
      date,
      productCode: obs.productCode,
      brandId: obs.brandId,
      brandName: obs.brandName,
      factoryPrice,
      warehousePrice,
      factorySource: factoryPrice != null ? sourceName : null,
      warehouseSource: warehousePrice != null ? sourceName : null,
      updatedAt: now,
    });
  }
  return rows;
}

function isPrivateChat(chat: InboxChat | undefined): boolean {
  return (chat?.type ?? "").toLowerCase() === "private";
}

async function hydrateDailyCache(): Promise<void> {
  saveAppliedPrices(await readDailyPrices());
}

async function readOffset(): Promise<number> {
  if (persistenceEnabled()) {
    const n = await loadMetaNumber("bale_offset");
    if (n != null) return n;
  }
  return loadBaleOffset();
}

async function writeOffset(offset: number): Promise<void> {
  saveBaleOffset(offset);
  if (persistenceEnabled()) await saveMetaNumber("bale_offset", offset);
}

export async function processBaleInbox(
  request: BaleRequest = defaultBaleRequest,
  extract: typeof extractPrices = extractPrices,
): Promise<{ processed: number; applied: number; lastUpdateId: number }> {
  await hydrateDailyCache();
  const offset = await readOffset();
  const updates = (await request("getUpdates", { timeout: 0, limit: 100, offset: offset || undefined })) as InboxUpdate[];
  if (!Array.isArray(updates) || !updates.length) {
    return { processed: 0, applied: 0, lastUpdateId: offset };
  }

  let applied = 0;
  let lastUpdateId = offset;
  for (const update of updates) {
    lastUpdateId = Math.max(lastUpdateId, Number(update.update_id) || 0);
    const message = update.message ?? update.edited_message;
    if (!message || !isPrivateChat(message.chat)) continue;
    const text = messageBody(message);
    if (!text) continue;
    const chatId = message.chat?.id;
    if (isHelpCommand(text)) {
      if (chatId != null) {
        await request("sendMessage", { chat_id: chatId, text: BOT_POLICY_HELP }).catch(() => undefined);
      }
      continue;
    }
    if (text.startsWith("/")) continue;

    saveRawText({
      fileName: "bale-inbox.txt",
      sourceUrl: `bale:inbox:${sourceLabel(message)}`,
      text,
    });

    try {
      const policy = parsePricePolicy(text);
      if (policy) {
        const outcome = applyPricePolicy(policy);
        if (outcome.rows.length) await persistDailyPriceUpserts(outcome.rows);
        applied += outcome.changed;
        if (chatId != null) {
          await request("sendMessage", { chat_id: chatId, text: outcome.reply }).catch(() => undefined);
        }
        continue;
      }

      const result = await extract({ text, groupCode: PILOT_GROUP, categoryCode: PILOT_CATEGORY });
      const rows = dailyRowsFromObservations(result.observations, sourceLabel(message));
      if (rows.length) {
        await persistDailyPriceUpserts(rows);
        applied += rows.length;
      }
      if (chatId != null) {
        const reply = rows.length
          ? `${rows.length.toLocaleString("fa-IR")} قیمت روی برند و دسته مربوط ثبت شد. انتشار به وب‌سایت خاموش است.`
          : "پیام رسید، ولی به کالای کاتالوگ با کارخانه وصل نشد. محصول جدید ساخته نمی‌شود.";
        await request("sendMessage", { chat_id: chatId, text: reply }).catch(() => undefined);
      }
    } catch (error) {
      const chatId = message.chat?.id;
      if (chatId != null) {
        const detail = error instanceof Error ? error.message : "استخراج انجام نشد.";
        await request("sendMessage", { chat_id: chatId, text: `پیام رسید ولی ثبت نشد. ${detail}` }).catch(() => undefined);
      }
    }
  }

  await writeOffset(lastUpdateId + 1);
  return { processed: updates.length, applied, lastUpdateId };
}

let polling = false;
let timer: ReturnType<typeof setInterval> | null = null;

export function startBaleInboxPoller(): void {
  if (timer) return;
  const tick = async () => {
    if (polling) return;
    polling = true;
    try {
      const result = await processBaleInbox();
      if (result.applied) {
        console.log(`bale inbox applied ${result.applied} prices from ${result.processed} updates`);
      }
    } catch (error) {
      console.error("bale inbox poll failed", error instanceof Error ? error.message : error);
    } finally {
      polling = false;
    }
  };
  void tick();
  timer = setInterval(() => void tick(), POLL_MS);
}
