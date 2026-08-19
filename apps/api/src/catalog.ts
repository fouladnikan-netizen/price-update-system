import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getCategoryBrands, type CategoryBrand } from "../../web/src/mock/category-brands.ts";
import { getProductCategory, getProductGroup } from "../../web/src/mock/data.ts";
import { normalizeGrade, normalizeSize } from "./numbers.ts";

export type CatalogProduct = {
  sku: string;
  name: string;
  groupCode: string;
  categoryCode: string;
  brandNames: string[];
  sizeLabel: string;
};

const PRODUCTS = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../../web/src/mock/category-products.json"), "utf8"),
) as CatalogProduct[];

export function isKnownScope(groupCode: string, categoryCode: string): boolean {
  return Boolean(getProductGroup(groupCode) && getProductCategory(groupCode, categoryCode));
}

export function scopeLabel(groupCode: string, categoryCode: string): { groupLabel: string; categoryLabel: string } {
  return {
    groupLabel: getProductGroup(groupCode)?.nameFa ?? groupCode,
    categoryLabel: getProductCategory(groupCode, categoryCode)?.nameFa ?? categoryCode,
  };
}

function catalogCategoryCode(groupCode: string, categoryCode: string): string {
  if (groupCode === "channel") return "channel";
  return categoryCode;
}

export function getScopeProducts(groupCode: string, categoryCode: string): CatalogProduct[] {
  const catalogCategory = catalogCategoryCode(groupCode, categoryCode);
  return PRODUCTS.filter((item) => {
    if (item.groupCode !== groupCode || item.categoryCode !== catalogCategory) return false;
    if (groupCode !== "channel") return true;
    const variant = item.sku.startsWith("CHN-sangin-") ? "sangin" : "sabok";
    return variant === categoryCode;
  });
}

export function getScopeBrands(groupCode: string, categoryCode: string): CategoryBrand[] {
  return getCategoryBrands(groupCode, categoryCode);
}

export function findProductByCode(
  products: CatalogProduct[],
  productCode: string | null | undefined,
): CatalogProduct | null {
  if (!productCode) return null;
  const code = productCode.trim();
  return products.find((item) => item.sku === code) ?? null;
}

export function findProductByGradeSize(
  products: CatalogProduct[],
  grade: string | null,
  size: string | null,
): CatalogProduct | null {
  const g = normalizeGrade(grade);
  const s = normalizeSize(size);
  if (g && s) {
    const withGrade = products.filter((item) => {
      const name = item.name.toUpperCase();
      return name.includes(g) && normalizeSize(item.sizeLabel) === s;
    });
    if (withGrade.length === 1) return withGrade[0];
  }
  if (!s) return null;
  const bySize = products.filter((item) => normalizeSize(item.sizeLabel) === s);
  return bySize.length === 1 ? bySize[0] : null;
}

export function findBrand(
  brands: CategoryBrand[],
  brandId: string | null | undefined,
  brandName: string | null | undefined,
): CategoryBrand | null {
  if (brandId) {
    const byId = brands.find((item) => item.id === brandId);
    if (byId) return byId;
  }
  if (!brandName) return null;
  const needle = brandName.replace(/\s+/g, " ").trim();
  const exact = brands.filter((item) => item.name === needle);
  return exact.length === 1 ? exact[0] : null;
}

export function productAllowsBrand(product: CatalogProduct, brandName: string): boolean {
  return product.brandNames.includes(brandName);
}
