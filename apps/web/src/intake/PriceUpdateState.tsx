import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useDailyPrices } from "./DailyPriceState";
import { useIntakeState } from "./IntakeState";
import {
  applySourceTax,
  COLLECT_UNAVAILABLE_ERROR,
  collectSource,
  dailyRowsFromIntakes,
  draftCollect,
  extractText,
  intakesFromKeptSources,
  liveSources,
  pingCollectApi,
  queueWebsitePrice,
  sourceUpdateReport,
  toDailyPrice,
} from "./priceUpdate";
import type { IntakeRecord } from "./rawStore";
import { usePublishState } from "../publish/PublishState";
import { useSourceState } from "../settings/SourceState";
import { tehranJalaliKey } from "./dates";

type UpdateScope = { groupCode?: string; categoryCode?: string };

type PriceUpdateContextValue = {
  busy: boolean;
  note: string | null;
  error: string | null;
  report: string[];
  lastSaved: number;
  runUpdate: (scope?: UpdateScope) => Promise<number>;
  applyIntakesToTable: (intakes: IntakeRecord[]) => Promise<number>;
};

const PriceUpdateContext = createContext<PriceUpdateContextValue | null>(null);

export function PriceUpdateStateProvider({ children }: { children: ReactNode }) {
  const { sources } = useSourceState();
  const { intakes, recordIntake, patchIntake } = useIntakeState();
  const { saveTarget, replaceDate } = useDailyPrices();
  const { record } = usePublishState();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<string[]>([]);
  const [lastSaved, setLastSaved] = useState(0);
  const busyRef = useRef(false);
  const intakesRef = useRef(intakes);
  intakesRef.current = intakes;

  const applyIntakesToTable = useCallback(
    async (incoming: IntakeRecord[]) => {
      const rows = dailyRowsFromIntakes(intakesFromKeptSources(incoming, sources));
      let saved = 0;
      for (const row of rows) {
        const stored = saveTarget(toDailyPrice(row));
        await queueWebsitePrice(stored, record);
        saved += 1;
      }
      setLastSaved(saved);
      return saved;
    },
    [record, saveTarget, sources],
  );

  const rebuildFromStored = useCallback(() => {
    const kept = intakesFromKeptSources(intakesRef.current, sources);
    const rows = dailyRowsFromIntakes(kept).map((row) => toDailyPrice(row));
    const saved = replaceDate(tehranJalaliKey(), rows);
    const names = [...new Set(kept.filter((item) => !item.error).map((item) => item.sourceName))];
    setLastSaved(saved.length);
    setError(null);
    setNote(
      saved.length
        ? `${saved.length.toLocaleString("fa-IR")} قیمت از ${names.length.toLocaleString("fa-IR")} منبع ذخیره‌شده، بدون جمع‌آوری مجدد، در جدول امروز ثبت شد.`
        : "از منابع باقی‌مانده مشاهدهٔ قابل ثبت نبود. قیمت صفر نوشته نمی‌شود.",
    );
    setReport(
      names.length
        ? names.map((name) => `${name}: از دادهٔ ذخیره‌شده، بدون خواندن دوبارهٔ سایت`)
        : ["پیوان کنار گذاشته شد. مشاهدهٔ دیگری برای ثبت نبود."],
    );
    return saved.length;
  }, [replaceDate, sources]);

  useEffect(() => {
    rebuildFromStored();
  }, [rebuildFromStored]);

  const runUpdate = useCallback(async (scope?: UpdateScope) => {
    if (busyRef.current) return 0;
    const live = liveSources(sources, scope);
    if (!live.length) {
      setError(
        scope?.categoryCode
          ? "برای این دسته منبع فعال با آدرس عمومی نیست. منبع دستهٔ دیگر در این صفحه خوانده نمی‌شود."
          : "منبع فعال با آدرس عمومی نیست. اول در تنظیمات منابع ثبت کنید.",
      );
      setNote(null);
      setReport(sourceUpdateReport(sources, [], scope));
      return 0;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const collected: IntakeRecord[] = [];
    try {
      if (!(await pingCollectApi())) {
        setError(COLLECT_UNAVAILABLE_ERROR);
        setNote(null);
        setReport(sourceUpdateReport(sources, [], scope));
        return 0;
      }
      for (const [index, source] of live.entries()) {
        setNote(`دریافت ${index + 1} از ${live.length}: ${source.name}`);
        const draft = draftCollect(source);
        const collectedRaw = await collectSource(source);
        if ("error" in collectedRaw) {
          draft.error = collectedRaw.error;
          draft.rawText = `منبع: ${source.address}`;
          recordIntake(draft);
          collected.push(draft);
          continue;
        }
        draft.rawText = `منبع: ${collectedRaw.fetchedUrl}\n\n${collectedRaw.rawText}`;
        recordIntake(draft);
        setNote(`تطبیق ${index + 1} از ${live.length}: ${source.name}`);
        const extracted = await extractText(source, collectedRaw.rawText);
        if ("error" in extracted) {
          draft.error = extracted.error;
          patchIntake(draft.id, { error: extracted.error });
          collected.push(draft);
          continue;
        }
        const taxed = applySourceTax(extracted.result, source.taxMode);
        const next = { ...draft, error: null, promptVersion: extracted.promptVersion, result: taxed };
        patchIntake(draft.id, { error: null, promptVersion: extracted.promptVersion, result: taxed });
        collected.push(next);
      }
      const saved = await applyIntakesToTable(collected);
      const lines = sourceUpdateReport(sources, collected, scope);
      setReport(lines);
      const extractFailed = collected.filter((item) => item.error);
      const failedLabel = extractFailed.map((item) => item.sourceName).filter(Boolean).join("، ");
      if (saved) {
        setNote(
          `${saved.toLocaleString("fa-IR")} قیمت ریال در جدول امروز ثبت شد. جزئیات هر منبع پایین دکمه است.`,
        );
        setError(null);
      } else if (extractFailed.length === collected.length && extractFailed[0]?.error) {
        const sameError = extractFailed.every((item) => item.error === extractFailed[0]?.error);
        setError(
          sameError && extractFailed[0].error === COLLECT_UNAVAILABLE_ERROR
            ? COLLECT_UNAVAILABLE_ERROR
            : failedLabel
              ? `${failedLabel}: ${extractFailed[0].error}`
              : extractFailed[0].error,
        );
        setNote(null);
      } else {
        setError("متنی دریافت شد، ولی به کالای کاتالوگ با کارخانه مشخص وصل نشد. قیمت صفر نوشته نمی‌شود.");
        setNote(null);
      }
      return saved;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [applyIntakesToTable, patchIntake, recordIntake, sources]);

  const value = useMemo(
    () => ({ busy, note, error, report, lastSaved, runUpdate, applyIntakesToTable }),
    [applyIntakesToTable, busy, error, lastSaved, note, report, runUpdate],
  );

  return <PriceUpdateContext.Provider value={value}>{children}</PriceUpdateContext.Provider>;
}

export function usePriceUpdate(): PriceUpdateContextValue {
  const value = useContext(PriceUpdateContext);
  if (!value) throw new Error("PriceUpdateStateProvider is missing");
  return value;
}
