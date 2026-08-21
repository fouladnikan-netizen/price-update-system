import { loadAppliedPrices, saveAppliedPrices, upsertAppliedPrices, type AppliedDailyPrice } from "./appliedPrices.ts";
import { loadDailyPricesFromDb, normalizeDailyPrice, replaceDailyPricesInDb, upsertDailyPricesInDb } from "./opsStore.ts";
import { persistenceEnabled } from "./pg.ts";

export async function readDailyPrices(): Promise<AppliedDailyPrice[]> {
  if (persistenceEnabled()) {
    const fromDb = await loadDailyPricesFromDb();
    if (fromDb) {
      saveAppliedPrices(fromDb.prices);
      return fromDb.prices;
    }
  }
  return loadAppliedPrices();
}

export async function persistDailyPriceUpserts(rows: AppliedDailyPrice[]): Promise<AppliedDailyPrice[]> {
  if (persistenceEnabled()) {
    const fromDb = await upsertDailyPricesInDb(rows);
    if (fromDb) {
      saveAppliedPrices(fromDb);
      return fromDb;
    }
  }
  return upsertAppliedPrices(rows);
}

export async function persistDailyPrices(prices: AppliedDailyPrice[]): Promise<AppliedDailyPrice[]> {
  const registered = prices.map(normalizeDailyPrice).filter((row) => row.productCode);
  saveAppliedPrices(registered);
  if (persistenceEnabled()) {
    const ok = await replaceDailyPricesInDb(registered);
    if (ok) {
      const fromDb = await loadDailyPricesFromDb();
      if (fromDb) {
        saveAppliedPrices(fromDb.prices);
        return fromDb.prices;
      }
    }
  }
  return registered;
}

export async function importFilePricesIfDatabaseEmpty(): Promise<void> {
  if (!persistenceEnabled()) return;
  const fromDb = await loadDailyPricesFromDb();
  if (!fromDb) return;
  if (fromDb.prices.length) return;
  const fromFile = loadAppliedPrices();
  if (!fromFile.length) return;
  await replaceDailyPricesInDb(fromFile);
}
