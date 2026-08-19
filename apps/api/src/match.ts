import {
  findBrand,
  findProductByCode,
  findProductByGradeSize,
  productAllowsBrand,
  type CatalogProduct,
} from "./catalog.ts";
import type { CategoryBrand } from "../../web/src/mock/category-brands.ts";
import { parsePriceNumber } from "./numbers.ts";
import type { ExtractedItemDraft, ModelExtractResult } from "./schema.ts";

export type ObservationMatch = {
  rawText: string;
  productCode: string | null;
  productName: string | null;
  brandId: string | null;
  brandName: string | null;
  matchMethod: "product_code" | "grade_size" | "unmatched";
  factoryPrice: number | null;
  warehousePrice: number | null;
  unit: ExtractedItemDraft["unit"];
  confidence: number;
  status: "pending_review" | "unmatched" | "suspicious";
  reasons: string[];
  notes: string | null;
};

export function matchExtractedItem(
  item: ExtractedItemDraft,
  products: CatalogProduct[],
  brands: CategoryBrand[],
): ObservationMatch {
  const reasons: string[] = [];
  const factoryPrice = parsePriceNumber(item.factory_price);
  const warehousePrice = parsePriceNumber(item.warehouse_price);
  if ((item.factory_price === 0 || item.warehouse_price === 0) && factoryPrice === null && warehousePrice === null) {
    reasons.push("قیمت صفر به دادهٔ ناموجود تبدیل شد");
  }

  const byCode = findProductByCode(products, item.suggested_product_code);
  const bySpec = findProductByGradeSize(products, item.grade, item.size);
  let product: CatalogProduct | null = null;
  let matchMethod: ObservationMatch["matchMethod"] = "unmatched";

  if (item.suggested_product_code && !byCode) {
    reasons.push("کد کالای پیشنهادی در کاتالوگ نیست و نادیده گرفته شد");
  }
  if (byCode) {
    product = byCode;
    matchMethod = "product_code";
  } else if (bySpec) {
    product = bySpec;
    matchMethod = "grade_size";
  } else {
    reasons.push("تطبیق قطعی با product_code ممکن نشد");
  }

  const brand = findBrand(brands, item.suggested_brand_id, item.suggested_brand_name);
  if ((item.suggested_brand_id || item.suggested_brand_name) && !brand) {
    reasons.push("برند پیشنهادی در فهرست دسته نیست و ساخته نشد");
  }
  if (product && brand && !productAllowsBrand(product, brand.name)) {
    reasons.push("این برند روی این کالا تگ مجاز ندارد");
  }

  let status: ObservationMatch["status"] = "pending_review";
  if (!product) status = "unmatched";
  else if (reasons.length) status = "suspicious";
  if (factoryPrice === null && warehousePrice === null) {
    reasons.push("هر دو نوع قیمت خالی است");
    if (status === "pending_review") status = "suspicious";
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
  };
}

export function matchExtractResult(
  extracted: ModelExtractResult,
  products: CatalogProduct[],
  brands: CategoryBrand[],
): ObservationMatch[] {
  return extracted.items.map((item) => matchExtractedItem(item, products, brands));
}
