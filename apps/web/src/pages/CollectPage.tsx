import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useIntakeState } from "../intake/IntakeState";
import {
  COLLECT_UNAVAILABLE_ERROR,
  collectSource,
  extractText,
  pingCollectApi,
} from "../intake/priceUpdate";
import type { IntakeRecord } from "../intake/rawStore";
import { useSourceState } from "../settings/SourceState";
import { ResizableTable, ResizableTh } from "../tables/ResizableTh";
import { categoryScopeLabel, needsAddress, TELEGRAM_COLLECT_PAUSED, type PriceSource } from "../settings/sourceStore";

function isLiveSource(source: PriceSource): boolean {
  if (TELEGRAM_COLLECT_PAUSED && source.sourceType === "telegram") return false;
  return source.isActive && needsAddress(source.sourceType) && Boolean(source.address.trim());
}

function sourceForUrl(sources: PriceSource[], sourceUrl: string): PriceSource | undefined {
  return sources.find(
    (source) =>
      sourceUrl.includes(source.address.replace(/^https?:\/\//, "").replace(/\/$/, "")) || source.address === sourceUrl,
  );
}

type SourceStep = "idle" | "collecting" | "matching" | "done" | "error";

export function CollectPage() {
  const navigate = useNavigate();
  const { sources } = useSourceState();
  const { intakes, recordIntake, patchIntake, clearQueue } = useIntakeState();
  const live = sources.filter(isLiveSource);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [allBusy, setAllBusy] = useState(false);
  const [allNote, setAllNote] = useState<string | null>(null);
  const [allError, setAllError] = useState<string | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [steps, setSteps] = useState<Record<string, SourceStep>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  function setStep(id: string, step: SourceStep, error = "") {
    setSteps((current) => ({ ...current, [id]: step }));
    setErrors((current) => ({ ...current, [id]: error }));
  }

  async function extractInto(intakeId: string, source: PriceSource, rawText: string): Promise<{ ok: boolean; error?: string }> {
    const extracted = await extractText(source, rawText);
    if ("error" in extracted) {
      patchIntake(intakeId, { error: extracted.error });
      return { ok: false, error: extracted.error };
    }
    patchIntake(intakeId, { error: null, promptVersion: extracted.promptVersion, result: extracted.result });
    return { ok: true };
  }

  async function collectAndMatch(
    source: PriceSource,
    progress?: string,
  ): Promise<{ collected: boolean; matched: boolean }> {
    const prefix = progress ? `${progress} — ` : "";
    setBusyId(source.id);
    setStep(source.id, "collecting");
    setAllNote(`${prefix}دریافت «${source.name}»`);
    const draft: IntakeRecord = {
      id: crypto.randomUUID(),
      sourceId: source.id,
      sourceName: source.name,
      groupCode: source.groupCode,
      categoryCode: source.categoryCode,
      priceCoverage: source.priceCoverage,
      inputKind: "collect",
      rawText: "",
      imageUrl: null,
      fileName: null,
      receivedAt: new Date().toISOString(),
      promptVersion: null,
      canPublish: false,
      error: null,
      result: null,
    };
    try {
      const collectedRaw = await collectSource(source);
      if ("error" in collectedRaw) {
        draft.error = collectedRaw.error;
        draft.rawText = `منبع: ${source.address}`;
        recordIntake(draft);
        setStep(source.id, "error", draft.error);
        return { collected: false, matched: false };
      }
      draft.rawText = collectedRaw.rawText
        ? `منبع: ${collectedRaw.fetchedUrl}\n\n${collectedRaw.rawText}`
        : `منبع: ${source.address}`;
      recordIntake(draft);
      setStep(source.id, "matching");
      setAllNote(`${prefix}تطبیق «${source.name}» با کاتالوگ`);
      const extracted = await extractInto(draft.id, source, collectedRaw.rawText);
      if (!extracted.ok) {
        setStep(source.id, "error", extracted.error ?? "تطبیق انجام نشد.");
        return { collected: true, matched: false };
      }
      setStep(source.id, "done");
      return { collected: true, matched: true };
    } finally {
      setBusyId(null);
    }
  }

  async function runPipeline() {
    if (!live.length || allBusy) return;
    setAllBusy(true);
    setAllError(null);
    setSteps(Object.fromEntries(live.map((source) => [source.id, "idle"])));
    setErrors({});
    if (!(await pingCollectApi())) {
      setAllBusy(false);
      setAllError(COLLECT_UNAVAILABLE_ERROR);
      return;
    }
    let collected = 0;
    let matched = 0;
    for (const [index, source] of live.entries()) {
      const progress = `${index + 1} از ${live.length}`;
      const result = await collectAndMatch(source, progress);
      if (result.collected) collected += 1;
      if (result.matched) {
        matched += 1;
        setAllNote(`تطبیق ${index + 1} از ${live.length} تمام شد: ${source.name}`);
      } else {
        setAllNote(`«${source.name}» تمام نشد؛ می‌روم سراغ منبع بعدی.`);
      }
    }
    setAllBusy(false);
    if (matched) {
      setAllNote(`${matched.toLocaleString("fa-IR")} منبع تطبیق شد. ماتریس باز می‌شود.`);
      navigate("/compare");
      return;
    }
    if (collected) {
      setAllNote("متن‌ها دریافت شد، ولی تطبیق کامل نشد. صف بررسی باز می‌شود.");
      navigate("/review");
      return;
    }
    setAllError("هیچ منبعی دریافت نشد. پیام خطا را در جدول ببینید.");
  }

  async function restoreRecent() {
    setRestoreBusy(true);
    setAllNote(null);
    setAllError(null);
    try {
      const response = await fetch("/api/raw-recent");
      const payload = (await response.json()) as {
        items?: Array<{ id: string; sourceUrl: string; url: string }>;
        error?: string;
      };
      if (!response.ok) {
        setAllError(payload.error ?? "بازیابی فایل خام انجام نشد.");
        return;
      }
      let restored = 0;
      for (const item of payload.items ?? []) {
        if (intakes.some((intake) => intake.rawText.includes(item.sourceUrl))) continue;
        const textResponse = await fetch(item.url);
        const text = await textResponse.text();
        if (!text.trim()) continue;
        const source = sourceForUrl(live, item.sourceUrl) ?? live[0];
        const draft: IntakeRecord = {
          id: crypto.randomUUID(),
          sourceId: source?.id ?? null,
          sourceName: source?.name ?? item.sourceUrl,
          groupCode: source?.groupCode ?? "rebar",
          categoryCode: source?.categoryCode ?? "ribbed",
          priceCoverage: source?.priceCoverage ?? "both",
          inputKind: "collect",
          rawText: `منبع: ${item.sourceUrl}\n\n${text}`,
          imageUrl: null,
          fileName: null,
          receivedAt: new Date().toISOString(),
          promptVersion: null,
          canPublish: false,
          error: null,
          result: null,
        };
        recordIntake(draft);
        restored += 1;
      }
      if (!restored) {
        setAllNote("متن خام جدیدی برای بازیابی نبود.");
        return;
      }
      setAllNote(`${restored.toLocaleString("fa-IR")} متن خام بازیابی شد. حالا همان دکمهٔ اصلی را بزنید تا تطبیق شود.`);
    } catch {
      setAllError("بازیابی فایل خام انجام نشد.");
    } finally {
      setRestoreBusy(false);
    }
  }

  function stepLabel(source: PriceSource): string {
    const step = steps[source.id];
    if (step === "collecting") return "در حال دریافت…";
    if (step === "matching") return "در حال تطبیق…";
    if (step === "done") return "تمام شد";
    if (step === "error") return errors[source.id] || "ناموفق";
    if (allBusy) return "در صف";
    return "";
  }

  return (
    <section className="desk desk-wide">
      <header className="page-head">
        <div>
          <p className="kicker">یک دکمه</p>
          <h1>دریافت و تطبیق</h1>
        </div>
        <p className="page-head-note">
          یک‌بار بزنید. منابع فعال یکی‌یکی دریافت می‌شوند، همان لحظه با کاتالوگ تطبیق می‌گیرند، و بعد ماتریس مقایسه باز
          می‌شود. لازم نیست دکمهٔ جدا برای هر منبع بزنید.
        </p>
      </header>

      <div className="settings-toolbar">
        <button className="btn primary" type="button" disabled={!live.length || allBusy} onClick={() => void runPipeline()}>
          {allBusy ? "در حال دریافت و تطبیق…" : "دریافت و تطبیق همه"}
        </button>
        <Link className="btn" to="/compare">
          ماتریس مقایسه
        </Link>
        <Link className="btn" to="/review">
          صف بررسی
        </Link>
        <button className="btn" type="button" disabled={restoreBusy || allBusy} onClick={() => void restoreRecent()}>
          {restoreBusy ? "در حال بازیابی…" : "بازیابی متن خام قبلی"}
        </button>
        <button
          className="btn"
          type="button"
          disabled={allBusy || intakes.length === 0}
          onClick={() => {
            clearQueue();
            setSteps({});
            setAllNote("صف خالی شد. حالا دریافت و تطبیق همه را بزنید.");
            setAllError(null);
          }}
        >
          خالی کردن صف
        </button>
      </div>
      {allNote ? <p className="settings-banner">{allNote}</p> : null}
      {allError ? <p className="settings-error">{allError}</p> : null}

      <div className="sheet table-wrap">
        <ResizableTable id="collect" className="price-table settings-table">
          <thead>
            <tr>
              <ResizableTh id="name">منبع</ResizableTh>
              <ResizableTh id="category">دسته</ResizableTh>
              <ResizableTh id="address">آدرس عمومی</ResizableTh>
              <ResizableTh id="status">وضعیت</ResizableTh>
            </tr>
          </thead>
          <tbody>
            {live.length ? (
              live.map((source) => (
                <tr key={source.id}>
                  <td>
                    <strong>{source.name}</strong>
                  </td>
                  <td>{categoryScopeLabel(source.groupCode, source.categoryCode)}</td>
                  <td className="cell-wrap">{source.address}</td>
                  <td>
                    {allBusy || steps[source.id] ? (
                      <span className={steps[source.id] === "error" ? "muted" : ""}>{stepLabel(source)}</span>
                    ) : (
                      <button
                        className="btn slim"
                        type="button"
                        disabled={Boolean(busyId)}
                        onClick={() => void collectAndMatch(source)}
                      >
                        فقط این منبع
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="muted">
                  منبع زنده با آدرس عمومی نیست. اول در تنظیمات منابع یک سایت یا کانال عمومی ثبت کنید.{" "}
                  <Link to="/settings/sources">تعریف منبع</Link>
                </td>
              </tr>
            )}
          </tbody>
        </ResizableTable>
      </div>
    </section>
  );
}
