import assert from "node:assert/strict";
import { test } from "node:test";
import { countDailyPriceChanges, mergeMissingDailyPrices, type DailyPrice } from "./dailyPriceStore.ts";

function row(overrides: Partial<DailyPrice>): DailyPrice {
  return {
    date: "1404-05-31",
    productCode: "RBR-A3-14",
    brandId: "rebar-ribbed-11",
    brandName: "ذوب آهن",
    factoryPrice: 420_000,
    warehousePrice: null,
    factorySource: "آهن آنلاین",
    warehouseSource: null,
    updatedAt: "2026-08-22T07:00:00.000Z",
    ...overrides,
  };
}

test("missing merge fills empty slots and never overwrites a present price", () => {
  const existing = [row({ factoryPrice: 420_000, warehousePrice: null })];
  const incoming = [
    row({ factoryPrice: 500_000, warehousePrice: 510_000, factorySource: "جدید", warehouseSource: "جدید" }),
    row({ productCode: "RBR-A3-16", factoryPrice: 430_000, warehousePrice: null }),
  ];
  const filled = mergeMissingDailyPrices(existing, incoming);
  assert.equal(filled.length, 2);
  assert.equal(filled[0]?.factoryPrice, 420_000);
  assert.equal(filled[0]?.warehousePrice, 510_000);
  assert.equal(filled[0]?.factorySource, "آهن آنلاین");
  assert.equal(filled[0]?.warehouseSource, "جدید");
  assert.equal(filled[1]?.productCode, "RBR-A3-16");
});

test("audit change count treats a new or different amount as a change, not zero", () => {
  const existing = [row({ factoryPrice: 420_000 })];
  assert.equal(countDailyPriceChanges(existing, [row({ factoryPrice: 420_000 })]), 0);
  assert.equal(countDailyPriceChanges(existing, [row({ factoryPrice: 430_000 })]), 1);
  assert.equal(countDailyPriceChanges(existing, [row({ productCode: "RBR-A3-18", factoryPrice: 400_000 })]), 1);
});
