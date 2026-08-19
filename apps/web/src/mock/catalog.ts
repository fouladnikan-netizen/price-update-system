import type { CategoryBrand } from "./category-brands";
import catalog from "./category-products.json";

export type CatalogProduct = {
  sku: string;
  name: string;
  groupCode: string;
  categoryCode: string;
  brandNames: string[];
  sizeLabel: string;
  row: number;
};

const PRODUCTS = catalog as CatalogProduct[];

export function getAllCatalogProducts(): CatalogProduct[] {
  return PRODUCTS;
}

export function productRecordKey(product: CatalogProduct): string {
  return `${product.sku}::${product.row}`;
}

/** UI category for channel سبک/سنگین; other groups keep catalog categoryCode. */
export function getUiCategoryCode(product: CatalogProduct): string {
  if (product.groupCode === "channel") {
    return product.sku.startsWith("CHN-sangin-") ? "sangin" : "sabok";
  }
  return product.categoryCode;
}

export function getCategoryProducts(
  groupCode: string | undefined,
  categoryCode: string | undefined,
  brand: CategoryBrand | undefined,
): CatalogProduct[] {
  if (!groupCode || !categoryCode) return [];
  const catalogCategory = resolveCatalogCategoryCode(groupCode, categoryCode);
  const products = PRODUCTS.filter((product) => {
    if (product.groupCode !== groupCode || product.categoryCode !== catalogCategory) return false;
    if (!brand) return true;
    return product.brandNames.includes(brand.name);
  });
  const scoped = isChannelVariantCategory(groupCode, categoryCode)
    ? filterChannelVariant(products, categoryCode)
    : products;
  return [...scoped].sort(compareProductsBySize);
}

/** UI subgroup codes map onto the Website categoryCode `channel`. */
function resolveCatalogCategoryCode(groupCode: string, categoryCode: string): string {
  if (groupCode === "channel") return "channel";
  return categoryCode;
}

export function isAngleCategory(groupCode: string | undefined): boolean {
  return groupCode === "angle";
}

const MISSING_SIZE = Number.POSITIVE_INFINITY;

function parsePairSize(value: string): [number, number] | null {
  const match = value.replace(/×/g, "*").match(/(\d+(?:\.\d+)?)\s*\*\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

function parseNumericToken(value: string): number | null {
  const mixed = value.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = value.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseMillThickness(name: string): number {
  const match = name.replace(/\u200c/g, " ").match(/(\d+(?:\.\d+)?)\s*میل/);
  return match ? Number(match[1]) : MISSING_SIZE;
}

function parseInchSize(name: string): number | null {
  const match = name.replace(/\u200c/g, " ").match(/(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*اینچ/);
  if (!match) return null;
  return parseNumericToken(match[1].trim());
}

function parseChannelSize(product: CatalogProduct): number {
  const fromName = product.name.replace(/\u200c/g, " ").match(/ناودانی\s+(\d+(?:\.\d+)?)/);
  if (fromName) return Number(fromName[1]);
  const fromLabel = parseNumericToken(product.sizeLabel);
  return fromLabel ?? MISSING_SIZE;
}

function compareSortKeys(a: number[], b: number[]): number {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const left = a[i] ?? MISSING_SIZE;
    const right = b[i] ?? MISSING_SIZE;
    if (left !== right) return left - right;
  }
  return 0;
}

function productSortKey(product: CatalogProduct): number[] {
  const label = productSizeLabel(product);
  const pair = parsePairSize(label) ?? parsePairSize(product.name);
  const mill = parseMillThickness(product.name);
  const displayed = parseNumericToken(label);
  const inch = parseInchSize(product.name);

  if (product.groupCode === "angle") {
    return [pair?.[0] ?? MISSING_SIZE, pair?.[1] ?? MISSING_SIZE, mill, product.row];
  }
  if (product.groupCode === "pipe") {
    return [inch ?? displayed ?? mill, mill, product.row];
  }
  if (product.groupCode === "sheet" || product.groupCode === "profile") {
    return [displayed ?? mill, pair?.[0] ?? MISSING_SIZE, pair?.[1] ?? MISSING_SIZE, mill, product.row];
  }
  return [displayed ?? mill, mill, product.row];
}

function compareProductsBySize(a: CatalogProduct, b: CatalogProduct): number {
  const bySize = compareSortKeys(productSortKey(a), productSortKey(b));
  if (bySize !== 0) return bySize;
  return a.name.localeCompare(b.name, "fa");
}

export function countGroupProducts(groupCode: string): number {
  return PRODUCTS.filter((product) => product.groupCode === groupCode).length;
}

export const HASH_VARIANT_TABS: CategoryBrand[] = [
  { id: "light", name: "هاش سبک" },
  { id: "heavy", name: "هاش سنگین" },
];

export function isHashCategory(groupCode: string | undefined, categoryCode: string | undefined): boolean {
  return groupCode === "beam" && categoryCode === "h";
}

export function filterHashVariant(products: CatalogProduct[], variantId: string): CatalogProduct[] {
  const prefix = variantId === "heavy" ? "HASH-sangin-" : "HASH-sabok-";
  return products.filter((product) => product.sku.startsWith(prefix));
}

export function isChannelVariantCategory(
  groupCode: string | undefined,
  categoryCode: string | undefined,
): boolean {
  return groupCode === "channel" && (categoryCode === "sabok" || categoryCode === "sangin");
}

/** Website SKUs: CHN-sabok-* = سبک, CHN-sangin-* = سنگین. Names also contain سبک/سنگین. */
export function filterChannelVariant(products: CatalogProduct[], variantId: string): CatalogProduct[] {
  const prefix = variantId === "sangin" ? "CHN-sangin-" : variantId === "sabok" ? "CHN-sabok-" : null;
  if (!prefix) return [];
  return products.filter((product) => product.sku.startsWith(prefix));
}

export function isSheetCategory(groupCode: string | undefined): boolean {
  return groupCode === "sheet";
}

export function isProfileCategory(groupCode: string | undefined): boolean {
  return groupCode === "profile";
}

function millThicknessLabel(name: string): string | null {
  const match = name.replace(/\u200c/g, " ").match(/(\d+(?:\.\d+)?)\s*میل/);
  return match ? match[1] : null;
}

export function productSizeLabel(product: CatalogProduct): string {
  if (isSheetCategory(product.groupCode) || isProfileCategory(product.groupCode)) {
    const mill = millThicknessLabel(product.name);
    if (mill) return mill;
  }
  if (product.groupCode === "channel") {
    const size = parseChannelSize(product);
    if (Number.isFinite(size)) return String(size);
  }
  return product.sizeLabel;
}

export function productSizeColumnLabel(groupCode: string | undefined, _categoryCode?: string): string {
  if (isSheetCategory(groupCode) || isProfileCategory(groupCode)) return "ضخامت / کالا";
  return "سایز / کالا";
}
