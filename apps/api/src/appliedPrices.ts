import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");

function appliedDir(): string {
  return process.env.APPLIED_PRICES_DIR || resolve(REPO_ROOT, "data/applied-prices");
}

function pricesFile(): string {
  return resolve(appliedDir(), "daily.json");
}

function offsetFile(): string {
  return resolve(appliedDir(), "bale-offset.json");
}

function ensureDir(): void {
  mkdirSync(appliedDir(), { recursive: true });
}

export type AppliedDailyPrice = {
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

export function loadAppliedPrices(): AppliedDailyPrice[] {
  try {
    const parsed = JSON.parse(readFileSync(pricesFile(), "utf8")) as AppliedDailyPrice[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAppliedPrices(items: AppliedDailyPrice[]): void {
  ensureDir();
  writeFileSync(pricesFile(), `${JSON.stringify(items, null, 2)}\n`);
}

export function upsertAppliedPrices(rows: AppliedDailyPrice[]): AppliedDailyPrice[] {
  let current = loadAppliedPrices();
  for (const row of rows) {
    const key = dailyPriceKey(row.date, row.productCode, row.brandId);
    current = [row, ...current.filter((item) => dailyPriceKey(item.date, item.productCode, item.brandId) !== key)];
  }
  saveAppliedPrices(current);
  return current;
}

export function loadBaleOffset(): number {
  try {
    const parsed = JSON.parse(readFileSync(offsetFile(), "utf8")) as { offset?: number };
    return Number(parsed.offset) || 0;
  } catch {
    return 0;
  }
}

export function saveBaleOffset(offset: number): void {
  ensureDir();
  writeFileSync(offsetFile(), `${JSON.stringify({ offset })}\n`);
}

function telegramBotOffsetFile(): string {
  return resolve(appliedDir(), "telegram-bot-offset.json");
}

export function loadTelegramBotOffset(): number {
  try {
    const parsed = JSON.parse(readFileSync(telegramBotOffsetFile(), "utf8")) as { offset?: number };
    return Number(parsed.offset) || 0;
  } catch {
    return 0;
  }
}

export function saveTelegramBotOffset(offset: number): void {
  ensureDir();
  writeFileSync(telegramBotOffsetFile(), `${JSON.stringify({ offset })}\n`);
}
