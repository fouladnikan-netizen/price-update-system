import assert from "node:assert/strict";
import { test } from "node:test";
import { getScopeBrands, getScopeProducts } from "./catalog.ts";
import { matchExtractedItem, matchExtractResult } from "./match.ts";
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

test("accepts an existing website sku as product_code", () => {
  const result = matchExtractedItem(
    draft({ suggested_product_code: "RBR-000002", suggested_brand_name: "ذوب آهن اصفهان" }),
    products,
    brands,
  );
  assert.equal(result.productCode, "RBR-000002");
  assert.equal(result.brandName, "ذوب آهن اصفهان");
  assert.equal(result.matchMethod, "product_code");
  assert.equal(result.status, "pending_review");
});

test("rejects an invented product_code and falls back to website sku by grade+size+brand", () => {
  const result = matchExtractedItem(
    draft({ suggested_product_code: "REB-A3-14-ESF", suggested_brand_name: "ذوب آهن اصفهان" }),
    products,
    brands,
  );
  assert.equal(result.productCode, "RBR-000002");
  assert.equal(result.matchMethod, "grade_size_brand");
  assert.ok(result.reasons.some((item) => item.includes("کاتالوگ")));
});

test("does not invent a brand", () => {
  const result = matchExtractedItem(
    draft({ suggested_product_code: "RBR-000002", suggested_brand_name: "کارخانه خیالی" }),
    products,
    brands,
  );
  assert.equal(result.brandId, null);
  assert.equal(result.status, "suspicious");
});

test("zero factory price becomes null", () => {
  const result = matchExtractedItem(draft({ suggested_product_code: "RBR-000002", factory_price: 0 }), products, brands);
  assert.equal(result.factoryPrice, null);
});

test("maps mill name variants onto the website sku", () => {
  const result = matchExtractedItem(
    draft({
      raw_text: "میلگرد ۱۲ میل ذوب آهن 78550",
      suggested_product_code: null,
      suggested_brand_name: "ذوب آهن",
      grade: "A3",
      size: "12",
      factory_price: 78550,
    }),
    products,
    brands,
  );
  assert.equal(result.productCode, "RBR-000001");
  assert.equal(result.brandName, "ذوب آهن اصفهان");
  assert.equal(result.matchMethod, "grade_size_brand");
});

test("ribbed rebar mill نیشابور maps to website brand فولاد نیشابور", () => {
  const result = matchExtractedItem(
    draft({
      raw_text: "۱۴ A3 نیشابور کارخانه ۷۴۵۰۰",
      suggested_brand_name: "نیشابور",
      grade: "A3",
      size: "14",
      factory_price: 74500,
    }),
    products,
    brands,
  );
  assert.equal(result.brandName, "فولاد نیشابور");
  assert.ok(result.productCode?.startsWith("RBR-"));
  assert.equal(result.matchMethod, "grade_size_brand");
});

test("آذرفولاد امین maps onto catalog mill آذر امین", () => {
  const result = matchExtractedItem(
    draft({
      raw_text: "۱۴ A3 آذرفولاد امین کارخانه ۶۶۳۶۳",
      suggested_brand_name: "آذرفولاد امین",
      grade: "A3",
      size: "14",
      factory_price: 66363,
    }),
    products,
    brands,
  );
  assert.equal(result.brandName, "آذر امین");
  assert.equal(result.matchMethod, "grade_size_brand");
});

test("size 12 with brand resolves website sku without inventing a product", () => {
  const result = matchExtractedItem(
    draft({
      raw_text: "میلگرد ۱۲ میل ذوب آهن",
      suggested_product_code: null,
      suggested_brand_name: "ذوب آهن",
      grade: null,
      size: "12",
      factory_price: 78550,
    }),
    products,
    brands,
  );
  assert.equal(result.productCode, "RBR-000001");
  assert.equal(result.matchMethod, "grade_size_brand");
});

