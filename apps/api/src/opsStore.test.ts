import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeDailyPrice } from "./opsStore.ts";

test("daily prices keep missing as null and never store zero", () => {
  const row = normalizeDailyPrice({
    date: "1405/05/30",
    productCode: "RBR-A3-14",
    brandId: "rebar-ribbed-11",
    brandName: "ذوب آهن اصفهان",
    factoryPrice: 0,
    warehousePrice: null,
    factorySource: "منبع",
    warehouseSource: "منبع",
    updatedAt: "2026-08-21T08:00:00.000Z",
  });
  assert.equal(row.factoryPrice, null);
  assert.equal(row.warehousePrice, null);
  assert.equal(row.factorySource, null);
  assert.equal(row.warehouseSource, null);
});

test("registered rial amounts keep the last three digits zero", () => {
  const row = normalizeDailyPrice({
    date: "1405/05/30",
    productCode: "RBR-A3-14",
    brandId: "rebar-ribbed-11",
    brandName: "ذوب آهن اصفهان",
    factoryPrice: 842_000,
    warehousePrice: 850_500,
    factorySource: "منبع",
    warehouseSource: "منبع",
    updatedAt: "2026-08-21T08:00:00.000Z",
  });
  assert.equal(row.factoryPrice, 842_000);
  assert.equal(row.warehousePrice, 851_000);
});
