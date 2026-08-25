#!/usr/bin/env node
/**
 * OFFLINE / ARCHIVE ONLY.
 * Do NOT use this to overwrite the runtime catalog.
 * Runtime source of truth is Website SKUs via scripts/sync-catalog-from-website.mjs
 *
 * Requires ALLOW_FINAL_PRODUCT_CATALOG=1 to run.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.ALLOW_FINAL_PRODUCT_CATALOG !== "1") {
  console.error(
    "Refused: Final Product sync invents compositional SKUs and breaks Website catalog lock.\n" +
      "Use: node scripts/sync-catalog-from-website.mjs\n" +
      "Override only with ALLOW_FINAL_PRODUCT_CATALOG=1 (archive/debug).",
  );
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const excelPath = resolve(root, "apps/web/src/mock/excel-catalog-rows.json");
const officialPath = resolve(root, "apps/web/src/mock/brand-official-tables.json");
const productsOut = resolve(root, "apps/web/src/mock/category-products.json");
const brandsOut = resolve(root, "apps/web/src/mock/category-brands.generated.json");
const reportOut = resolve(root, "data/exports/final-product-sync-report.json");

const CATEGORY_SCOPE = {
  میلگرد: "rebar/ribbed",
  "میلگرد ساده": "rebar/plain",
  تیرآهن: "beam/ipe",
  "تیرآهن هاش": "beam/h",
  نبشی: "angle/angle",
  ناودانی: "channel/sabok",
  "ناودانی سنگین": "channel/sangin",
  "ورق سیاه": "sheet/black",
  "ورق روغنی": "sheet/oiled",
  "ورق ST52": "sheet/st52",
  "ورق آجدار": "sheet/checker",
  "ورق آتشخوار": "sheet/firebox",
  "ورق A516": "sheet/a516",
  "ورق A36": "sheet/a36",
  "ورق گالوانیزه": "sheet/galvanized",
  "ورق A283": "sheet/a283",
  ورقA283: "sheet/a283",
  "ورق شیروانی": "sheet/roof",
  "ورق کرکره": "sheet/roof",
  "ورق کرکره سینوسی": "sheet/roof",
  "ورق CK45": "sheet/ck45",
  "ورق اسیدشویی": "sheet/pickled",
  "ورق ضدسایش": "sheet/wear",
  "ورق عرشه فولادی": "sheet/deck",
  "ورق رنگی": "sheet/color",
  "پروفیل مبلی": "profile/mobli",
  پروفیل: "profile/construction",
  "پروفیل صنعتی": "profile/industrial",
  "پروفیل گالوانیزه": "profile/galvanized",
  "پروفیل زد": "profile/z",
  "پروفیل‌ چهارچوب": "profile/frame",
  "لوله گالوانیزه": "pipe/galvanized",
  "لوله مانیسمان": "pipe/seamless",
  "لوله گاز": "pipe/gas",
  "لوله اسپیرال": "pipe/spiral",
  "لوله API": "pipe/api",
  "لوله جدار چاه": "pipe/casing",
  "لوله آب": "pipe/water",
  "لوله درزدار": "pipe/welded",
  "لوله گلخانه": "pipe/greenhouse",
  "لوله داربستی": "pipe/scaffold",
};

const OFFICIAL_SCOPE_TABLES = {
  "rebar/ribbed": "میلگرد",
  "rebar/plain": "میلگرد ساده",
  "beam/ipe": "تیرآهن",
  "angle/angle": "نبشی",
  "channel/sabok": "ناودانی",
  "channel/sangin": "ناودانی",
  "sheet/black": "ورق سیاه",
  "sheet/oiled": "ورق روغنی",
  "sheet/galvanized": "ورق گالوانیزه",
  "sheet/a283": "ورق آلیاژی",
  "sheet/a36": "ورق آلیاژی",
  "sheet/a516": "ورق آلیاژی",
  "sheet/st52": "ورق آلیاژی",
  "sheet/firebox": "ورق آلیاژی",
  "sheet/ck45": "ورق CK45",
  "sheet/wear": "ورق ضدسایش",
  "sheet/pickled": "ورق اسیدشویی",
  "sheet/checker": "ورق آجدار",
  "sheet/color": "ورق رنگی",
  "sheet/deck": "ورق عرشه فولادی",
  "sheet/roof": "ورق شیروانی",
  "pipe/seamless": "لوله مانیسمان",
};

const EXTRA_BRANDS = {
  "pipe/seamless": ["آرتا", "اهواز", "پاسارگاد", "کاوه", "آسین ابهر", "چین"],
  "pipe/water": ["سپاهان", "سپنتا", "ساوه"],
  "pipe/gas": ["سپاهان", "سپنتا", "ساوه"],
  "pipe/api": ["سپاهان", "سپنتا"],
  "pipe/galvanized": ["سپنتا", "سپاهان", "ساوه"],
  "pipe/casing": ["کالوپ", "تهران شرق", "کیان پرشیا"],
  "pipe/spiral": ["کالوپ", "نیزار"],
  "pipe/welded": ["ساوه"],
  "pipe/scaffold": ["تهران", "اصفهان"],
  "profile/z": ["فولاد مبارکه", "فولاد گیلان"],
};

function normalizeBrandKey(value) {
  return String(value || "")
    .replace(/\u200c/g, " ")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/آ/g, "ا")
    .replace(/أ/g, "ا")
    .replace(/إ/g, "ا")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugPart(value) {
  return String(value || "")
    .replace(/\u200c/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function sizeLabel(row, groupCode) {
  if (groupCode === "sheet" || groupCode === "profile") {
    const mill = String(row.thickness || row.size || "").replace(/میل/g, "").trim();
    return mill;
  }
  if (row.size) return String(row.size).replace(/اینچ/g, "").trim();
  return String(row.thickness || "").trim();
}

function productSku(groupCode, categoryCode, row, index) {
  if (groupCode === "rebar" && categoryCode === "ribbed") {
    const grade = /\bA\s*2\b/i.test(row.kind || row.name) ? "A2" : "A3";
    const size = String(row.size || "").replace(/\D/g, "") || String(index);
    return `RBR-${grade}-${size}`;
  }
  if (groupCode === "rebar" && categoryCode === "plain") {
    return `RBRP-${String(row.size || "").replace(/\D/g, "") || index}`;
  }
  if (groupCode === "beam" && categoryCode === "ipe") {
    return `BEAM-${String(row.size || "").replace(/\D/g, "") || index}`;
  }
  if (groupCode === "beam" && categoryCode === "h") {
    const cluster = /سنگین|heb/i.test(row.name + row.kind) ? "sangin" : "sabok";
    return `HASH-${cluster}-${String(row.size || "").replace(/\D/g, "") || index}`;
  }
  if (groupCode === "channel") {
    return `CHN-${categoryCode}-${String(row.size || "").replace(/\D/g, "") || index}`;
  }
  const parts = ["FP", groupCode, categoryCode, slugPart(row.size || row.thickness), slugPart(row.kind), slugPart(row.dimensions), slugPart(row.name).slice(-28), String(index)];
  return parts.filter(Boolean).join("-").slice(0, 140);
}

function rowBrands(scopeKey, row) {
  const fromScope = [...(brandsByScope[scopeKey]?.values() ?? [])];
  if (scopeKey === "profile/z") {
    const kind = String(row.kind || "");
    if (/گیلان/.test(kind)) return ["فولاد گیلان"];
    if (/مبارکه/.test(kind)) return ["فولاد مبارکه"];
  }
  return fromScope;
}

const excel = JSON.parse(readFileSync(excelPath, "utf8"));
const official = JSON.parse(readFileSync(officialPath, "utf8"));
const officialByTable = new Map((official.tables ?? []).map((table) => [table.name, table.rows ?? []]));

/** @type {Record<string, Map<string, string>>} */
const brandsByScope = {};

