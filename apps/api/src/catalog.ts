import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getCategoryBrands, type CategoryBrand } from "../../web/src/mock/category-brands.ts";
import { getProductCategory, getProductGroup } from "../../web/src/mock/data.ts";
import { normalizeGrade, normalizeSize } from "./numbers.ts";

const BRAND_STOP = new Set([
  "فولاد",
  "میلگرد",
  "تیرآهن",
  "نبشی",
  "ناودانی",
  "ورق",
  "لوله",
  "شرکت",
  "مجتمع",
  "صنایع",
  "نورد",
  "کارخانه",
  "گروه",
  "ایرانیان",
]);

export function normalizeBrandKey(value: string): string {
  return value
    .replace(/\u200c/g, " ")
    .replace(/\u200d/g, "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/آ/g, "ا")
    .replace(/أ/g, "ا")
    .replace(/إ/g, "ا")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function brandCore(value: string): string {
  return normalizeBrandKey(value)
    .replace(/(فولاد|میلگرد|اهن|مجتمع|صنایع)/g, " $1 ")
    .replace(/\s+/g, " ")
    .replace(/^(میلگرد|تیرآهن|نبشی|ناودانی|ورق|لوله)\s+/, "")
    .trim();
}

function uniqueBrand(hits: CategoryBrand[]): CategoryBrand | null {
  return hits.length === 1 ? hits[0] : null;
}

/** Source wording → catalog mill name. Only 1-to-1 aliases; never merge distinct mills. */
const MILL_ALIASES = new Map<string, string>(
  [
    ["قائم اصفهان", "قائم رازی"],
    ["قایم اصفهان", "قائم رازی"],
    ["قایم رازی", "قائم رازی"],
    ["گروه ملی", "گروه ملی فولاد"],
    ["گروه ملی صنعتی", "گروه ملی فولاد"],
    ["ملی فولاد", "گروه ملی فولاد"],
    ["نیشابور", "فولاد نیشابور"],
    ["خراسان", "فولاد نیشابور"],
    ["ذوب آهن", "ذوب آهن اصفهان"],
    ["آذرفولاد امین", "آذر امین"],
  ].map(([from, to]) => [brandCore(from), to]),
);

function brandByCatalogName(brands: CategoryBrand[], catalogName: string): CategoryBrand | null {
  return brands.find((item) => brandCore(item.name) === brandCore(catalogName)) ?? null;
}

function aliasBrand(brands: CategoryBrand[], needle: string): CategoryBrand | null {
  const target = MILL_ALIASES.get(needle);
  return target ? brandByCatalogName(brands, target) : null;
}

export type CatalogProduct = {
  sku: string;
  name: string;
  groupCode: string;
  categoryCode: string;
  brandNames: string[];
  sizeLabel: string;
};

export const PRODUCTS = JSON.parse(
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

function productMatchesGrade(item: CatalogProduct, grade: string): boolean {
  const name = item.name.toUpperCase();
  const g = grade.toUpperCase();
  if (g === "PLAIN" || g === "ساده") return /ساده/.test(item.name);
  if (g === "A2") return /A\s*2/i.test(item.name) || name.includes("A2");
  if (g === "A3") return (/A\s*3/i.test(item.name) || name.includes("A3") || /آجدار/.test(item.name)) && !/ساده/.test(item.name);
  return name.includes(g);
}

function candidatesByGradeSize(
  products: CatalogProduct[],
  grade: string | null,
  size: string | null,
): CatalogProduct[] {
  const g = normalizeGrade(grade);
  const s = normalizeSize(size);
  if (g && s) {
    return products.filter((item) => productMatchesGrade(item, g) && normalizeSize(item.sizeLabel) === s);
  }
  if (!s) return [];
  return products.filter((item) => normalizeSize(item.sizeLabel) === s);
}

export function findProductByGradeSize(
  products: CatalogProduct[],
  grade: string | null,
  size: string | null,
): CatalogProduct | null {
  const hits = candidatesByGradeSize(products, grade, size);
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Website SoT: one catalog row per brand×spec (sequential SKU).
 * Prefer exact brand match on brandNames / product name.
 */
export function findProductByGradeSizeBrand(
  products: CatalogProduct[],
  grade: string | null,
  size: string | null,
  brandName: string | null | undefined,
): CatalogProduct | null {
  if (!brandName?.trim()) return null;
  const needle = brandCore(brandName);
  if (needle.length < 2) return null;
  const hits = candidatesByGradeSize(products, grade, size).filter((item) => {
    if (item.brandNames.some((name) => brandCore(name) === needle)) return true;
    if (item.brandNames.some((name) => {
      const hay = brandCore(name);
      return hay.length >= 3 && needle.length >= 3 && (hay.includes(needle) || needle.includes(hay));
    })) {
      return true;
    }
    const hay = brandCore(item.name);
    return hay.includes(needle) || needle.split(" ").filter((t) => t.length >= 3).every((t) => hay.includes(t));
  });
  return hits.length === 1 ? hits[0] : null;
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
  const needle = brandCore(brandName);
  if (needle.length < 2) return null;

  const aliased = aliasBrand(brands, needle);
  if (aliased) return aliased;

  const exact = uniqueBrand(
    brands.filter((item) => brandCore(item.name) === needle || normalizeBrandKey(item.name) === normalizeBrandKey(brandName)),
  );
  if (exact) return exact;

  const contained = uniqueBrand(
    brands.filter((item) => {
      const hay = brandCore(item.name);
      if (needle.length < 3 || hay.length < 3) return false;
      return hay.includes(needle) || needle.includes(hay);
    }),
  );
  if (contained) return contained;

  const tokens = needle.split(" ").filter((part) => part.length >= 3 && !BRAND_STOP.has(part));
  if (!tokens.length) return null;
  return uniqueBrand(
    brands.filter((item) => {
      const hay = brandCore(item.name);
      return tokens.every((token) => hay.includes(token));
    }),
  );
}

export function findBrandInText(brands: CategoryBrand[], text: string | null | undefined): CategoryBrand | null {
  if (!text || text.trim().length > 220) return null;
  const hay = brandCore(text);
  if (!hay) return null;
  const aliased = aliasBrand(brands, hay);
  if (aliased) return aliased;
  const hits = brands.filter((item) => {
    const name = brandCore(item.name);
    if (name.length >= 4 && hay.includes(name)) return true;
    const tokens = name.split(" ").filter((part) => part.length >= 3 && !BRAND_STOP.has(part));
    if (tokens.length >= 2) return tokens.every((token) => hay.includes(token));
    return tokens.length === 1 && tokens[0].length >= 4 && hay.includes(tokens[0]);
  });
  return uniqueBrand(hits);
}

export function productAllowsBrand(product: CatalogProduct, brandName: string): boolean {
  if (!product.brandNames.length) return true;
  const needle = brandCore(brandName);
  if (!needle) return false;
  return product.brandNames.some((name) => {
    const hay = brandCore(name);
    if (!hay) return false;
    if (hay === needle) return true;
    if (hay.length >= 3 && needle.length >= 3 && (hay.includes(needle) || needle.includes(hay))) return true;
    return false;
  });
}
