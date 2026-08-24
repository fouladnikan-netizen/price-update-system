#!/usr/bin/env node
/**
 * Export price-system catalog + optional PostgreSQL daily prices summary.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "data/exports");
const productsPath = resolve(root, "apps/web/src/mock/category-products.json");
const brandsPath = resolve(root, "apps/web/src/mock/category-brands.generated.json");

const products = JSON.parse(readFileSync(productsPath, "utf8"));
const brands = JSON.parse(readFileSync(brandsPath, "utf8"));

/** @type {Record<string, unknown>} */
const exportPayload = {
  exportedAt: new Date().toISOString(),
  source: "apps/web/src/mock/category-products.json",
  products: products.map((p) => ({
    sku: p.sku,
    name: p.name,
    groupCode: p.groupCode,
    categoryCode: p.categoryCode,
    brandNames: p.brandNames,
    sizeLabel: p.sizeLabel,
  })),
  brandScopes: brands,
  skuCount: products.length,
  uniqueSkus: new Set(products.map((p) => p.sku)).size,
};

mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "price-system-catalog.json");
writeFileSync(outPath, `${JSON.stringify(exportPayload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outPath, skuCount: exportPayload.skuCount, uniqueSkus: exportPayload.uniqueSkus }, null, 2));
