import { approvedCeiling } from "./ceiling";
import { isStaleDate, parseJalaliDate, tehranJalaliKey } from "./dates";
import { isCatalogItem, type QueueItem } from "./queueStore";

export type QuoteFlag = "stale" | "outlier";

export type MatrixQuote = {
  queueId: string;
  sourceName: string;
  status: QueueItem["status"];
  factoryPrice: number | null;
  warehousePrice: number | null;
  sourceDate: string | null;
  flags: QuoteFlag[];
  usable: boolean;
};

export type MatrixRow = {
  key: string;
  productCode: string;
  productName: string;
  brandId: string | null;
  brandName: string | null;
  quotes: MatrixQuote[];
  targetFactory: number | null;
  targetWarehouse: number | null;
  factorySource: string | null;
  warehouseSource: string | null;
};

const OUTLIER_RATIO = 0.12;

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function outlierFlags(values: Array<number | null>): boolean[] {
  const present = values.filter((value): value is number => value !== null && value > 0);
  const mid = median(present);
  if (mid == null || present.length < 2) return values.map(() => false);
  return values.map((value) => {
    if (value == null || value <= 0) return false;
    return Math.abs(value - mid) / mid > OUTLIER_RATIO;
  });
}

function usableQuote(item: QueueItem, flags: QuoteFlag[]): boolean {
  if (item.status === "rejected" || item.status === "archived" || item.status === "unmatched") return false;
  if (item.status === "approved") return true;
  if (flags.includes("stale") || flags.includes("outlier")) return false;
  return item.status === "pending_review" || item.status === "suspicious" || item.status === "needs_more_review";
}

export function buildComparisonMatrix(items: QueueItem[], today = tehranJalaliKey()): MatrixRow[] {
  const catalog = items.filter(isCatalogItem);
  const groups = new Map<string, QueueItem[]>();
  for (const item of catalog) {
    const key = `${item.productCode}::${item.brandId ?? ""}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  return [...groups.entries()].map(([key, quotes]) => {
    const factoryOut = outlierFlags(quotes.map((item) => item.factoryPrice));
    const warehouseOut = outlierFlags(quotes.map((item) => item.warehousePrice));
    const mapped: MatrixQuote[] = quotes.map((item, index) => {
      const sourceDate = parseJalaliDate(item.rawText);
      const flags: QuoteFlag[] = [];
      if (isStaleDate(sourceDate, today)) flags.push("stale");
      if (factoryOut[index] || warehouseOut[index]) flags.push("outlier");
      return {
        queueId: item.id,
        sourceName: item.sourceName,
        status: item.status,
        factoryPrice: item.factoryPrice,
        warehousePrice: item.warehousePrice,
        sourceDate,
        flags,
        usable: usableQuote(item, flags),
      };
    });

    const approved = quotes.filter((item) => item.status === "approved");
    const ceilingBase = approved.length
      ? approved
      : quotes.filter((_, index) => mapped[index].usable);
    const ceiling = approvedCeiling(
      ceilingBase.map((item) => ({
        productCode: item.productCode,
        brandId: item.brandId,
        status: "approved",
        factoryPrice: item.factoryPrice,
        warehousePrice: item.warehousePrice,
      })),
      quotes[0].productCode ?? "",
      quotes[0].brandId,
    );
    const factorySource =
      ceilingBase.find((item) => item.factoryPrice === ceiling.factoryPrice)?.sourceName ?? null;
    const warehouseSource =
      ceilingBase.find((item) => item.warehousePrice === ceiling.warehousePrice)?.sourceName ?? null;

    return {
      key,
      productCode: quotes[0].productCode ?? "",
      productName: quotes[0].productName ?? quotes[0].productCode ?? "",
      brandId: quotes[0].brandId,
      brandName: quotes[0].brandName,
      quotes: mapped,
      targetFactory: ceiling.factoryPrice,
      targetWarehouse: ceiling.warehousePrice,
      factorySource,
      warehouseSource,
    };
  });
}

export function flagLabel(flag: QuoteFlag): string {
  return flag === "stale" ? "تاریخ قدیمی" : "اختلاف زیاد";
}
