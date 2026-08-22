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

/** @type {Record<string, { groupCode: string, categoryCode: string }>} */
const SLUG_MAP = {
  rebar: { groupCode: "rebar", categoryCode: "ribbed" },
  nabshi: { groupCode: "angle", categoryCode: "angle" },
  navodani: { groupCode: "channel", categoryCode: "sabok" },
  tirahan: { groupCode: "beam", categoryCode: "ipe" },
  hash: { groupCode: "beam", categoryCode: "h" },
  "profil-sakhtamani": { groupCode: "profile", categoryCode: "construction" },
  "profil-sanati": { groupCode: "profile", categoryCode: "industrial" },
  "profil-sabok": { groupCode: "profile", categoryCode: "mobli" },
  "lule-gaz": { groupCode: "pipe", categoryCode: "gas" },
  "lule-galvanize": { groupCode: "pipe", categoryCode: "galvanized" },
  "lule-maniseman": { groupCode: "pipe", categoryCode: "seamless" },
  "lule-golkhaneh": { groupCode: "pipe", categoryCode: "greenhouse" },
  "lule-api": { groupCode: "pipe", categoryCode: "api" },
  "lule-testab": { groupCode: "pipe", categoryCode: "water" },
  "lule-darzdar": { groupCode: "pipe", categoryCode: "welded" },
  "lule-sanati": { groupCode: "pipe", categoryCode: "welded" },
  "lule-espiral": { groupCode: "pipe", categoryCode: "spiral" },
  "varaq-siah": { groupCode: "sheet", categoryCode: "black" },
  "varaq-galvanize": { groupCode: "sheet", categoryCode: "galvanized" },
  "varaq-roghani": { groupCode: "sheet", categoryCode: "oiled" },
  "varaq-st52": { groupCode: "sheet", categoryCode: "st52" },
  "varaq-zad-sayesh": { groupCode: "sheet", categoryCode: "wear" },
  "varaq-asid-shuyi": { groupCode: "sheet", categoryCode: "pickled" },
  "varaq-a283": { groupCode: "sheet", categoryCode: "a36" },
  "varaq-a516": { groupCode: "sheet", categoryCode: "a516" },
  "varaq-arshe": { groupCode: "sheet", categoryCode: "deck" },
  "varaq-shirvani": { groupCode: "sheet", categoryCode: "roof" },
  "varaq-rangi": { groupCode: "sheet", categoryCode: "color" },
  "cat-sheet-cold": { groupCode: "sheet", categoryCode: "black" },
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
  if (slug && SLUG_MAP[slug]) {
    const mapped = { ...SLUG_MAP[slug] };
    if (mapped.groupCode === "rebar") {
      const { grade } = parseRebarMeta(product.name);
      if (grade === "PLAIN") mapped.categoryCode = "plain";
      else mapped.categoryCode = "ribbed";
    }
    if (mapped.groupCode === "channel") {
      if (/سنگین/.test(product.name)) mapped.categoryCode = "sangin";
      else if (/سبک/.test(product.name)) mapped.categoryCode = "sabok";
    }
    return mapped;
  }
  const cat = String(product.categoryName || "");
  if (/میلگرد/.test(cat)) {
    const { grade } = parseRebarMeta(product.name);
    return { groupCode: "rebar", categoryCode: grade === "PLAIN" ? "plain" : "ribbed" };
  }
  if (/نبشی/.test(cat)) return { groupCode: "angle", categoryCode: "angle" };
  if (/ناودانی/.test(cat)) {
    return { groupCode: "channel", categoryCode: /سنگین/.test(product.name) ? "sangin" : "sabok" };
  }
  if (/هاش/.test(cat)) return { groupCode: "beam", categoryCode: "h" };
  if (/تیرآهن/.test(cat)) return { groupCode: "beam", categoryCode: "ipe" };
  if (/پروفیل/.test(cat)) return { groupCode: "profile", categoryCode: "construction" };
  if (/لوله/.test(cat)) return { groupCode: "pipe", categoryCode: "welded" };
  if (/ورق/.test(cat)) return { groupCode: "sheet", categoryCode: "black" };
  return { groupCode: "sheet", categoryCode: "black" };
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

let row = 1;
for (const product of active) {
  const scope = mapScope(product);
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

const byGroup = {};
for (const item of catalog) byGroup[item.groupCode] = (byGroup[item.groupCode] || 0) + 1;
console.log(
  JSON.stringify(
    {
      input: source.length,
      active: active.length,
      catalog: catalog.length,
      byGroup,
      brandScopes: Object.keys(brandsJson).length,
      remapKeys: Object.keys(remapObj).length,
    },
    null,
    2,
  ),
);
