import assert from "node:assert/strict";
import { test } from "node:test";
import { getScopeBrands, getScopeProducts } from "./catalog.ts";
import { matchExtractedItem } from "./match.ts";
import type { ExtractedItemDraft } from "./schema.ts";

const products = getScopeProducts("rebar", "ribbed");
const brands = getScopeBrands("rebar", "ribbed");

function draft(partial: Partial<ExtractedItemDraft>): ExtractedItemDraft {
  return {
    raw_text: "A3 14 ذوب آهن 38500",
    suggested_product_code: null,
    suggested_brand_id: null,
    suggested_brand_name: null,
    grade: "A3",
    size: "14",
    factory_price: 38500,
    warehouse_price: null,
    unit: "toman_per_kg",
    confidence: 0.8,
    notes: null,
    ...partial,
  };
}

test("accepts an existing product_code", () => {
  const result = matchExtractedItem(
    draft({ suggested_product_code: "RBR-A3-14", suggested_brand_name: "ذوب آهن اصفهان" }),
    products,
    brands,
  );
  assert.equal(result.productCode, "RBR-A3-14");
  assert.equal(result.brandId, "rebar-ribbed-11");
  assert.equal(result.matchMethod, "product_code");
  assert.equal(result.status, "pending_review");
});

test("rejects an invented product_code", () => {
  const result = matchExtractedItem(draft({ suggested_product_code: "REB-A3-14-ESF" }), products, brands);
  assert.equal(result.productCode, "RBR-A3-14");
  assert.equal(result.matchMethod, "grade_size");
  assert.ok(result.reasons.some((item) => item.includes("کاتالوگ")));
});

test("does not invent a brand", () => {
  const result = matchExtractedItem(
    draft({ suggested_product_code: "RBR-A3-14", suggested_brand_name: "کارخانه خیالی" }),
    products,
    brands,
  );
  assert.equal(result.brandId, null);
  assert.equal(result.status, "suspicious");
});

test("zero factory price becomes null", () => {
  const result = matchExtractedItem(draft({ suggested_product_code: "RBR-A3-14", factory_price: 0 }), products, brands);
  assert.equal(result.factoryPrice, null);
});

test("matches beam by unique size without inventing a sku", () => {
  const beams = getScopeProducts("beam", "ipe");
  const beamBrands = getScopeBrands("beam", "ipe");
  const result = matchExtractedItem(
    {
      raw_text: "تیرآهن 14 اصفهان",
      suggested_product_code: null,
      suggested_brand_id: null,
      suggested_brand_name: "اصفهان",
      grade: null,
      size: "14",
      factory_price: 42000,
      warehouse_price: null,
      unit: "toman_per_kg",
      confidence: 0.7,
      notes: null,
    },
    beams,
    beamBrands,
  );
  assert.equal(result.productCode, "BEAM-14");
  assert.equal(result.matchMethod, "grade_size");
  assert.equal(result.brandName, "اصفهان");
});
