import assert from "node:assert/strict";
import { test } from "node:test";
import { isStaleDate, parseJalaliDate } from "./dates.ts";
import { buildComparisonMatrix } from "./compare.ts";
import type { QueueItem } from "./queueStore.ts";

test("parses jalali dates from source text", () => {
  assert.equal(parseJalaliDate("امروز ( 1405/5/29 )"), "1405/05/29");
  assert.equal(isStaleDate("1405/05/27", "1405/05/29"), true);
  assert.equal(isStaleDate("1405/05/29", "1405/05/29"), false);
});

test("comparison matrix takes the high usable quote and flags outliers", () => {
  const base: QueueItem = {
    id: "a:0",
    intakeId: "a",
    kind: "matched",
    title: "میلگرد",
    detail: "",
    sourceName: "آهن آنلاین",
    groupCode: "rebar",
    categoryCode: "ribbed",
    rawText: "12 A3 1405/5/29 78550",
    imageUrl: null,
    fileName: null,
    productCode: "RBR-A3-12",
    productName: "میلگرد آجدار A3 سایز 12",
    brandId: "rebar-ribbed-11",
    brandName: "ذوب آهن اصفهان",
    factoryPrice: 78550,
    warehousePrice: null,
    needsLane: false,
    unit: "toman_per_kg",
    reasons: [],
    promptVersion: null,
    receivedAt: "2026-08-20T00:00:00.000Z",
    status: "pending_review",
    canPublish: false,
  };
  const rows = buildComparisonMatrix(
    [
      base,
      { ...base, id: "b:0", intakeId: "b", sourceName: "پیوان", factoryPrice: 79000 },
      { ...base, id: "c:0", intakeId: "c", sourceName: "قدیمی", factoryPrice: 40000, rawText: "1405/1/1 40000" },
    ],
    "1405/05/29",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].targetFactory, 79000);
  assert.ok(rows[0].quotes.some((quote) => quote.flags.includes("outlier") || quote.flags.includes("stale")));
});
