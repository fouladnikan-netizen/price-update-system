#!/usr/bin/env node
/**
 * Align price-system catalog with Website (Website = source of truth).
 *
 * 1. Compare Website export vs price-system catalog
 * 2. Regenerate category-products.json + category-brands.generated.json
 * 3. Write alignment report + side-by-side exports
 * 4. Optionally purge ops_daily_prices not on Website (--purge)
 *
 * Usage:
 *   node scripts/align-with-website.mjs
 *   node scripts/align-with-website.mjs --purge
 *   MONGODB_URI=... node scripts/align-with-website.mjs --refresh-website
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const websitePath = resolve(root, "data/website-sku-catalog.prod.json");
const productsPath = resolve(root, "apps/web/src/mock/category-products.json");
const exportDir = resolve(root, "data/exports");
const reportPath = resolve(exportDir, "catalog-alignment-report.json");

const refreshWebsite = process.argv.includes("--refresh-website");
const purge = process.argv.includes("--purge");

if (refreshWebsite) {
  execFileSync("node", ["scripts/export-website-catalog.mjs"], { cwd: root, stdio: "inherit" });
}

execFileSync("node", ["scripts/sync-catalog-from-website.mjs"], { cwd: root, stdio: "inherit" });
execFileSync("node", ["scripts/export-price-system-catalog.mjs"], { cwd: root, stdio: "inherit" });

const website = JSON.parse(readFileSync(websitePath, "utf8"));
const price = JSON.parse(readFileSync(productsPath, "utf8"));

const wsProducts = Array.isArray(website.products) ? website.products : [];
const active = wsProducts.filter((p) => p?.sku && p.isActive !== false);
const inactive = wsProducts.filter((p) => p?.sku && p.isActive === false);
const activeSkus = new Set(active.map((p) => String(p.sku).trim()));
const priceSkus = new Set(price.map((p) => String(p.sku).trim()));

const onlyWebsiteActive = [...activeSkus].filter((s) => !priceSkus.has(s)).sort();
const onlyPrice = [...priceSkus].filter((s) => !activeSkus.has(s)).sort();
const matched = [...activeSkus].filter((s) => priceSkus.has(s)).sort();
const inactiveSkus = inactive.map((p) => p.sku).sort();

mkdirSync(exportDir, { recursive: true });
copyFileSync(websitePath, resolve(exportDir, "website-catalog.json"));

/** @type {Record<string, string[]>} */
const invalidDailyPriceSamples = {};
let purgeResult = null;

if (purge) {
  execFileSync("node", ["scripts/purge-non-website-prices.mjs"], { cwd: root, stdio: "inherit" });
  try {
    purgeResult = JSON.parse(readFileSync(resolve(exportDir, "purge-non-website-prices.json"), "utf8"));
  } catch {
    purgeResult = { note: "purge ran but result file missing" };
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  sourceOfTruth: "website",
  website: {
    exportedAt: website.exportedAt ?? null,
    total: wsProducts.length,
    active: active.length,
    inactive: inactive.length,
    exportPath: "data/exports/website-catalog.json",
  },
  priceSystem: {
    catalogCount: price.length,
    uniqueSkus: priceSkus.size,
    exportPath: "data/exports/price-system-catalog.json",
  },
  alignment: {
    matchedActiveSkus: matched.length,
    onlyWebsiteActive,
    onlyPriceSystem: onlyPrice,
    inactiveWebsiteSkusExcluded: inactiveSkus,
    isFullyAligned: onlyWebsiteActive.length === 0 && onlyPrice.length === 0,
  },
  purge: purgeResult,
  invalidDailyPriceSamples,
};

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      reportPath,
      matchedActiveSkus: matched.length,
      onlyWebsiteActive: onlyWebsiteActive.length,
      onlyPriceSystem: onlyPrice.length,
      inactiveExcluded: inactiveSkus.length,
      fullyAligned: report.alignment.isFullyAligned,
      purged: Boolean(purgeResult),
    },
    null,
    2,
  ),
);

if (!report.alignment.isFullyAligned) {
  process.exitCode = 1;
}
