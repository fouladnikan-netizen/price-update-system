#!/usr/bin/env node
/**
 * Human-checkable product lists: price-system catalog, Excel final file, gaps.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "data/exports");
mkdirSync(outDir, { recursive: true });

const products = JSON.parse(readFileSync(resolve(root, "apps/web/src/mock/category-products.json"), "utf8"));
const brands = JSON.parse(readFileSync(resolve(root, "apps/web/src/mock/category-brands.generated.json"), "utf8"));
const excel = JSON.parse(readFileSync(resolve(root, "apps/web/src/mock/excel-catalog-rows.json"), "utf8"));
const website = JSON.parse(readFileSync(resolve(root, "data/website-sku-catalog.prod.json"), "utf8"));
const groups = [
  ["rebar", "ribbed", "میلگرد", "میلگرد آجدار"],
  ["rebar", "plain", "میلگرد", "میلگرد ساده"],
  ["beam", "ipe", "تیرآهن", "تیرآهن IPE"],
  ["beam", "h", "تیرآهن", "تیرآهن هاش"],
  ["sheet", "black", "ورق", "ورق سیاه"],
  ["sheet", "oiled", "ورق", "ورق روغنی"],
  ["sheet", "st52", "ورق", "ورق ST52"],
  ["sheet", "checker", "ورق", "ورق آجدار"],
  ["sheet", "firebox", "ورق", "ورق آتشخوار"],
  ["sheet", "a516", "ورق", "ورق A516"],
  ["sheet", "a36", "ورق", "ورق A36"],
  ["sheet", "galvanized", "ورق", "ورق گالوانیزه"],
  ["sheet", "a283", "ورق", "ورق A283"],
  ["sheet", "roof", "ورق", "ورق شیروانی"],
  ["sheet", "ck45", "ورق", "ورق CK45"],
  ["sheet", "pickled", "ورق", "ورق اسیدشویی"],
  ["sheet", "wear", "ورق", "ورق ضدسایش"],
  ["sheet", "deck", "ورق", "ورق عرشه فولادی"],
  ["sheet", "color", "ورق", "ورق رنگی"],
  ["angle", "angle", "نبشی", "نبشی"],
  ["channel", "sabok", "ناودانی", "ناودانی سبک"],
  ["channel", "sangin", "ناودانی", "ناودانی سنگین"],
  ["profile", "mobli", "پروفیل", "پروفیل مبلی"],
  ["profile", "construction", "پروفیل", "پروفیل ساختمانی"],
  ["profile", "industrial", "پروفیل", "پروفیل صنعتی"],
  ["profile", "galvanized", "پروفیل", "پروفیل گالوانیزه"],
  ["profile", "z", "پروفیل", "پروفیل زد"],
  ["profile", "frame", "پروفیل", "پروفیل چارچوب"],
  ["pipe", "galvanized", "لوله", "لوله گالوانیزه"],
  ["pipe", "seamless", "لوله", "لوله مانیسمان"],
  ["pipe", "gas", "لوله", "لوله تست گاز"],
  ["pipe", "spiral", "لوله", "لوله اسپیرال"],
  ["pipe", "api", "لوله", "لوله API"],
  ["pipe", "casing", "لوله", "لوله جدار چاه"],
  ["pipe", "water", "لوله", "لوله تست آب"],
  ["pipe", "welded", "لوله", "لوله درزدار"],
  ["pipe", "greenhouse", "لوله", "لوله گلخانه‌ای"],
  ["pipe", "scaffold", "لوله", "لوله داربستی"],
];
const labelByScope = Object.fromEntries(groups.map(([g, c, gn, cn]) => [`${g}/${c}`, { groupFa: gn, categoryFa: cn }]));
const excelCategoryToScope = {
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

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function writeCsv(fileName, headers, rows) {
  const lines = [headers.join(","), ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(","))];
  const path = resolve(outDir, fileName);
  writeFileSync(path, `\uFEFF${lines.join("\n")}\n`, "utf8");
  return path;
}

const priceRows = products.map((p) => {
  const label = labelByScope[`${p.groupCode}/${p.categoryCode}`] ?? { groupFa: p.groupCode, categoryFa: p.categoryCode };
  return {
    group: label.groupFa,
    category: label.categoryFa,
    sku: p.sku,
    name: p.name,
    brands: (p.brandNames ?? []).join(" | "),
    size: p.sizeLabel ?? "",
    groupCode: p.groupCode,
    categoryCode: p.categoryCode,
  };
});
priceRows.sort((a, b) => a.group.localeCompare(b.group, "fa") || a.category.localeCompare(b.category, "fa") || a.name.localeCompare(b.name, "fa"));

const excelRows = excel.map((row) => ({
  excelCategory: row.category,
  name: row.name,
  kind: row.kind ?? "",
  size: row.size ?? "",
  dimensions: row.dimensions ?? "",
  pipeClass: row.pipeClass ?? "",
  thickness: row.thickness ?? "",
  mappedScope: excelCategoryToScope[row.category] ?? "",
}));

const websiteActive = (website.products ?? []).filter((p) => p && p.sku && p.isActive !== false);
const websiteBySlug = {};
for (const p of websiteActive) {
  const slug = p.categorySlug || "?";
  websiteBySlug[slug] = (websiteBySlug[slug] || 0) + 1;
}

const byScope = {};
for (const p of products) {
  const key = `${p.groupCode}/${p.categoryCode}`;
  byScope[key] = (byScope[key] || 0) + 1;
}
const excelByCategory = {};
for (const row of excel) excelByCategory[row.category] = (excelByCategory[row.category] || 0) + 1;

const disputed = [
  { nameFa: "میلگرد ساده", scope: "rebar/plain", websiteSlug: "rebar-sadeh", excelCategory: "میلگرد ساده" },
  { nameFa: "لوله مانیسمان", scope: "pipe/seamless", websiteSlug: "lule-maniseman", excelCategory: "لوله مانیسمان" },
  { nameFa: "لوله اسپیرال", scope: "pipe/spiral", websiteSlug: "lule-espiral", excelCategory: "لوله اسپیرال" },
  { nameFa: "لوله جدار چاه", scope: "pipe/casing", websiteSlug: "lule-jedar-chah", excelCategory: "لوله جدار چاه" },
  { nameFa: "میلگرد کلاف", scope: null, websiteSlug: "rebar-klaf", excelCategory: null, excluded: true },
  { nameFa: "میلگرد بستر", scope: null, websiteSlug: "rebar-baster", excelCategory: null, excluded: true },
  { nameFa: "لوله صنعتی", scope: null, websiteSlug: "lule-sanati", excelCategory: null, excluded: true },
];

const gap = disputed.map((item) => ({
  ...item,
  priceSystemCount: item.scope ? byScope[item.scope] || 0 : 0,
  websiteCount: websiteBySlug[item.websiteSlug] || 0,
  excelCount: item.excelCategory ? excelByCategory[item.excelCategory] || 0 : 0,
  brands: item.scope ? (brands[item.scope] ?? []).map((b) => b.name) : [],
}));

const summary = groups.map(([groupCode, categoryCode, groupFa, categoryFa]) => ({
  groupFa,
  categoryFa,
  groupCode,
  categoryCode,
  priceSystemCount: byScope[`${groupCode}/${categoryCode}`] || 0,
  brandCount: (brands[`${groupCode}/${categoryCode}`] ?? []).length,
}));

const checklistPath = writeCsv(
  "product-checklist.csv",
  ["group", "category", "sku", "name", "brands", "size", "groupCode", "categoryCode"],
  priceRows,
);
const excelPath = writeCsv(
  "excel-product-list.csv",
  ["excelCategory", "name", "kind", "size", "dimensions", "pipeClass", "thickness", "mappedScope"],
  excelRows,
);
const reportPath = resolve(outDir, "product-gap-report.json");
writeFileSync(
  reportPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      priceSystemCount: products.length,
      excelCount: excel.length,
      websiteActiveCount: websiteActive.length,
      files: { checklistPath, excelPath },
      disputed: gap,
      byUiCategory: summary,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(
  JSON.stringify(
    {
      checklistPath,
      excelPath,
      reportPath,
      priceSystemCount: products.length,
      excelCount: excel.length,
      disputed: gap.map((item) => ({
        nameFa: item.nameFa,
        priceSystem: item.priceSystemCount,
        website: item.websiteCount,
        excel: item.excelCount,
        excluded: Boolean(item.excluded),
      })),
    },
    null,
    2,
  ),
);
