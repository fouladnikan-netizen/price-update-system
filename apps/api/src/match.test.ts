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

test("maps mill name variants onto the catalog mill", () => {
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
  assert.equal(result.productCode, "RBR-A3-12");
  assert.equal(result.brandName, "ذوب آهن اصفهان");
  assert.equal(result.matchMethod, "grade_size");
});

test("ribbed rebar mill نیشابور is فولاد خراسان, not خیام", () => {
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
  assert.equal(result.brandId, "rebar-ribbed-09");
  assert.equal(result.brandName, "نیشابور");
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
  assert.equal(result.brandId, "rebar-ribbed-02");
  assert.equal(result.brandName, "آذر امین");
});

test("size 12 without grade suggests A3 instead of creating a product", () => {
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
  assert.equal(result.productCode, "RBR-A3-12");
  assert.equal(result.matchMethod, "size_default_a3");
  assert.equal(result.status, "suspicious");
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
  assert.equal(matched[1]?.productCode, "RBR-A3-12");
  assert.equal(matched[1]?.brandName, "ذوب آهن اصفهان");
});

test("ambiguous mill names are not guessed", () => {
  const result = matchExtractedItem(
    draft({ suggested_product_code: "RBR-A3-14", suggested_brand_name: "سیرجان" }),
    products,
    brands,
  );
  assert.equal(result.brandId, null);
  assert.equal(result.status, "suspicious");
});

test("حدید سیرجان and جهان فولاد سیرجان stay distinct", () => {
  const hadid = matchExtractedItem(draft({ suggested_brand_name: "حدید سیرجان" }), products, brands);
  const jahan = matchExtractedItem(draft({ suggested_brand_name: "جهان فولاد سیرجان" }), products, brands);
  assert.equal(hadid.brandId, "rebar-ribbed-08");
  assert.equal(jahan.brandId, "rebar-ribbed-07");
});

test("فولاد بناب and ظفر بناب stay distinct", () => {
  const bonab = matchExtractedItem(draft({ suggested_brand_name: "فولاد بناب" }), products, brands);
  const zafar = matchExtractedItem(draft({ suggested_brand_name: "ظفر بناب" }), products, brands);
  const bare = matchExtractedItem(draft({ suggested_brand_name: "بناب" }), products, brands);
  assert.equal(bonab.brandId, "rebar-ribbed-21");
  assert.equal(zafar.brandId, "rebar-ribbed-15");
  assert.equal(bare.brandId, null);
});

test("قائم اصفهان is the same mill as قائم رازی", () => {
  const result = matchExtractedItem(draft({ suggested_brand_name: "قائم اصفهان" }), products, brands);
  assert.equal(result.brandId, "rebar-ribbed-28");
  assert.equal(result.brandName, "قائم رازی");
});

test("گروه ملی maps onto catalog mill گروه ملی فولاد", () => {
  const result = matchExtractedItem(draft({ suggested_brand_name: "گروه ملی" }), products, brands);
  assert.equal(result.brandId, "rebar-ribbed-35");
  assert.equal(result.brandName, "گروه ملی فولاد");
});

test("کاوه اروند is not کاوه تیکمه داش", () => {
  const arvand = matchExtractedItem(draft({ suggested_brand_name: "اروند" }), products, brands);
  const tikmeh = matchExtractedItem(draft({ suggested_brand_name: "کاوه تیکمه داش" }), products, brands);
  const bareKaveh = matchExtractedItem(draft({ suggested_brand_name: "کاوه" }), products, brands);
  assert.equal(arvand.brandId, "rebar-ribbed-32");
  assert.equal(tikmeh.brandId, "rebar-ribbed-33");
  assert.equal(bareKaveh.brandId, null);
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
