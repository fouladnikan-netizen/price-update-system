import type { DailyPrice } from "./dailyPriceStore";
import { buildComparisonMatrix, type MatrixRow } from "./compare";
import { tehranJalaliKey } from "./dates";
import { toRegisteredRial } from "./rial";
import { buildQueueItems, type ReviewDecisions } from "./queueStore";
import type { IntakeRecord } from "./rawStore";
import { canRequestPublish, tehranDate, type PublicationRecord } from "../publish/publishStore";
import {
  isDroppedSource,
  needsAddress,
  TELEGRAM_COLLECT_PAUSED,
  type PriceSource,
  type TaxMode,
} from "../settings/sourceStore";

export function liveSources(
  sources: PriceSource[],
  scope?: { groupCode?: string; categoryCode?: string },
): PriceSource[] {
  return sources.filter((source) => {
    if (!source.isActive || !needsAddress(source.sourceType) || !source.address.trim()) return false;
    if (isDroppedSource(source)) return false;
    if (TELEGRAM_COLLECT_PAUSED && source.sourceType === "telegram") return false;
    if (scope?.groupCode && source.groupCode !== scope.groupCode) return false;
    if (scope?.categoryCode && source.categoryCode !== scope.categoryCode) return false;
    return true;
  });
}

export function activeSourcesInScope(
  sources: PriceSource[],
  scope?: { groupCode?: string; categoryCode?: string },
): PriceSource[] {
  return sources.filter((source) => {
    if (!source.isActive) return false;
    if (isDroppedSource(source)) return false;
    if (scope?.groupCode && source.groupCode !== scope.groupCode) return false;
    if (scope?.categoryCode && source.categoryCode !== scope.categoryCode) return false;
    return true;
  });
}

function stripIncludedVat(price: number | null | undefined): number | null {
  if (price == null || price <= 0) return null;
  return Math.round(price / 1.1 / 10) * 10;
}

export function applySourceTax(result: unknown, taxMode: TaxMode | undefined): unknown {
  if (taxMode !== "includes_vat" || !result || typeof result !== "object") return result;
  const data = result as { observations?: Array<Record<string, unknown>> };
  if (!Array.isArray(data.observations)) return result;
  return {
    ...data,
    observations: data.observations.map((obs) => ({
      ...obs,
      factoryPrice: stripIncludedVat(typeof obs.factoryPrice === "number" ? obs.factoryPrice : null),
      warehousePrice: stripIncludedVat(typeof obs.warehousePrice === "number" ? obs.warehousePrice : null),
    })),
  };
}

export function describeIntakeResult(intake: IntakeRecord): string {
  if (intake.error) return `${intake.sourceName}: ${intake.error}`;
  const rows = dailyRowsFromIntakes([intake]);
  if (!rows.length) {
    return `${intake.sourceName}: متن آمد، ولی به کالای کاتالوگ با کارخانه وصل نشد.`;
  }
  return `${intake.sourceName}: ${rows.length.toLocaleString("fa-IR")} قیمت ریال`;
}

export function sourceUpdateReport(
  sources: PriceSource[],
  collected: IntakeRecord[],
  scope?: { groupCode?: string; categoryCode?: string },
): string[] {
  const lines: string[] = [];
  const inScope = activeSourcesInScope(sources, scope);
  const live = liveSources(sources, scope);
  const liveIds = new Set(live.map((item) => item.id));
  const collectedBySource = new Map(collected.map((item) => [item.sourceId, item]));

  for (const source of inScope) {
    if (!liveIds.has(source.id)) {
      if (TELEGRAM_COLLECT_PAUSED && source.sourceType === "telegram") {
        lines.push(`${source.name}: تلگرام فعلاً متوقف است تا خطای نشست رفع شود.`);
        continue;
      }
      lines.push(
        needsAddress(source.sourceType)
          ? `${source.name}: آدرس عمومی ندارد و خوانده نشد.`
          : `${source.name}: فایل و ورود دستی با دکمه به‌روزرسانی خوانده نمی‌شود. ورود دستی را بزنید.`,
      );
      continue;
    }
    const intake = collectedBySource.get(source.id);
    if (!intake) {
      lines.push(`${source.name}: در این اجرا خوانده نشد.`);
      continue;
    }
    lines.push(describeIntakeResult(intake));
  }

  if (scope?.groupCode) {
    const others = sources.filter(
      (source) =>
        source.isActive && (source.groupCode !== scope.groupCode || source.categoryCode !== scope.categoryCode),
    );
    if (others.length) {
      lines.push(
        `${others.length.toLocaleString("fa-IR")} منبع فعال در دسته دیگر در این صفحه خوانده نشد: ${others
          .map((item) => item.name)
          .join("، ")}`,
      );
    }
  }

  return lines;
}

export function intakesFromKeptSources(intakes: IntakeRecord[], sources: PriceSource[]): IntakeRecord[] {
  const allowedIds = new Set(sources.filter((item) => item.isActive && !isDroppedSource(item)).map((item) => item.id));
  return intakes.filter((intake) => {
    if (isDroppedSource({ id: intake.sourceId, name: intake.sourceName })) return false;
    if (intake.sourceId) return allowedIds.has(intake.sourceId);
    return true;
  });
}

