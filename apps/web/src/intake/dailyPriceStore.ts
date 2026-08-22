import { tehranJalaliKey } from "./dates";
import { toRegisteredRial } from "./rial";

const STORAGE_KEY = "price-update.daily-prices.v1";

export type DailyPrice = {
  date: string;
  productCode: string;
  brandId: string | null;
  brandName: string | null;
  factoryPrice: number | null;
  warehousePrice: number | null;
  factorySource: string | null;
  warehouseSource: string | null;
  updatedAt: string;
};

export function dailyPriceKey(date: string, productCode: string, brandId: string | null): string {
  return `${date}::${productCode}::${brandId ?? ""}`;
}

export function loadDailyPrices(): DailyPrice[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DailyPrice[];
    return Array.isArray(parsed)
      ? parsed.map((item) => ({
          ...item,
          factoryPrice: toRegisteredRial(item.factoryPrice),
          warehousePrice: toRegisteredRial(item.warehousePrice),
        }))
      : [];
  } catch {
    return [];
  }
}

export function saveDailyPrices(items: DailyPrice[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function upsertDailyPrice(items: DailyPrice[], row: DailyPrice): DailyPrice[] {
  const key = dailyPriceKey(row.date, row.productCode, row.brandId);
  const registered: DailyPrice = {
    ...row,
    factoryPrice: toRegisteredRial(row.factoryPrice),
    warehousePrice: toRegisteredRial(row.warehousePrice),
  };
  return [registered, ...items.filter((item) => dailyPriceKey(item.date, item.productCode, item.brandId) !== key)];
}

export function findDailyPrice(
  items: DailyPrice[],
  productCode: string,
  brandId: string | null,
  date = tehranJalaliKey(),
): DailyPrice | undefined {
  return items.find((item) => item.date === date && item.productCode === productCode && (item.brandId ?? null) === (brandId ?? null));
}

export function datesInStore(items: DailyPrice[]): string[] {
  return [...new Set(items.map((item) => item.date))].sort();
}

export function hasAnyPrice(row: Pick<DailyPrice, "factoryPrice" | "warehousePrice"> | undefined): boolean {
  return Boolean(row && (row.factoryPrice != null || row.warehousePrice != null));
}

export function mergeMissingDailyPrices(existing: DailyPrice[], incoming: DailyPrice[]): DailyPrice[] {
  const byKey = new Map(existing.map((row) => [dailyPriceKey(row.date, row.productCode, row.brandId), row]));
  const filled: DailyPrice[] = [];
  for (const row of incoming) {
    const prev = byKey.get(dailyPriceKey(row.date, row.productCode, row.brandId));
    if (!prev) {
      if (hasAnyPrice(row)) filled.push(row);
      continue;
    }
    const factoryPrice = prev.factoryPrice ?? row.factoryPrice;
    const warehousePrice = prev.warehousePrice ?? row.warehousePrice;
    if (factoryPrice === prev.factoryPrice && warehousePrice === prev.warehousePrice) continue;
    filled.push({
      ...row,
      factoryPrice,
      warehousePrice,
      factorySource: factoryPrice === prev.factoryPrice ? prev.factorySource : row.factorySource,
      warehouseSource: warehousePrice === prev.warehousePrice ? prev.warehouseSource : row.warehouseSource,
    });
  }
  return filled;
}

export function countDailyPriceChanges(existing: DailyPrice[], incoming: DailyPrice[]): number {
  const byKey = new Map(existing.map((row) => [dailyPriceKey(row.date, row.productCode, row.brandId), row]));
  let changed = 0;
  for (const row of incoming) {
    const prev = byKey.get(dailyPriceKey(row.date, row.productCode, row.brandId));
    if (!prev) {
      if (hasAnyPrice(row)) changed += 1;
      continue;
    }
    if (prev.factoryPrice !== row.factoryPrice || prev.warehousePrice !== row.warehousePrice) changed += 1;
  }
  return changed;
}

export function replaceDailyPricesForDate(items: DailyPrice[], date: string, rows: DailyPrice[]): DailyPrice[] {
  return [
    ...rows.map((row) => ({
      ...row,
      factoryPrice: toRegisteredRial(row.factoryPrice),
      warehousePrice: toRegisteredRial(row.warehousePrice),
    })),
    ...items.filter((item) => item.date !== date),
  ];
}