function addBrand(scopeKey, brandName) {
  const name = String(brandName || "").trim();
  if (!name) return;
  if (!brandsByScope[scopeKey]) brandsByScope[scopeKey] = new Map();
  if ([...brandsByScope[scopeKey].values()].includes(name)) return;
  const [groupCode, categoryCode] = scopeKey.split("/");
  const idBase = normalizeBrandKey(name).replace(/\s+/g, "-") || `brand-${brandsByScope[scopeKey].size + 1}`;
  brandsByScope[scopeKey].set(`${groupCode}-${categoryCode}-${idBase}`, name);
}

for (const [scopeKey, tableName] of Object.entries(OFFICIAL_SCOPE_TABLES)) {
  for (const row of officialByTable.get(tableName) ?? []) addBrand(scopeKey, row.brandName);
}
for (const [scopeKey, names] of Object.entries(EXTRA_BRANDS)) {
  for (const name of names) addBrand(scopeKey, name);
}

const catalog = [];
const seenSku = new Set();
const unknownCategories = {};

excel.forEach((row, index) => {
  const category = String(row.category || "").trim();
  const scope = CATEGORY_SCOPE[category];
  if (!scope) {
    unknownCategories[category] = (unknownCategories[category] || 0) + 1;
    return;
  }
  const [groupCode, categoryCode] = scope.split("/");
  let sku = productSku(groupCode, categoryCode, row, index + 1);
  let n = 2;
  while (seenSku.has(sku)) {
    sku = `${productSku(groupCode, categoryCode, row, index + 1)}-${n}`;
    n += 1;
  }
  seenSku.add(sku);
  catalog.push({
    sku,
    name: String(row.name || "").trim(),
    groupCode,
    categoryCode,
    brandNames: rowBrands(scope, row),
    sizeLabel: sizeLabel(row, groupCode),
    row: index + 1,
  });
});

const brandsJson = {};
for (const [scopeKey, map] of Object.entries(brandsByScope)) {
  brandsJson[scopeKey] = [...map.entries()].map(([id, name]) => ({ id, name }));
}

const byScope = {};
for (const item of catalog) {
  const key = `${item.groupCode}/${item.categoryCode}`;
  byScope[key] = (byScope[key] || 0) + 1;
}

writeFileSync(productsOut, `${JSON.stringify(catalog, null, 2)}\n`);
writeFileSync(brandsOut, `${JSON.stringify(brandsJson, null, 2)}\n`);
mkdirSync(dirname(reportOut), { recursive: true });
const report = {
  generatedAt: new Date().toISOString(),
  source: "data/products/Final Product.xlsx",
  excelRows: excel.length,
  catalog: catalog.length,
  uniqueSkus: seenSku.size,
  missing: excel.length - catalog.length,
  unknownCategories,
  byScope,
};
writeFileSync(reportOut, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (catalog.length !== excel.length) {
  console.error("catalog does not match Final Product row count");
  process.exit(1);
}
