import {
  countProductsByGradeSize,
  findBrand,
  findBrandInText,
  findProductByCode,
  findProductByGradeSize,
  findProductByGradeSizeBrand,
  listProductsByGradeSize,
  productAllowsBrand,
  type CatalogProduct,
} from "./catalog.ts";
import type { CategoryBrand } from "../../web/src/mock/category-brands.ts";
import { normalizeGrade, normalizeSize, parseGradeFromText, parsePriceNumber, parseSizeFromText } from "./numbers.ts";
import type { ExtractedItemDraft, ModelExtractResult } from "./schema.ts";

export type ObservationMatch = {
  rawText: string;
  productCode: string | null;
  productName: string | null;
  brandId: string | null;
  brandName: string | null;
  matchMethod: "product_code" | "grade_size_brand" | "grade_size" | "size_default_a3" | "unmatched";
  factoryPrice: number | null;
  warehousePrice: number | null;
  unit: ExtractedItemDraft["unit"];
  confidence: number;
  status: "pending_review" | "unmatched" | "ambiguous" | "suspicious" | "archived";
  reasons: string[];
  notes: string | null;
  candidateProductCodes: string[];
};

function sizeExists(products: CatalogProduct[], size: string | null): boolean {
  if (!size) return false;
  return products.some((item) => normalizeSize(item.sizeLabel) === size);
}

function suggestA3WhenGradeMissing(products: CatalogProduct[], size: string): CatalogProduct | null {
  const a3 = findProductByGradeSize(products, "A3", size);
  const a2 = findProductByGradeSize(products, "A2", size);
  if (a3 && a2) return a3;
  return null;
}

export function matchExtractedItem(
  item: ExtractedItemDraft,
  products: CatalogProduct[],
  brands: CategoryBrand[],
): ObservationMatch {
  const reasons: string[] = [];
  let candidateProductCodes: string[] = [];
  const factoryPrice = parsePriceNumber(item.factory_price);
  const warehousePrice = parsePriceNumber(item.warehouse_price);
  if ((item.factory_price === 0 || item.warehouse_price === 0) && factoryPrice === null && warehousePrice === null) {
    reasons.push("قیمت صفر به دادهٔ ناموجود تبدیل شد");
  }

  const size = normalizeSize(item.size) ?? parseSizeFromText(item.raw_text);
  const grade = normalizeGrade(item.grade) ?? parseGradeFromText(item.raw_text);
  const brandFromHint = findBrand(brands, item.suggested_brand_id, item.suggested_brand_name);
  const brand =
    brandFromHint ??
    (item.suggested_brand_id || item.suggested_brand_name ? null : findBrandInText(brands, item.raw_text));
  if ((item.suggested_brand_id || item.suggested_brand_name) && !brand) {
    reasons.push("نام کارخانه به برند کاتالوگ وصل نشد و ساخته نشد");
  }

  const byCode = findProductByCode(products, item.suggested_product_code);
  const bySpecBrand = findProductByGradeSizeBrand(products, grade, size, brand?.name ?? item.suggested_brand_name);
  const bySpec = findProductByGradeSize(products, grade, size);
  const multiHits = countProductsByGradeSize(products, grade, size);
  let product: CatalogProduct | null = null;
  let matchMethod: ObservationMatch["matchMethod"] = "unmatched";

  if (item.suggested_product_code && !byCode) {
    reasons.push("کد کالای پیشنهادی در کاتالوگ نیست و نادیده گرفته شد");
  }
  if (byCode) {
    product = byCode;
    matchMethod = "product_code";
  } else if (bySpecBrand) {
    product = bySpecBrand;
    matchMethod = "grade_size_brand";
  } else if (bySpec) {
    product = bySpec;
    matchMethod = "grade_size";
  } else if (size && multiHits > 1) {
    candidateProductCodes = listProductsByGradeSize(products, grade, size)
      .map((row) => row.sku)
      .slice(0, 12);
    reasons.push("چند کالای موجود برای این سایز/استاندارد هست؛ بدون انتخاب کاربر محصول ساخته نمی‌شود");
  } else if (size) {
    const suggestedA3 = suggestA3WhenGradeMissing(products, size);
    if (suggestedA3) {
      product = suggestedA3;
      matchMethod = "size_default_a3";
      reasons.push("استاندارد در منبع نبود. A3 پیشنهاد شد و باید تأیید شود. کالای جدید ساخته نشد.");
    } else {
      reasons.push("این سایز در کاتالوگ چند کالا دارد؛ بدون برند/استاندارد تطبیق قطعی نیست");
    }
  }

  if (product && brand && !productAllowsBrand(product, brand.name)) {
    reasons.push("این برند روی این کالا تگ مجاز ندارد");
  }
  if (product && !brand) {
    reasons.push("کارخانه مشخص نشد؛ قیمت کارخانه‌های مختلف مخلوط نمی‌شود");
  }

  let status: ObservationMatch["status"] = "pending_review";
  if (!product) {
    if (size && multiHits > 1) {
      status = "ambiguous";
      reasons.push("وضعیت AMBIGUOUS: چند گزینه موجود؛ هیچ‌کدام خودکار انتخاب نشد و محصول جدید ساخته نشد.");
    } else if (sizeExists(products, size)) {
      status = "unmatched";
      reasons.push("به sku کاتالوگ وصل نشد. محصول جدید ساخته نمی‌شود.");
    } else {
      status = "archived";
      reasons.push("در کاتالوگ ما نیست. بایگانی شد و کالا یا برند جدید ساخته نشد.");
    }
  } else if (reasons.length) {
    status = "suspicious";
  }
  if (factoryPrice === null && warehousePrice === null) {
    reasons.push("هر دو نوع قیمت خالی است");
    if (status === "pending_review") status = "suspicious";
    if (status === "unmatched") status = "archived";
  }

  return {
    rawText: item.raw_text,
    productCode: product?.sku ?? null,
    productName: product?.name ?? null,
    brandId: brand?.id ?? null,
    brandName: brand?.name ?? null,
    matchMethod,
    factoryPrice,
    warehousePrice,
    unit: item.unit,
    confidence: item.confidence,
    status,
    reasons,
    notes: item.notes,
    candidateProductCodes,
  };
}

export function matchExtractResult(
  extracted: ModelExtractResult,
  products: CatalogProduct[],
  brands: CategoryBrand[],
): ObservationMatch[] {
  let lastBrandName: string | null = null;
  return extracted.items.map((item) => {
    const fromText = findBrand(brands, item.suggested_brand_id, item.suggested_brand_name);
    if (fromText?.name) lastBrandName = fromText.name;
    else if (!item.suggested_brand_name && lastBrandName) {
      return matchExtractedItem({ ...item, suggested_brand_name: lastBrandName }, products, brands);
    }
    return matchExtractedItem(item, products, brands);
  });
}
