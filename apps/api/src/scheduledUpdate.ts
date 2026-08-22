import {
  applySourceTax,
  dailyRowsFromIntakes,
  draftCollect,
  intakesFromKeptSources,
  liveSources,
  toDailyPrice,
} from "../../web/src/intake/priceUpdate.ts";
import { countDailyPriceChanges, mergeMissingDailyPrices, type DailyPrice } from "../../web/src/intake/dailyPriceStore.ts";
import type { IntakeRecord } from "../../web/src/intake/rawStore.ts";
import type { PriceSource } from "../../web/src/settings/sourceStore.ts";
import type { ScheduleSlotMode } from "../../web/src/settings/scheduleStore.ts";
import { collectPublicText, isCollectableType } from "./collect.ts";
import { persistDailyPriceUpserts, readDailyPrices } from "./dailyPersist.ts";
import { extractPrices } from "./extract.ts";
import { appendIntakesToDb, loadSourcesFromDb } from "./opsStore.ts";
import { saveRawText } from "./rawFiles.ts";

export type ScheduledUpdateResult = {
  saved: number;
  collected: number;
  filled: number;
  changed: number;
  mode: ScheduleSlotMode;
  autoPublish: false;
};

async function collectLiveSources(): Promise<{ collected: IntakeRecord[]; sources: PriceSource[] }> {
  const fromDb = await loadSourcesFromDb();
  const sources = fromDb?.sources ?? [];
  const live = liveSources(sources);
  const collected: IntakeRecord[] = [];

  for (const source of live) {
    const draft = draftCollect(source);
    if (!isCollectableType(source.sourceType)) {
      draft.error = "این نوع منبع در زمان‌بند سرور خوانده نمی‌شود.";
      collected.push(draft);
      continue;
    }
    try {
      const page = await collectPublicText(source.sourceType, source.address);
      saveRawText({
        fileName: `${source.sourceType}.txt`,
        sourceUrl: page.fetchedUrl,
        text: page.text,
      });
      draft.rawText = `منبع: ${page.fetchedUrl}\n\n${page.text}`;
      const extracted = await extractPrices({
        text: page.text,
        groupCode: source.groupCode,
        categoryCode: source.categoryCode,
      });
      draft.promptVersion = extracted.promptVersion;
      draft.result = applySourceTax(extracted, source.taxMode);
      draft.error = null;
    } catch (error) {
      draft.error = error instanceof Error ? error.message : "دریافت انجام نشد.";
    }
    collected.push(draft);
  }

  return { collected, sources };
}

function incomingDailyPrices(collected: IntakeRecord[], sources: Parameters<typeof intakesFromKeptSources>[1]): DailyPrice[] {
  return dailyRowsFromIntakes(intakesFromKeptSources(collected, sources)).map((row) => ({
    ...toDailyPrice(row),
    updatedAt: new Date().toISOString(),
  }));
}

export async function runScheduledSourceUpdate(mode: ScheduleSlotMode = "first"): Promise<ScheduledUpdateResult> {
  const { collected, sources } = await collectLiveSources();
  if (collected.length) await appendIntakesToDb(collected);

  const incoming = incomingDailyPrices(collected, sources);
  const existing = await readDailyPrices();
  const empty = { saved: 0, collected: collected.length, filled: 0, changed: 0, mode, autoPublish: false as const };

  if (mode === "missing") {
    const filled = mergeMissingDailyPrices(existing, incoming);
    if (!filled.length) return empty;
    await persistDailyPriceUpserts(filled);
    return { ...empty, saved: filled.length, filled: filled.length };
  }

  const changed = countDailyPriceChanges(existing, incoming);
  if (incoming.length) await persistDailyPriceUpserts(incoming);
  return {
    ...empty,
    saved: incoming.length,
    filled: incoming.filter((row) => !existing.some((item) => item.date === row.date && item.productCode === row.productCode && (item.brandId ?? null) === (row.brandId ?? null))).length,
    changed,
  };
}
