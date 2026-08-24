#!/usr/bin/env node
/**
 * Remove price-system rows whose product_code is not an active Website SKU.
 * Also removes legacy compositional codes (RBR-A3-14, etc.).
 *
 * Usage (production):
 *   DATABASE_URL=postgres://... node scripts/purge-non-website-prices.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const websitePath = resolve(root, "data/website-sku-catalog.prod.json");
const exportDir = resolve(root, "data/exports");

const website = JSON.parse(readFileSync(websitePath, "utf8"));
const allowed = new Set(
  (website.products || [])
    .filter((p) => p?.sku && p.isActive !== false)
    .map((p) => String(p.sku).trim()),
);

function isCompositionalLegacy(code) {
  const c = String(code || "").trim();
  if (/^RBR-A[23]-\d+$/.test(c)) return true;
  if (/^RBRP-\d+$/.test(c) && !/^RBRP-\d{6}$/.test(c)) return true;
  return false;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    const dryRun = {
      generatedAt: new Date().toISOString(),
      mode: "dry-run",
      allowedActiveSkus: allowed.size,
      note: "Set DATABASE_URL to purge ops_daily_prices on server.",
    };
    mkdirSync(exportDir, { recursive: true });
    writeFileSync(resolve(exportDir, "purge-non-website-prices.json"), `${JSON.stringify(dryRun, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(dryRun, null, 2));
    return;
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT price_date, product_code, brand_id, brand_name
       FROM ops_daily_prices
       ORDER BY price_date DESC, product_code, brand_name`,
    );

    const toDelete = rows.filter((r) => !allowed.has(String(r.product_code).trim()) || isCompositionalLegacy(r.product_code));
    const samples = toDelete.slice(0, 50).map((r) => ({
      price_date: r.price_date,
      product_code: r.product_code,
      brand_name: r.brand_name,
      reason: !allowed.has(String(r.product_code).trim()) ? "not_on_website" : "compositional_legacy",
    }));

    let deleted = 0;
    await client.query("BEGIN");
    for (const row of toDelete) {
      const result = await client.query(
        `DELETE FROM ops_daily_prices
         WHERE price_date = $1 AND product_code = $2 AND COALESCE(brand_id,'') = COALESCE($3,'')`,
        [row.price_date, row.product_code, row.brand_id],
      );
      deleted += result.rowCount ?? 0;
    }
    await client.query("COMMIT");

    const left = await client.query("SELECT count(*)::int AS n FROM ops_daily_prices");
    const remainingRows = await client.query("SELECT product_code FROM ops_daily_prices");
    /** @type {Map<string, number>} */
    const invalidCounts = new Map();
    for (const row of remainingRows.rows) {
      const code = String(row.product_code).trim();
      if (allowed.has(code) && !isCompositionalLegacy(code)) continue;
      invalidCounts.set(code, (invalidCounts.get(code) ?? 0) + 1);
    }
    const invalidCodesRemaining = [...invalidCounts.entries()]
      .map(([product_code, n]) => ({ product_code, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 20);

    const payload = {
      generatedAt: new Date().toISOString(),
      mode: "purge",
      allowedActiveSkus: allowed.size,
      scanned: rows.length,
      deleted,
      remaining: left.rows[0]?.n ?? 0,
      invalidCodesRemaining,
      deletedSamples: samples,
    };

    mkdirSync(exportDir, { recursive: true });
    writeFileSync(resolve(exportDir, "purge-non-website-prices.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(payload, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
