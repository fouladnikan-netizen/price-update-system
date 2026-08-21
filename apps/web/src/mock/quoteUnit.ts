import type { CatalogProduct } from "./catalog";

export type PriceLane = "factory" | "warehouse";
export type QuoteUnit = "کیلوگرم" | "شاخه";

export function isIpeCategory(groupCode: string | undefined, categoryCode: string | undefined): boolean {
  return groupCode === "beam" && categoryCode === "ipe";
}

export function isPipeGroup(groupCode: string | undefined): boolean {
  return groupCode === "pipe";
}

/** Units a source may announce. Same product; not two catalog items. */
export function acceptedSourceQuoteUnits(
  groupCode: string | undefined,
  categoryCode: string | undefined,
  lane: PriceLane,
): QuoteUnit[] {
  if (isIpeCategory(groupCode, categoryCode)) {
    return lane === "factory" ? ["کیلوگرم"] : ["شاخه"];
  }
  if (isPipeGroup(groupCode)) {
    return lane === "factory" ? ["کیلوگرم"] : ["کیلوگرم", "شاخه"];
  }
  return ["کیلوگرم"];
}

/** Unit shown on the Website and in the daily table. */
export function displayQuoteUnit(
  groupCode: string | undefined,
  categoryCode: string | undefined,
  lane: PriceLane,
): QuoteUnit | null {
  if (isIpeCategory(groupCode, categoryCode)) {
    return lane === "factory" ? "کیلوگرم" : "شاخه";
  }
  if (isPipeGroup(groupCode)) return "کیلوگرم";
  return null;
}

export function quoteUnitForLane(
  groupCode: string | undefined,
  categoryCode: string | undefined,
  lane: PriceLane,
): QuoteUnit | null {
  return displayQuoteUnit(groupCode, categoryCode, lane);
}

export function quoteUnitForProduct(product: CatalogProduct | undefined, lane: PriceLane): QuoteUnit | null {
  if (!product) return null;
  return displayQuoteUnit(product.groupCode, product.categoryCode, lane);
}

export function priceUnitText(unit: QuoteUnit | null): string {
  if (unit === "شاخه") return "ریال / شاخه";
  if (unit === "کیلوگرم") return "ریال / کیلوگرم";
  return "ریال";
}

/**
 * Convert a collected amount to the Website kilogram price.
 * Arithmetic only. Missing or invalid bar weight means no conversion.
 */
export function toWebsiteKilogramPrice(
  amount: number,
  sourceUnit: QuoteUnit,
  barWeightKg: number | null,
): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (sourceUnit === "کیلوگرم") return amount;
  if (barWeightKg == null || !Number.isFinite(barWeightKg) || barWeightKg <= 0) return null;
  return amount / barWeightKg;
}

export function quotePolicyNote(groupCode: string | undefined, categoryCode: string | undefined): string | null {
  if (isIpeCategory(groupCode, categoryCode)) {
    return "کارخانه کیلوگرم · انبار شاخه";
  }
  if (isPipeGroup(groupCode)) {
    return "نمایش وب‌سایت کیلوگرم · انبار ممکن است شاخه هم اعلام شود";
  }
  return null;
}
