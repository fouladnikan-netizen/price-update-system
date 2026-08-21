import { findBrand, findBrandInText } from "./catalog.ts";
import type { CategoryBrand } from "../../web/src/mock/category-brands.ts";
import { normalizeDigits, parsePriceNumber } from "./numbers.ts";
import type { ExtractedItemDraft } from "./schema.ts";

const SIZE = /^(8|10|12|14|16|18|20|22|25|28|32|36|40)$/;
const GRADE = /^A[234]$/i;
const LANE = /^(کارخانه|انبار)$/;

function linesOf(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function millFromHeading(line: string, brands: CategoryBrand[]): CategoryBrand | null {
  const cleaned = line
    .replace(/^قیمت\s+/u, "")
    .replace(/^میلگرد\s+/u, "")
    .replace(/\|/g, " ")
    .trim();
  if (!cleaned || cleaned.length > 80) return null;
  const beforeParen = cleaned.split("(")[0]?.trim() ?? cleaned;
  return (
    findBrand(brands, null, cleaned) ??
    findBrand(brands, null, beforeParen) ??
    findBrandInText(brands, cleaned) ??
    findBrandInText(brands, beforeParen)
  );
}

function tomanPrices(text: string): number[] {
  if (/تماس\s*بگیرید/.test(text)) return [];
  const matches = [...normalizeDigits(text).matchAll(/\d{1,3}(?:[.,٬]\d{3})+|\d{4,7}/g)];
  return matches
    .map((item) => parsePriceNumber(item[0]))
    .filter((value): value is number => value != null && value >= 1000);
}

function pickVatPair(prices: number[]): number | null {
  if (!prices.length) return null;
  if (prices.length >= 2) {
    const high = Math.max(prices[0], prices[1]);
    const low = Math.min(prices[0], prices[1]);
    const ratio = high / low;
    if (ratio >= 1.08 && ratio <= 1.12) return low;
  }
  return prices[0];
}

function listedTomanPrice(text: string): number | null {
  return pickVatPair(tomanPrices(text));
}

function millQuote(text: string): { amount: number; unit: "toman_per_kg" | "rial_per_kg" } | null {
  if (/ناموجود/.test(text) || /تماس\s*بگیرید/.test(text)) return null;
  const prices = tomanPrices(text).filter((value) => value < 1300 || value > 1599);
  const toman = prices.filter((value) => value >= 20_000 && value <= 150_000);
  const rial = prices.filter((value) => value >= 200_000 && value <= 2_500_000);
  if (toman.length) return { amount: pickVatPair(toman) ?? toman[0], unit: "toman_per_kg" };
  if (rial.length) return { amount: rial[0], unit: "rial_per_kg" };
  return null;
}

function resolveMill(brands: CategoryBrand[], hint: string | null | undefined): CategoryBrand | null {
  const text = hint?.trim() ?? "";
  if (!text) return null;
  return (
    findBrand(brands, null, text) ??
    findBrandInText(brands, text) ??
    millFromHeading(text, brands)
  );
}

function deliveryLane(text: string): string {
  const value = normalizeDigits(text);
  if (/انبار/.test(value)) return "انبار";
  if (/کارخانه/.test(value)) return "کارخانه";
  return "کارخانه";
}

function esfahanahanMatch(line: string): { size: string; millHint: string; grade: string | null; place: string } | null {
  const text = normalizeDigits(line).replace(/اصـفهان/g, "اصفهان");
  const withGrade = text.match(/^میلگرد\s+(\d{1,2})\s+(.+?)\s+(A[234])\s+\1\s+(.+)$/i);
  if (withGrade) {
    return { size: withGrade[1], millHint: withGrade[2].trim(), grade: withGrade[3].toUpperCase(), place: withGrade[4].trim() };
  }
  const plain = text.match(/^میلگرد\s+(\d{1,2})\s+(.+?)\s+\1\s+(.+)$/);
  if (!plain) return null;
  return { size: plain[1], millHint: plain[2].trim(), grade: null, place: plain[3].trim() };
}

function fooladiranianMatch(line: string): { size: string; grade: string; place: string } | null {
  const match = normalizeDigits(line).match(/^(\d{1,2})\s+(A[234])\s+\d+(?:[./]\d+)?\s+(.+)$/i);
  if (!match) return null;
  if (/کارخانه|انبار/.test(match[3])) return null;
  return { size: match[1], grade: match[2].toUpperCase(), place: match[3].trim() };
}

function ahanpakhshTitle(line: string): { size: string; millHint: string } | null {
  const match = normalizeDigits(line).match(/^قیمت\s+میلگرد\s+(\d{1,2})\s+(.+)$/);
  if (!match) return null;
  if (/آجدار|ساده|امروز/.test(match[2])) return null;
  return { size: match[1], millHint: match[2].trim() };
}

function lookAheadGrade(lines: string[], start: number, stop: number): string {
  for (let index = start; index < stop; index += 1) {
    const grade = lines[index]?.match(/A[234]/i);
    if (grade) return grade[0].toUpperCase();
    const labeled = normalizeDigits(lines[index] ?? "").match(/استاندارد\s*:\s*(A[234])/i);
    if (labeled) return labeled[1].toUpperCase();
  }
  return "A3";
}

function lookAheadQuote(
  lines: string[],
  start: number,
  stop: number,
): { amount: number; unit: "toman_per_kg" | "rial_per_kg" } | null {
  for (let index = start; index < stop; index += 1) {
    const line = lines[index] ?? "";
    if (/ناموجود/.test(line)) return null;
    const current = millQuote(line);
    if (!current) continue;
    const next = millQuote(lines[index + 1] ?? "");
    if (next && next.unit === current.unit) {
      return { amount: pickVatPair([current.amount, next.amount]) ?? current.amount, unit: current.unit };
    }
    return current;
  }
  return null;
}

function compactPriceMatch(line: string): RegExpMatchArray | null {
  // Do not use \b after Persian words — JS word boundaries are ASCII-only.
  return normalizeDigits(line).match(
    /^(\d{1,2})\s+(A[234])(?:\s+(?!کارخانه|انبار)(.+?))?\s+(کارخانه|انبار)(.*)$/i,
  );
}

function namedProductMatch(line: string): { size: string; millHint: string; grade: string } | null {
  const match = normalizeDigits(line).match(
    /^(\d{1,2})\s+قیمت\s+میلگرد\s+\d{1,2}(?:\s+A[234])?\s+(.+?)\s+(A[234])\s+[\d.]+$/i,
  );
  if (!match) return null;
  return { size: match[1], millHint: match[2].trim(), grade: match[3].toUpperCase() };
}

function pushItem(
  items: ExtractedItemDraft[],
  mill: CategoryBrand,
  rawText: string,
  grade: string,
  size: string,
  lane: string,
  price: number | null,
  unit: "toman_per_kg" | "rial_per_kg" = "toman_per_kg",
): void {
  const factory = lane === "کارخانه" ? price : null;
  const warehouse = lane === "انبار" ? price : null;
  if (!SIZE.test(size) || (factory == null && warehouse == null)) return;
  items.push({
    raw_text: rawText,
    suggested_product_code: null,
    suggested_brand_id: mill.id,
    suggested_brand_name: mill.name,
    grade: grade.toUpperCase(),
    size,
    factory_price: factory,
    warehouse_price: warehouse,
    unit,
    confidence: 0.86,
    notes: "from_source_table",
  });
}

export function parseMillPriceItems(text: string, brands: CategoryBrand[]): ExtractedItemDraft[] {
  const lines = linesOf(text);
  const items: ExtractedItemDraft[] = [];
  let mill: CategoryBrand | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const named = namedProductMatch(lines[index]);
    if (named) {
      const namedMill = findBrand(brands, null, named.millHint) ?? findBrandInText(brands, named.millHint);
      if (namedMill) {
        mill = namedMill;
        pushItem(
          items,
          namedMill,
          `${lines[index]} ${lines[index + 1] ?? ""} ${namedMill.name}`,
          named.grade,
          named.size,
          "کارخانه",
          listedTomanPrice(lines[index + 1] ?? ""),
        );
        continue;
      }
    }

    const esfahan = esfahanahanMatch(lines[index]);
    if (esfahan) {
      const rowMill = resolveMill(brands, esfahan.millHint) ?? mill;
      if (rowMill) {
        mill = rowMill;
        const windowEnd = Math.min(lines.length, index + 12);
        const quote = lookAheadQuote(lines, index + 1, windowEnd);
        if (quote) {
          const grade = esfahan.grade ?? lookAheadGrade(lines, index + 1, windowEnd);
          const lane = /اصفهان/.test(esfahan.place) && !/کارخانه/.test(esfahan.place)
            ? "انبار"
            : deliveryLane(esfahan.place);
          pushItem(
            items,
            rowMill,
            `${lines[index]} ${lines[index + 1] ?? ""} ${rowMill.name}`,
            grade,
            esfahan.size,
            lane,
            quote.amount,
            quote.unit,
          );
        }
        continue;
      }
    }

    const pakhshCompact = normalizeDigits(lines[index]).match(
      /^قیمت\s+میلگرد\s+(\d{1,2})\s+(.+?)\s+\1\s+(A[234])\s+(.*)$/i,
    );
    const pakhshTitle = pakhshCompact
      ? { size: pakhshCompact[1], millHint: pakhshCompact[2].trim(), grade: pakhshCompact[3].toUpperCase(), rest: pakhshCompact[4] }
      : ahanpakhshTitle(lines[index]);
    if (pakhshTitle) {
      const rowMill = resolveMill(brands, pakhshTitle.millHint) ?? mill;
      if (rowMill && SIZE.test(pakhshTitle.size)) {
        mill = rowMill;
        const sameLine = "rest" in pakhshTitle ? millQuote(pakhshTitle.rest) : null;
        const windowEnd = Math.min(lines.length, index + 10);
        const quote = sameLine ?? lookAheadQuote(lines, index + 1, windowEnd);
        if (quote) {
          const grade =
            "grade" in pakhshTitle && pakhshTitle.grade
              ? pakhshTitle.grade
              : lookAheadGrade(lines, index + 1, windowEnd);
          pushItem(
            items,
            rowMill,
            `${lines[index]} ${rowMill.name}`,
            grade,
            pakhshTitle.size,
            "کارخانه",
            quote.amount,
            quote.unit,
          );
        }
        continue;
      }
    }

    const iranian = fooladiranianMatch(lines[index]);
    if (iranian && mill) {
      const quote = millQuote(lines[index + 1] ?? "");
      if (quote) {
        pushItem(
          items,
          mill,
          `${lines[index]} ${lines[index + 1] ?? ""} ${mill.name}`,
          iranian.grade,
          iranian.size,
          deliveryLane(iranian.place),
          quote.amount,
          quote.unit,
        );
        index += 1;
        continue;
      }
    }

    const compact = compactPriceMatch(lines[index]);
    const heading = millFromHeading(lines[index], brands);
    const namedMill = compact?.[3]?.trim()
      ? findBrand(brands, null, compact[3]) ?? findBrandInText(brands, compact[3])
      : null;
    if (heading && !compact && !SIZE.test(normalizeDigits(lines[index]))) {
      mill = heading;
      continue;
    }
    if (namedMill) mill = namedMill;
    else if (heading) mill = heading;
    if (!mill) continue;

    const stackedSize = normalizeDigits(lines[index]);
    const stackedGrade = lines[index + 1] ?? "";
    const stackedLane = lines[index + 2] ?? "";
    const stackedPrice = lines[index + 3] ?? "";
    if (SIZE.test(stackedSize) && GRADE.test(stackedGrade) && LANE.test(stackedLane)) {
      pushItem(
        items,
        mill,
        `${lines[index]} ${stackedGrade} ${stackedLane} ${stackedPrice} ${mill.name}`,
        stackedGrade,
        stackedSize,
        stackedLane,
        listedTomanPrice(stackedPrice),
      );
      index += 3;
      continue;
    }

    if (compact) {
      pushItem(
        items,
        mill,
        `${lines[index]} ${mill.name}`,
        compact[2],
        compact[1],
        compact[4],
        listedTomanPrice(compact[5] ?? ""),
      );
    }
  }

  return items;
}
