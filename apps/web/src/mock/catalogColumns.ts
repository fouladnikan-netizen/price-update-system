import excelRows from "./excel-catalog-rows.json";
import { getProductCategory, getProductGroup } from "./data";
import {
  getUiCategoryCode,
  isSheetCategory,
  productSizeLabel,
  type CatalogProduct,
} from "./catalog";

export type ExcelCatalogFields = {
  group: string;
  category: string;
  name: string;
  kind: string;
  dimensions: string;
  size: string;
  weight: string;
  unit: string;
  pipeClass: string;
  thickness: string;
};

export const EXCEL_COLUMNS: Array<{ key: keyof ExcelCatalogFields; label: string }> = [
  { key: "category", label: "دسته" },
  { key: "name", label: "نام کالا" },
  { key: "kind", label: "نوع" },
  { key: "dimensions", label: "ابعاد/طول" },
  { key: "size", label: "سایز" },
  { key: "pipeClass", label: "رده لوله" },
  { key: "thickness", label: "ضخامت" },
];

type CatalogColumnRow = ExcelCatalogFields & {
  key: string;
  groupCode: string;
  groupName: string;
  categoryCode: string;
  categoryName: string;
  sku: string;
};

function normalizeName(value: string): string {
  return value.replace(/\u200c/g, " ").replace(/\s+/g, " ").trim();
}

/** Website says «سایز ۱۰»; Excel says «قطر 10 میل». */
function excelMatchKey(value: string): string {
  return normalizeName(value)
    .replace(/قطر/g, "سایز")
    .replace(/\s*میل\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPresent(value: string | undefined): boolean {
  const text = (value ?? "").trim();
  return text !== "" && text.toUpperCase() !== "NULL";
}

function numericToken(value: string): string {
  return value.replace(/میل/g, "").replace(/,/g, ".").replace(/\s+/g, "").trim();
}

function sizeMatchesThickness(size: string, thickness: string): boolean {
  if (!isPresent(thickness)) return true;
  if (!isPresent(size)) return false;
  return numericToken(size) === numericToken(thickness);
}

function indexExcelRows(keyOf: (row: ExcelCatalogFields) => string): Map<string, ExcelCatalogFields[]> {
  const map = new Map<string, ExcelCatalogFields[]>();
  for (const row of excelRows as ExcelCatalogFields[]) {
    const key = keyOf(row);
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return map;
}

const EXCEL_BY_NAME = indexExcelRows((row) => normalizeName(row.name));
const EXCEL_BY_KEY = indexExcelRows((row) => excelMatchKey(row.name));

function parsedFallback(product: CatalogProduct): ExcelCatalogFields {
  const name = product.name.replace(/\u200c/g, " ");
  const mill = name.match(/(\d+(?:\.\d+)?)\s*میل/);
  const dims = name.match(/(\d+)\s*[*×]\s*(\d+|طول)/);
  const width = name.match(/عرض\s+(\d+)/);
  const pipeClass = name.match(/رده\s+(\d+)/);
  const inch = name.match(/(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*اینچ/);
  const grade = name.match(/\bA[1-4]\b/i)?.[0].toUpperCase() ?? "";
  let kind = grade;
  if (!kind) {
    if (name.includes("رول")) kind = "رول";
    else if (name.includes("برش")) kind = "برش‌خورده";
    else if (name.includes("فابریک")) kind = "فابریک";
  }
  const categoryCode = getUiCategoryCode(product);
  return {
    group: getProductGroup(product.groupCode)?.nameFa ?? product.groupCode,
    category: getProductCategory(product.groupCode, categoryCode)?.nameFa ?? categoryCode,
    name: product.name,
    kind,
    dimensions: dims ? `${dims[1]}*${dims[2]}` : width ? width[1] : inch ? `${inch[1]} اینچ` : "",
    size: isSheetCategory(product.groupCode) && mill ? `${mill[1]} میل` : productSizeLabel(product),
    weight: "",
    unit: "کیلوگرم",
    pipeClass: product.groupCode === "pipe" ? (pipeClass?.[1] ?? "") : "",
    thickness: mill?.[1] ?? "",
  };
}

function withGroup(product: CatalogProduct, fields: ExcelCatalogFields): ExcelCatalogFields {
  return {
    ...fields,
    group: getProductGroup(product.groupCode)?.nameFa ?? product.groupCode,
  };
}

function excelRowsForProduct(product: CatalogProduct): ExcelCatalogFields[] | undefined {
  const exact = EXCEL_BY_NAME.get(normalizeName(product.name));
  if (exact?.length) return exact;
  const keyed = EXCEL_BY_KEY.get(excelMatchKey(product.name));
  if (keyed?.length) return keyed;
  return undefined;
}

export function excelFieldsForProduct(product: CatalogProduct): ExcelCatalogFields {
  const matches = excelRowsForProduct(product);
  if (matches?.length === 1) return withGroup(product, matches[0]);
  if (matches && matches.length > 1) {
    const categoryName = getProductCategory(product.groupCode, getUiCategoryCode(product))?.nameFa;
    const byCategory = matches.find((row) => row.category === categoryName);
    if (byCategory) return withGroup(product, byCategory);
    return withGroup(product, matches[0]);
  }
  return parsedFallback(product);
}

export function catalogColumnRow(product: CatalogProduct): CatalogColumnRow {
  const fields = excelFieldsForProduct(product);
  const categoryCode = getUiCategoryCode(product);
  return {
    ...fields,
    group: getProductGroup(product.groupCode)?.nameFa ?? product.groupCode,
    category: getProductCategory(product.groupCode, categoryCode)?.nameFa ?? categoryCode,
    key: `${product.sku}::${product.row}`,
    groupCode: product.groupCode,
    groupName: getProductGroup(product.groupCode)?.nameFa ?? product.groupCode,
    categoryCode,
    categoryName: getProductCategory(product.groupCode, categoryCode)?.nameFa ?? categoryCode,
    sku: product.sku,
  };
}

export function visibleExcelColumns(rows: ExcelCatalogFields[]): Array<(typeof EXCEL_COLUMNS)[number]> {
  const thicknessRedundant =
    rows.length > 0 && rows.every((row) => sizeMatchesThickness(row.size, row.thickness));
  return EXCEL_COLUMNS.filter((column) => {
    if (column.key === "unit" || column.key === "weight") return false;
    if (column.key === "name" || column.key === "category") return true;
    if (column.key === "thickness" && thicknessRedundant) return false;
    return rows.some((row) => isPresent(row[column.key]));
  });
}

export function displayExcelValue(value: string): string {
  return isPresent(value) ? value : "";
}

export type { CatalogColumnRow };
