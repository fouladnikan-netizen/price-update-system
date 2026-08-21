import type { ObservationStatus } from "../mock/data";
import type { IntakeRecord } from "./rawStore";
import { parseExtractResult } from "./extractTypes";
import { getCategoryBrands } from "../mock/category-brands";
import { toRegisteredRial } from "./rial";

const DECISIONS_KEY = "price-update.review-decisions.v1";

export type QueueKind = "unmatched" | "suspicious" | "matched";

export type QueueItem = {
  id: string;
  intakeId: string;
  kind: QueueKind;
  title: string;
  detail: string;
  sourceName: string;
  groupCode: string;
  categoryCode: string;
  rawText: string;
  imageUrl: string | null;
  fileName: string | null;
  productCode: string | null;
  productName: string | null;
  brandId: string | null;
  brandName: string | null;
  factoryPrice: number | null;
  warehousePrice: number | null;
  needsLane: boolean;
  unit: string | null;
  reasons: string[];
  promptVersion: string | null;
  receivedAt: string;
  status: ObservationStatus;
  canPublish: false;
};

export type ReviewDecisions = Record<string, ObservationStatus>;

export function loadDecisions(): ReviewDecisions {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(DECISIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ReviewDecisions;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveDecisions(decisions: ReviewDecisions): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(DECISIONS_KEY, JSON.stringify(decisions));
}

export function clearDecisions(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(DECISIONS_KEY);
}

export function isOpenStatus(status: ObservationStatus): boolean {
  return status === "pending_review" || status === "unmatched" || status === "suspicious" || status === "needs_more_review";
}

export function applySourceCoverage(
  factoryPrice: number | null,
  warehousePrice: number | null,
  coverage: IntakeRecord["priceCoverage"],
  rawText = "",
): { factoryPrice: number | null; warehousePrice: number | null; needsLane: boolean } {
  let factory = factoryPrice;
  let warehouse = warehousePrice;
  if (coverage === "warehouse" && factory != null && warehouse == null) {
    warehouse = factory;
    factory = null;
  } else if (coverage === "factory" && warehouse != null && factory == null) {
    factory = warehouse;
    warehouse = null;
  } else {
    const mentionsFactory = /کارخانه/.test(rawText);
    const mentionsWarehouse = /انبار/.test(rawText);
    if (factory != null && warehouse == null && mentionsWarehouse && !mentionsFactory) {
      warehouse = factory;
      factory = null;
    } else if (warehouse != null && factory == null && mentionsFactory && !mentionsWarehouse) {
      factory = warehouse;
      warehouse = null;
    }
  }
  const oneSide = (factory != null) !== (warehouse != null);
  const labeled = /کارخانه|انبار/.test(rawText);
  return {
    factoryPrice: factory,
    warehousePrice: warehouse,
    needsLane: coverage !== "factory" && coverage !== "warehouse" && oneSide && !labeled,
  };
}

export function isCatalogItem(item: Pick<QueueItem, "productCode">): boolean {
  return Boolean(item.productCode);
}

function kindFromObservation(status: string, productCode: string | null): QueueKind {
  if (status === "archived" || !productCode || status === "unmatched") return "unmatched";
  if (status === "suspicious") return "suspicious";
  return "matched";
}

function initialStatus(kind: QueueKind, observationStatus: string): ObservationStatus {
  if (observationStatus === "archived") return "archived";
  if (kind === "unmatched") return "unmatched";
  if (kind === "suspicious") return "suspicious";
  return "pending_review";
}

function catalogBrandName(
  groupCode: string,
  categoryCode: string,
  brandId: string | null,
  fallback: string | null,
): string | null {
  if (!brandId) return fallback;
  return getCategoryBrands(groupCode, categoryCode).find((item) => item.id === brandId)?.name ?? fallback;
}

export function buildQueueItems(intakes: IntakeRecord[], decisions: ReviewDecisions): QueueItem[] {
  const items: QueueItem[] = [];
  for (const intake of intakes) {
    if (intake.error) {
      const id = `${intake.id}:error`;
      items.push({
        id,
        intakeId: intake.id,
        kind: "unmatched",
        title: intake.inputKind === "image" ? "استخراج تصویر ناموفق — فایل خام حفظ شد" : intake.inputKind === "collect" ? "دریافت زنده ناموفق — متن خام حفظ شد" : "استخراج ناموفق — متن خام حفظ شد",
        detail: intake.error,
        sourceName: intake.sourceName,
        groupCode: intake.groupCode,
        categoryCode: intake.categoryCode,
        rawText: intake.rawText,
        imageUrl: intake.imageUrl ?? null,
        fileName: intake.fileName ?? null,
        productCode: null,
        productName: null,
        brandId: null,
        brandName: null,
        factoryPrice: null,
        warehousePrice: null,
        needsLane: false,
        unit: null,
        reasons: [intake.error],
        promptVersion: intake.promptVersion,
        receivedAt: intake.receivedAt,
        status: decisions[id] ?? "unmatched",
        canPublish: false,
      });
      continue;
    }

    const extracted = parseExtractResult(intake.result);
    const observations = extracted?.observations ?? [];
    if (!observations.length) {
      const id = `${intake.id}:empty`;
      items.push({
        id,
        intakeId: intake.id,
        kind: "unmatched",
        title: intake.rawText ? "متن خام ذخیره شد — منتظر تطبیق" : "بدون مشاهده قیمت",
        detail: intake.rawText
          ? "متن منبع آمده است. تطبیق دوباره را بزنید تا به کالاهای کاتالوگ وصل شود."
          : "متن خام ثبت شد ولی مشاهدهٔ قابل بررسی ساخته نشد. کالا یا برند جدید ساخته نشد.",
        sourceName: intake.sourceName,
        groupCode: intake.groupCode,
        categoryCode: intake.categoryCode,
        rawText: intake.rawText,
        imageUrl: intake.imageUrl ?? null,
        fileName: intake.fileName ?? null,
        productCode: null,
        productName: null,
        brandId: null,
        brandName: null,
        factoryPrice: null,
        warehousePrice: null,
        needsLane: false,
        unit: null,
        reasons: [],
        promptVersion: intake.promptVersion,
        receivedAt: intake.receivedAt,
        status: decisions[id] ?? "unmatched",
        canPublish: false,
      });
      continue;
    }

    observations.forEach((obs, index) => {
      const id = `${intake.id}:${index}`;
      const kind = kindFromObservation(obs.status, obs.productCode);
      const lanes = applySourceCoverage(obs.factoryPrice, obs.warehousePrice, intake.priceCoverage, obs.rawText || intake.rawText);
      const title = obs.productName
        ? `${obs.productName}${obs.brandName ? ` · ${obs.brandName}` : ""}`
        : obs.status === "archived"
          ? "خارج از کاتالوگ — بایگانی"
          : "به کالای کاتالوگ وصل نشد";
      const detail = [
        obs.reasons.length
          ? obs.reasons.join("؛ ")
          : kind === "unmatched"
            ? "این ردیف به کالای تعریف‌شده ما وصل نشد و کالا ساخته نمی‌شود."
            : "این قیمت برای کالای کاتالوگ است و تا تأیید انسان وارد قیمت روز نمی‌شود.",
        lanes.needsLane ? "محل تحویل کارخانه یا انبار در پیام مشخص نیست." : "",
      ]
        .filter(Boolean)
        .join(" ");
      items.push({
        id,
        intakeId: intake.id,
        kind,
        title,
        detail,
        sourceName: intake.sourceName,
        groupCode: intake.groupCode,
        categoryCode: intake.categoryCode,
        rawText: obs.rawText || intake.rawText,
        imageUrl: intake.imageUrl ?? null,
        fileName: intake.fileName ?? null,
        productCode: obs.productCode,
        productName: obs.productName,
        brandId: obs.brandId,
        brandName: catalogBrandName(intake.groupCode, intake.categoryCode, obs.brandId, obs.brandName),
        factoryPrice: toRegisteredRial(lanes.factoryPrice, obs.unit),
        warehousePrice: toRegisteredRial(lanes.warehousePrice, obs.unit),
        needsLane: lanes.needsLane,
        unit: "rial_per_kg",
        reasons: obs.reasons,
        promptVersion: extracted?.promptVersion ?? intake.promptVersion,
        receivedAt: intake.receivedAt,
        status: decisions[id] ?? initialStatus(kind, obs.status),
        canPublish: false,
      });
    });
  }
  return items;
}

export function openQueueCount(items: QueueItem[]): number {
  return items.filter((item) => isOpenStatus(item.status)).length;
}
