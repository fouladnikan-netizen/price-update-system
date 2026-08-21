import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { debouncePersist, getJson, putJson } from "../persist/apiStore";
import {
  findDailyPrice,
  loadDailyPrices,
  replaceDailyPricesForDate,
  saveDailyPrices,
  upsertDailyPrice,
  type DailyPrice,
} from "./dailyPriceStore";
import { tehranJalaliKey } from "./dates";
import { toRegisteredRial } from "./rial";

type DailyPriceContextValue = {
  prices: DailyPrice[];
  saveTarget: (row: Omit<DailyPrice, "updatedAt" | "date"> & { date?: string }) => DailyPrice;
  replaceDate: (date: string, rows: Array<Omit<DailyPrice, "updatedAt">>) => DailyPrice[];
  lookup: (productCode: string, brandId: string | null, date?: string) => DailyPrice | undefined;
};

const DailyPriceContext = createContext<DailyPriceContextValue | null>(null);

export function DailyPriceStateProvider({ children }: { children: ReactNode }) {
  const [prices, setPrices] = useState<DailyPrice[]>(() => loadDailyPrices());
  const pricesRef = useRef(prices);
  pricesRef.current = prices;
  const migratedEmpty = useRef(false);
  const persist = useRef(
    debouncePersist(() => {
      void putJson("/api/daily-prices", { prices: pricesRef.current });
    }, 500),
  );

  const mergeIncoming = useCallback((current: DailyPrice[], incoming: DailyPrice[]) => {
    let next = current;
    for (const row of incoming) {
      next = upsertDailyPrice(next, {
        ...row,
        factoryPrice: toRegisteredRial(row.factoryPrice),
        warehousePrice: toRegisteredRial(row.warehousePrice),
      });
    }
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function pull() {
      try {
        const remote = await getJson<{ prices?: DailyPrice[] }>("/api/daily-prices");
        if (cancelled || !Array.isArray(remote?.prices)) return;
        if (!remote.prices.length) {
          if (migratedEmpty.current) return;
          migratedEmpty.current = true;
          const local = loadDailyPrices();
          if (local.length) void putJson("/api/daily-prices", { prices: local });
          return;
        }
        migratedEmpty.current = true;
        setPrices((current) => {
          const next = mergeIncoming(current, remote.prices ?? []);
          saveDailyPrices(next);
          return next;
        });
      } catch {
        // API down: cached table stays as-is.
      }
    }
    void pull();
    const timer = window.setInterval(() => void pull(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [mergeIncoming]);

  const saveTarget = useCallback((row: Omit<DailyPrice, "updatedAt" | "date"> & { date?: string }) => {
    const record: DailyPrice = {
      ...row,
      date: row.date ?? tehranJalaliKey(),
      factoryPrice: toRegisteredRial(row.factoryPrice),
      warehousePrice: toRegisteredRial(row.warehousePrice),
      updatedAt: new Date().toISOString(),
    };
    setPrices((current) => {
      const next = upsertDailyPrice(current, record);
      saveDailyPrices(next);
      persist.current();
      return next;
    });
    return record;
  }, []);

  const replaceDate = useCallback((date: string, rows: Array<Omit<DailyPrice, "updatedAt">>) => {
    const stamped = rows.map((row) => ({
      ...row,
      date: row.date ?? date,
      factoryPrice: toRegisteredRial(row.factoryPrice),
      warehousePrice: toRegisteredRial(row.warehousePrice),
      updatedAt: new Date().toISOString(),
    }));
    setPrices((current) => {
      const next = replaceDailyPricesForDate(current, date, stamped);
      saveDailyPrices(next);
      persist.current();
      return next;
    });
    return stamped;
  }, []);

  const lookup = useCallback(
    (productCode: string, brandId: string | null, date?: string) => findDailyPrice(prices, productCode, brandId, date),
    [prices],
  );

  const value = useMemo(() => ({ prices, saveTarget, replaceDate, lookup }), [lookup, prices, replaceDate, saveTarget]);
  return <DailyPriceContext.Provider value={value}>{children}</DailyPriceContext.Provider>;
}

export function useDailyPrices(): DailyPriceContextValue {
  const value = useContext(DailyPriceContext);
  if (!value) throw new Error("DailyPriceStateProvider is missing");
  return value;
}
