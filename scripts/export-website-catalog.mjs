#!/usr/bin/env node
/**
 * Export active Website products (sku = source of truth) from MongoDB.
 *
 * Usage:
 *   MONGODB_URI=mongodb://127.0.0.1:27017/petrofoulad node scripts/export-website-catalog.mjs
 *   MONGODB_URI=... node scripts/export-website-catalog.mjs --out data/website-sku-catalog.prod.json
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outArg = process.argv.find((a) => a.startsWith("--out="));
const outPath = resolve(root, outArg?.slice(6) || "data/website-sku-catalog.prod.json");
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/petrofoulad";

const script = `
const db = db.getSiblingDB(new URL(${JSON.stringify(mongoUri)}).pathname.replace(/^\\//, "") || "petrofoulad");
const categories = db.productcategories.find({}, { titleFa: 1, slug: 1 }).toArray();
const catById = Object.fromEntries(categories.map((c) => [String(c._id), c]));
const brands = db.brands.find({}, { titleFa: 1, officialNameFa: 1 }).toArray();
const brandById = Object.fromEntries(brands.map((b) => [String(b._id), b]));
const products = db.products.find({}, { sku: 1, name: 1, isActive: 1, categoryId: 1, brandId: 1, brandIds: 1 }).toArray();
const rows = [];
for (const p of products) {
  const sku = String(p.sku || "").trim();
  if (!sku) continue;
  const cat = catById[String(p.categoryId)] || {};
  const brandId = p.brandId || (Array.isArray(p.brandIds) ? p.brandIds[0] : null);
  const brand = brandId ? brandById[String(brandId)] : null;
  rows.push({
    sku,
    name: String(p.name || "").trim(),
    isActive: p.isActive !== false,
    brandName: brand ? String(brand.titleFa || brand.officialNameFa || "").trim() : "",
    brandOfficial: brand ? String(brand.officialNameFa || "").trim() : "",
    categoryName: String(cat.titleFa || "").trim(),
    categorySlug: String(cat.slug || "").trim(),
  });
}
print(JSON.stringify({ exportedAt: new Date().toISOString(), mongoUri: ${JSON.stringify(mongoUri)}, products: rows }));
`.trim();

let raw;
try {
  raw = execFileSync("mongosh", [mongoUri, "--quiet", "--eval", script], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (error) {
  console.error("mongosh export failed:", error.message);
  process.exit(1);
}

const payload = JSON.parse(raw.trim());
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
const active = payload.products.filter((p) => p.isActive !== false);
console.log(
  JSON.stringify(
    {
      outPath,
      total: payload.products.length,
      active: active.length,
      inactive: payload.products.length - active.length,
      exportedAt: payload.exportedAt,
    },
    null,
    2,
  ),
);