export function draftCollect(source: PriceSource): IntakeRecord {
  return {
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
}

export const COLLECT_UNAVAILABLE_ERROR =
  "سرویس دریافت خاموش است. API باید روی پورت ۸۷۸۷ در حال اجرا باشد.";
export const EXTRACT_UNAVAILABLE_ERROR =
  "سرویس استخراج خاموش است. API باید روی پورت ۸۷۸۷ در حال اجرا باشد.";
export const EXTRACT_TIMEOUT_ERROR =
  "استخراج بیش از حد طول کشید؛ این منبع رد شد تا بقیه خوانده شوند.";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readApiJson<T extends { error?: string }>(
  response: Response,
  fallback: string,
): Promise<{ ok: true; payload: T } | { ok: false; error: string }> {
  const text = await response.text();
  try {
    const payload = JSON.parse(text) as T;
    if (!response.ok) return { ok: false, error: payload.error ?? fallback };
    return { ok: true, payload };
  } catch {
    return { ok: false, error: response.ok ? "پاسخ سرویس خوانده نشد." : fallback };
  }
}

async function postApiJson<T extends { error?: string }>(
  path: string,
  body: unknown,
  unavailable: string,
  fallback: string,
  options: { timeoutMs?: number; retries?: number; timeoutError?: string } = {},
): Promise<{ ok: true; payload: T } | { ok: false; error: string }> {
  const retries = options.retries ?? 3;
  let last: { ok: false; error: string } = { ok: false, error: unavailable };
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
      });
      return await readApiJson<T>(response, fallback);
    } catch (error) {
      const timedOut =
        error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      if (timedOut) return { ok: false, error: options.timeoutError ?? EXTRACT_TIMEOUT_ERROR };
      last = { ok: false, error: unavailable };
      if (attempt < retries - 1) await sleep(700 * (attempt + 1));
    }
  }
  return last;
}

export async function pingCollectApi(): Promise<boolean> {
  try {
    const response = await fetch("/api/health");
    return response.ok;
  } catch {
    return false;
  }
}

export async function collectSource(
  source: PriceSource,
): Promise<{ rawText: string; fetchedUrl: string } | { error: string }> {
  const result = await postApiJson<{ error?: string; rawText?: string; fetchedUrl?: string }>(
    "/api/collect",
    {
      sourceType: source.sourceType,
      address: source.address,
      groupCode: source.groupCode,
      categoryCode: source.categoryCode,
    },
    COLLECT_UNAVAILABLE_ERROR,
    "دریافت انجام نشد.",
    { timeoutMs: 40_000, retries: 3, timeoutError: "خواندن صفحه بیش از حد طول کشید." },
  );
  if (!result.ok) return { error: result.error };
  return { rawText: result.payload.rawText ?? "", fetchedUrl: result.payload.fetchedUrl ?? source.address };
}

export async function extractText(
  source: PriceSource,
  text: string,
): Promise<{ result: unknown; promptVersion: string | null } | { error: string }> {
  const result = await postApiJson<{ promptVersion?: string; error?: string }>(
    "/api/extract",
    {
      text,
      groupCode: source.groupCode,
      categoryCode: source.categoryCode,
    },
    EXTRACT_UNAVAILABLE_ERROR,
    "استخراج انجام نشد.",
    { timeoutMs: 55_000, retries: 1, timeoutError: EXTRACT_TIMEOUT_ERROR },
  );
  if (!result.ok) return { error: result.error };
  return { result: result.payload, promptVersion: result.payload.promptVersion ?? null };
}

export function dailyRowsFromIntakes(intakes: IntakeRecord[], decisions: ReviewDecisions = {}): MatrixRow[] {
  return buildComparisonMatrix(buildQueueItems(intakes, decisions)).filter(
    (row) => Boolean(row.productCode) && Boolean(row.brandId) && (row.targetFactory != null || row.targetWarehouse != null),
  );
}

export function toDailyPrice(row: MatrixRow): Omit<DailyPrice, "updatedAt"> {
  return {
    date: tehranJalaliKey(),
    productCode: row.productCode,
    brandId: row.brandId,
    brandName: row.brandName,
    factoryPrice: toRegisteredRial(row.targetFactory),
    warehousePrice: toRegisteredRial(row.targetWarehouse),
    factorySource: row.factorySource,
    warehouseSource: row.warehouseSource,
  };
}

export async function queueWebsitePrice(
  saved: DailyPrice,
  record: (item: PublicationRecord) => void,
): Promise<void> {
  const payload = {
    queueItemId: `daily:${saved.date}:${saved.productCode}:${saved.brandId ?? ""}`,
    productCode: saved.productCode,
    brandId: saved.brandId,
    brandName: saved.brandName,
    factoryPrice: saved.factoryPrice,
    warehousePrice: saved.warehousePrice,
    unit: "rial_per_kg",
    priceDate: tehranDate(),
    reviewStatus: "approved" as const,
    autoGenerated: false,
  };
  if (
    !canRequestPublish({
      status: "approved",
      productCode: saved.productCode,
      factoryPrice: saved.factoryPrice,
      warehousePrice: saved.warehousePrice,
    })
  ) {
    return;
  }
  try {
    const response = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as {
      status?: PublicationRecord["status"];
      dryRun?: boolean;
      errorMessage?: string;
    };
    if (!response.ok) return;
    record({
      id: crypto.randomUUID(),
      queueItemId: payload.queueItemId,
      productCode: saved.productCode,
      brandId: saved.brandId,
      brandName: saved.brandName,
      factoryPrice: saved.factoryPrice,
      warehousePrice: saved.warehousePrice,
      unit: "rial_per_kg",
      priceDate: payload.priceDate,
      idempotencyKey: `${payload.queueItemId}:${payload.priceDate}`,
      status: body.status ?? "queued",
      autoGenerated: false,
      dryRun: Boolean(body.dryRun),
      websiteOperationId: null,
      errorMessage: body.errorMessage ?? null,
      requestedAt: new Date().toISOString(),
    });
  } catch {
    // جدول محلی منبع حقیقت است؛ صف وب‌سایت جدا می‌ماند.
  }
}
