import {
  applySourceTax,
  dailyRowsFromIntakes,
  draftCollect,
  intakesFromKeptSources,
  liveSources,
  toDailyPrice,
} from "../../web/src/intake/priceUpdate.ts";
import type { IntakeRecord } from "../../web/src/intake/rawStore.ts";
import { collectPublicText, isCollectableType } from "./collect.ts";
import { persistDailyPriceUpserts } from "./dailyPersist.ts";
import { extractPrices } from "./extract.ts";
import { appendIntakesToDb, loadSourcesFromDb } from "./opsStore.ts";
import { saveRawText } from "./rawFiles.ts";

export type ScheduledUpdateResult = {
  saved: number;
  collected: number;
  autoPublish: false;
};

export async function runScheduledSourceUpdate(): Promise<ScheduledUpdateResult> {
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

  if (collected.length) await appendIntakesToDb(collected);

  const rows = dailyRowsFromIntakes(intakesFromKeptSources(collected, sources)).map((row) => ({
    ...toDailyPrice(row),
    updatedAt: new Date().toISOString(),
  }));
  if (rows.length) await persistDailyPriceUpserts(rows);

  return { saved: rows.length, collected: collected.length, autoPublish: false };
}
