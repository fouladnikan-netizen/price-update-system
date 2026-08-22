import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";
import { saveAppliedPrices, upsertAppliedPrices } from "./appliedPrices.ts";
import { applyPricePolicy, parseDeltaRial, parsePricePolicy } from "./pricePolicy.ts";

function isolateStore(): void {
  process.env.APPLIED_PRICES_DIR = mkdtempSync(join(tmpdir(), "price-policy-"));
  saveAppliedPrices([]);
}

test("parses a category-wide rial increase", () => {
  const policy = parsePricePolicy("تمام دسته میلگرد آجدار مثبت ۱۰۰۰ ریال");
  assert.deepEqual(policy, {
    kind: "adjust_category",
    groupCode: "rebar",
    categoryCode: "ribbed",
    groupLabel: "میلگرد",
    categoryLabel: "میلگرد آجدار",
    deltaRial: 1000,
  });
  assert.equal(parseDeltaRial("منفی ۵۰۰ ریال"), -500);
});

test("parses a sold-out sheet as a clear policy, not a new product", () => {
  const policy = parsePricePolicy("ورق مبارکه ۱۵۰۰*۶۰۰۰ تمام شد");
  assert.equal(policy?.kind, "clear_item");
  if (policy?.kind !== "clear_item") return;
  assert.equal(policy.groupCode, "sheet");
  assert.equal(policy.width, "1500");
  assert.equal(policy.length, "6000");
  assert.ok(policy.brandQuery?.includes("مبارکه"));
});

test("adds the delta to every current price in that category with exact arithmetic", () => {
  isolateStore();
  upsertAppliedPrices([
    {
      date: "1405/05/30",
      productCode: "RBR-000001",
      brandId: "rebar-ribbed-ذوب-اهن-اصفهان",
      brandName: "ذوب آهن اصفهان",
      factoryPrice: 842_000,
      warehousePrice: 850_000,
      factorySource: "لیست صبح",
      warehouseSource: "لیست صبح",
      updatedAt: "2026-08-21T08:00:00.000Z",
    },
    {
      date: "1405/05/30",
      productCode: "RBR-000002",
      brandId: "rebar-ribbed-ذوب-اهن-اصفهان",
      brandName: "ذوب آهن اصفهان",
      factoryPrice: 841_000,
      warehousePrice: null,
      factorySource: "لیست صبح",
      warehouseSource: null,
      updatedAt: "2026-08-21T08:00:00.000Z",
    },
  ]);
  const policy = parsePricePolicy("تمام دسته میلگرد آجدار مثبت ۱۰۰۰ ریال");
  assert.ok(policy);
  const outcome = applyPricePolicy(policy!, "1405/05/30");
  assert.equal(outcome.changed, 2);
  const byCode = Object.fromEntries(outcome.rows.map((row) => [row.productCode, row]));
  assert.equal(byCode["RBR-000001"]?.factoryPrice, 843_000);
  assert.equal(byCode["RBR-000001"]?.warehousePrice, 851_000);
  assert.equal(byCode["RBR-000002"]?.factoryPrice, 842_000);
  assert.equal(byCode["RBR-000002"]?.warehousePrice, null);
});

test("clears a finished listing to null and never writes zero", () => {
  isolateStore();
  upsertAppliedPrices([
    {
      date: "1405/05/30",
      productCode: "VSIH-000028",
      brandId: "sheet-black-mobarakeh",
      brandName: "فولاد مبارکه اصفهان",
      factoryPrice: 1_200_000,
      warehousePrice: 1_210_000,
      factorySource: "لیست صبح",
      warehouseSource: "لیست صبح",
      updatedAt: "2026-08-21T08:00:00.000Z",
    },
    {
      date: "1405/05/30",
      productCode: "VSIH-000028",
      brandId: "sheet-black-other",
      brandName: "اکسین اهواز",
      factoryPrice: 1_150_000,
      warehousePrice: null,
      factorySource: "لیست صبح",
      warehouseSource: null,
      updatedAt: "2026-08-21T08:00:00.000Z",
    },
  ]);
  const policy = parsePricePolicy("ورق مبارکه ۱۵۰۰*۶۰۰۰ تمام شد");
  assert.ok(policy);
  const outcome = applyPricePolicy(policy!, "1405/05/30");
  assert.equal(outcome.changed, 1);
  assert.equal(outcome.rows[0]?.factoryPrice, null);
  assert.equal(outcome.rows[0]?.warehousePrice, null);
  assert.notEqual(outcome.rows[0]?.factoryPrice, 0);
});
