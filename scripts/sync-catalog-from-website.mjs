#!/usr/bin/env node
/**
 * Rebuild price-system catalog from Website production SKUs (source of truth).
 *
 * Input:  data/website-sku-catalog.prod.json
 * Output: apps/web/src/mock/category-products.json
 *         apps/web/src/mock/category-brands.generated.json
 *         data/sku-remap-from-compositional.json (old RBR-A3-XX → website SKUs by brand)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = resolve(root, "data/website-sku-catalog.prod.json");
const productsOut = resolve(root, "apps/web/src/mock/category-products.json");
const brandsOut = resolve(root, "apps/web/src/mock/category-brands.generated.json");
const remapOut = resolve(root, "data/sku-remap-from-compositional.json");
const officialBrandsPath = resolve(root, "apps/web/src/mock/brand-official-tables.json");
const reportOut = resolve(root, "data/exports/catalog-sync-report.json");

/** Operator: not in the price catalog until products are defined on Website. */
const EXCLUDE_SLUGS = new Set(["rebar-klaf", "rebar-baster", "lule-sanati"]);

/** @type {Record<string, { groupCode: string, categoryCode: string }>} */
const SLUG_MAP = {
  rebar: { groupCode: "rebar", categoryCode: "ribbed" },
  "rebar-sadeh": { groupCode: "rebar", categoryCode: "plain" },
  nabshi: { groupCode: "angle", categoryCode: "angle" },
  navodani: { groupCode: "channel", categoryCode: "sabok" },
  tirahan: { groupCode: "beam", categoryCode: "ipe" },
  hash: { groupCode: "beam", categoryCode: "h" },
  "profil-sakhtamani": { groupCode: "profile", categoryCode: "construction" },
  "profil-sanati": { groupCode: "profile", categoryCode: "industrial" },
  "profil-sabok": { groupCode: "profile", categoryCode: "mobli" },
  "profil-galvanize": { groupCode: "profile", categoryCode: "galvanized" },
  "profil-z": { groupCode: "profile", categoryCode: "z" },
  "profil-charchoob": { groupCode: "profile", categoryCode: "frame" },
  "lule-gaz": { groupCode: "pipe", categoryCode: "gas" },
  "lule-galvanize": { groupCode: "pipe", categoryCode: "galvanized" },
  "lule-maniseman": { groupCode: "pipe", categoryCode: "seamless" },
  "lule-golkhaneh": { groupCode: "pipe", categoryCode: "greenhouse" },
  "lule-api": { groupCode: "pipe", categoryCode: "api" },
  "lule-testab": { groupCode: "pipe", categoryCode: "water" },
  "lule-darzdar": { groupCode: "pipe", categoryCode: "welded" },
  "lule-espiral": { groupCode: "pipe", categoryCode: "spiral" },
  "lule-jedar-chah": { groupCode: "pipe", categoryCode: "casing" },
  "lule-darbasti": { groupCode: "pipe", categoryCode: "scaffold" },
  "varaq-siah": { groupCode: "sheet", categoryCode: "black" },
  "varaq-galvanize": { groupCode: "sheet", categoryCode: "galvanized" },
  "varaq-roghani": { groupCode: "sheet", categoryCode: "oiled" },
  "varaq-st52": { groupCode: "sheet", categoryCode: "st52" },
  "varaq-zad-sayesh": { groupCode: "sheet", categoryCode: "wear" },
  "varaq-asid-shuyi": { groupCode: "sheet", categoryCode: "pickled" },
  "varaq-a283": { groupCode: "sheet", categoryCode: "a283" },
  "varaq-a516": { groupCode: "sheet", categoryCode: "a516" },
  "varaq-arshe": { groupCode: "sheet", categoryCode: "deck" },
  "varaq-shirvani": { groupCode: "sheet", categoryCode: "roof" },
  "varaq-rangi": { groupCode: "sheet", categoryCode: "color" },
  "varaq-ajdar": { groupCode: "sheet", categoryCode: "checker" },
  "varaq-ck45": { groupCode: "sheet", categoryCode: "ck45" },
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

function parseRebarMeta(name) {
  const n = String(name || "");
  let grade = null;
  if (/ساده/.test(n)) grade = "PLAIN";
  else if (/A\s*2/i.test(n)) grade = "A2";
  else if (/A\s*3|آجدار/i.test(n)) grade = "A3";
  const sizeMatch = n.match(/سایز\s*(\d+)/);
  const sizeLabel = sizeMatch ? sizeMatch[1] : "";
  return { grade, sizeLabel };
}

function parseSizeLabel(name, groupCode) {
  const n = String(name || "");
  if (groupCode === "rebar") return parseRebarMeta(n).sizeLabel;
  const m =
    n.match(/سایز\s*([0-9./]+)/) ||
    n.match(/ضخامت\s*([0-9./]+)/) ||
    n.match(/\b(\d+(?:[./]\d+)?)\s*میل/) ||
    n.match(/\b(\d+)\b/);
  return m ? m[1] : "";
}

function mapScope(product) {
  const slug = String(product.categorySlug || "").trim();
  if (EXCLUDE_SLUGS.has(slug) || slug.startsWith("cat-")) return null;
  if (slug && SLUG_MAP[slug]) {
    const mapped = { ...SLUG_MAP[slug] };
    if (slug === "rebar") {
      const { grade } = parseRebarMeta(product.name);
      mapped.categoryCode = grade === "PLAIN" ? "plain" : "ribbed";
    }
    if (mapped.groupCode === "channel") {
      if (/سنگین/.test(product.name)) mapped.categoryCode = "sangin";
      else if (/سبک/.test(product.name)) mapped.categoryCode = "sabok";
    }
    return mapped;
  }
  return null;
}

const raw = JSON.parse(readFileSync(inputPath, "utf8"));
const source = Array.isArray(raw.products) ? raw.products : [];
const active = source.filter((p) => p && p.sku && p.isActive !== false);

/** @type {any[]} */
const catalog = [];
/** @type {Record<string, Map<string, string>>} */
const brandsByScope = {};
/** @type {Record<string, string[]>} */
const remap = {};

/** @type {any[]} */
const skipped = [];
let row = 1;
for (const product of active) {
  const scope = mapScope(product);
  if (!scope) {
    skipped.push({
      sku: String(product.sku || "").trim(),
      name: String(product.name || "").trim(),
      categorySlug: String(product.categorySlug || "").trim(),
      categoryName: String(product.categoryName || "").trim(),
      brandName: String(product.brandName || "").trim(),
      reason: EXCLUDE_SLUGS.has(String(product.categorySlug || "").trim())
        ? "excluded"
        : String(product.categorySlug || "").startsWith("cat-")
          ? "non-construction"
          : "unmapped",
    });
    continue;
  }
  const sizeLabel = parseSizeLabel(product.name, scope.groupCode);
  const brandName = String(product.brandName || "").trim();
  const brandNames = brandName ? [brandName] : [];
  catalog.push({
    sku: String(product.sku).trim(),
    name: String(product.name || "").trim(),
    groupCode: scope.groupCode,
    categoryCode: scope.categoryCode,
    brandNames,
    sizeLabel,
    row: row++,
  });

  const scopeKey = `${scope.groupCode}/${scope.categoryCode}`;
  if (!brandsByScope[scopeKey]) brandsByScope[scopeKey] = new Map();
  if (brandName) {
    const idBase = normalizeBrandKey(brandName).replace(/\s+/g, "-") || `brand-${row}`;
    if (![...brandsByScope[scopeKey].values()].includes(brandName)) {
      brandsByScope[scopeKey].set(`${scope.groupCode}-${scope.categoryCode}-${idBase}`, brandName);
    }
  }

  if (scope.groupCode === "rebar" && brandName) {
    const { grade, sizeLabel: size } = parseRebarMeta(product.name);
    if (grade && grade !== "PLAIN" && size) {
      const compositional = `RBR-${grade}-${size}`;
      if (!remap[compositional]) remap[compositional] = [];
      remap[compositional].push(
        JSON.stringify({
          websiteSku: product.sku,
          brandName,
          brandKey: normalizeBrandKey(brandName),
        }),
      );
    }
  }
}

// dedupe remap entries
const remapObj = {};
for (const [code, entries] of Object.entries(remap)) {
  const seen = new Set();
  remapObj[code] = [];
  for (const rawEntry of entries) {
    if (seen.has(rawEntry)) continue;
    seen.add(rawEntry);
    remapObj[code].push(JSON.parse(rawEntry));
  }
}

/** Official brand file fills scopes that exist in Brand.numbers but have no Website SKU yet. */
const officialTables = JSON.parse(readFileSync(officialBrandsPath, "utf8"));
const officialByTable = new Map((officialTables.tables ?? []).map((table) => [table.name, table.rows ?? []]));
const OFFICIAL_SCOPE_TABLES = {
  "rebar/plain": "میلگرد ساده",
};
for (const [scopeKey, tableName] of Object.entries(OFFICIAL_SCOPE_TABLES)) {
  const [groupCode, categoryCode] = scopeKey.split("/");
  if (!brandsByScope[scopeKey]) brandsByScope[scopeKey] = new Map();
  const existing = new Set(brandsByScope[scopeKey].values());
  for (const row of officialByTable.get(tableName) ?? []) {
    const brandName = String(row.brandName || "").trim();
    if (!brandName || existing.has(brandName)) continue;
    const idBase = normalizeBrandKey(brandName).replace(/\s+/g, "-") || `brand-${brandName}`;
    brandsByScope[scopeKey].set(`${groupCode}-${categoryCode}-${idBase}`, brandName);
    existing.add(brandName);
  }
}

/** @type {Record<string, { id: string, name: string }[]>} */
const brandsJson = {};
for (const [scopeKey, map] of Object.entries(brandsByScope)) {
  brandsJson[scopeKey] = [...map.entries()].map(([id, name]) => ({ id, name }));
}

writeFileSync(productsOut, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
writeFileSync(brandsOut, `${JSON.stringify(brandsJson, null, 2)}\n`, "utf8");
writeFileSync(
  remapOut,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), compositionalToWebsite: remapObj }, null, 2)}\n`,
  "utf8",
);

const byScope = {};
for (const item of catalog) {
  const key = `${item.groupCode}/${item.categoryCode}`;
  byScope[key] = (byScope[key] || 0) + 1;
}
const skippedByReason = {};
for (const item of skipped) skippedByReason[item.reason] = (skippedByReason[item.reason] || 0) + 1;
writeFileSync(
  reportOut,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      input: source.length,
      active: active.length,
      catalog: catalog.length,
      skipped: skipped.length,
      byScope,
      skippedByReason,
      skipped,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
console.log(
  JSON.stringify(
    {
      input: source.length,
      active: active.length,
      catalog: catalog.length,
      skipped: skipped.length,
      skippedByReason,
      byScope,
      brandScopes: Object.keys(brandsJson).length,
      remapKeys: Object.keys(remapObj).length,
      report: reportOut,
    },
    null,
    2,
  ),
);