test("source rows outside the catalog are archived", () => {
  const result = matchExtractedItem(
    draft({
      raw_text: "میلگرد بستر سایز 6",
      suggested_product_code: null,
      suggested_brand_name: null,
      grade: null,
      size: "6",
      factory_price: 12000,
    }),
    products,
    brands,
  );
  assert.equal(result.productCode, null);
  assert.equal(result.status, "archived");
});

test("carries mill name onto following size rows", () => {
  const matched = matchExtractResult(
    {
      is_price_message: true,
      message_kind: "price_list",
      suspicious_reasons: [],
      items: [
        draft({
          raw_text: "میلگرد ذوب آهن اصفهان",
          suggested_brand_name: "ذوب آهن اصفهان",
          grade: null,
          size: null,
          factory_price: null,
        }),
        draft({
          raw_text: "12 A3 کارخانه 78550",
          suggested_brand_name: null,
          grade: "A3",
          size: "12",
          factory_price: 78550,
        }),
      ],
    },
    products,
    brands,
  );
  assert.equal(matched[1]?.productCode, "RBR-000001");
  assert.equal(matched[1]?.brandName, "ذوب آهن اصفهان");
});

test("ambiguous mill names are not guessed", () => {
  const result = matchExtractedItem(
    draft({ suggested_product_code: "RBR-000002", suggested_brand_name: "سیرجان" }),
    products,
    brands,
  );
  assert.equal(result.brandId, null);
  assert.equal(result.status, "suspicious");
});

test("حدید سیرجان and جهان فولاد سیرجان stay distinct", () => {
  const hadid = matchExtractedItem(draft({ suggested_brand_name: "حدید سیرجان" }), products, brands);
  const jahan = matchExtractedItem(draft({ suggested_brand_name: "جهان فولاد سیرجان" }), products, brands);
  assert.equal(hadid.brandName, "حدید سیرجان");
  assert.equal(jahan.brandName, "جهان فولاد سیرجان");
  assert.notEqual(hadid.brandId, jahan.brandId);
});

test("ظفر بناب stays distinct from bare بناب", () => {
  const zafar = matchExtractedItem(draft({ suggested_brand_name: "ظفر بناب" }), products, brands);
  const bare = matchExtractedItem(draft({ suggested_brand_name: "بناب" }), products, brands);
  assert.equal(zafar.brandName, "ظفر بناب");
  assert.equal(bare.brandId, null);
});

test("قائم اصفهان is the same mill as قائم رازی", () => {
  const result = matchExtractedItem(draft({ suggested_brand_name: "قائم اصفهان" }), products, brands);
  assert.equal(result.brandName, "قائم رازی");
});

test("گروه ملی maps onto catalog mill گروه ملی فولاد", () => {
  const result = matchExtractedItem(draft({ suggested_brand_name: "گروه ملی" }), products, brands);
  assert.equal(result.brandName, "گروه ملی فولاد");
});

test("کاوه اروند is not کاوه تیکمه داش", () => {
  const arvand = matchExtractedItem(draft({ suggested_brand_name: "کاوه اروند" }), products, brands);
  const tikmeh = matchExtractedItem(draft({ suggested_brand_name: "کاوه تیکمه داش" }), products, brands);
  const bareKaveh = matchExtractedItem(draft({ suggested_brand_name: "کاوه" }), products, brands);
  assert.equal(arvand.brandName, "کاوه اروند");
  assert.equal(tikmeh.brandName, "کاوه تیکمه داش");
  assert.equal(bareKaveh.brandId, null);
});

test("matches beam by size+brand onto website sku", () => {
  const beams = getScopeProducts("beam", "ipe");
  const beamBrands = getScopeBrands("beam", "ipe");
  const result = matchExtractedItem(
    {
      raw_text: "تیرآهن 14 آریان فولاد",
      suggested_product_code: null,
      suggested_brand_id: null,
      suggested_brand_name: "آریان فولاد",
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
  assert.equal(result.productCode, "IPE-000039");
  assert.equal(result.matchMethod, "grade_size_brand");
  assert.equal(result.brandName, "آریان فولاد");
});
