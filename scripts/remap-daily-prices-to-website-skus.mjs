#!/usr/bin/env node
/**
 * Remap ops_daily_prices product_code from compositional (RBR-A3-14)
 * to website sequential SKUs using data/sku-remap-from-compositional.json.
 *
 * Usage (on server with DATABASE_URL):
 *   node scripts/remap-daily-prices-to-website-skus.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const remapPath = resolve(root, "data/sku-remap-from-compositional.json");

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

function brandCore(value) {
  return normalizeBrandKey(value)
    .replace(/(فولاد|میلگرد|اهن|مجتمع|صنایع)/g, " $1 ")
    .replace(/\s+/g, " ")
    .replace(/^(میلگرد|تیرآهن|نبشی|ناودانی|ورق|لوله)\s+/, "")
    .trim();
}

function pickWebsiteSku(entries, brandName) {
  if (!entries?.length) return null;
  const needle = brandCore(brandName);
  if (!needle) return null;
  const exact = entries.filter((e) => brandCore(e.brandName) === needle || e.brandKey === normalizeBrandKey(brandName));
  if (exact.length === 1) return exact[0].websiteSku;
  const soft = entries.filter((e) => {
    const hay = brandCore(e.brandName);
    return hay.includes(needle) || needle.includes(hay);
  });
  return soft.length === 1 ? soft[0].websiteSku : null;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL missing");
  const remap = JSON.parse(readFileSync(remapPath, "utf8")).compositionalToWebsite || {};
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT price_date, product_code, brand_id, brand_name, factory_price, warehouse_price
       FROM ops_daily_prices
       WHERE product_code LIKE 'RBR-A%'
       ORDER BY price_date, product_code, brand_name`,
    );
    let updated = 0;
    let skipped = 0;
    let conflicts = 0;
    for (const row of rows) {
      const websiteSku = pickWebsiteSku(remap[row.product_code], row.brand_name);
      if (!websiteSku) {
        skipped += 1;
        continue;
      }
      if (websiteSku === row.product_code) continue;
      try {
        await client.query("BEGIN");
        // if target already exists for same day+brand, keep website row and drop compositional
        const exists = await client.query(
          `SELECT 1 FROM ops_daily_prices
           WHERE price_date = $1 AND product_code = $2 AND COALESCE(brand_id,'') = COALESCE($3,'')
           LIMIT 1`,
          [row.price_date, websiteSku, row.brand_id],
        );
        if (exists.rowCount) {
          await client.query(
            `DELETE FROM ops_daily_prices
             WHERE price_date = $1 AND product_code = $2 AND COALESCE(brand_id,'') = COALESCE($3,'')`,
            [row.price_date, row.product_code, row.brand_id],
          );
          conflicts += 1;
        } else {
          await client.query(
            `UPDATE ops_daily_prices
             SET product_code = $1
             WHERE price_date = $2 AND product_code = $3 AND COALESCE(brand_id,'') = COALESCE($4,'')`,
            [websiteSku, row.price_date, row.product_code, row.brand_id],
          );
          updated += 1;
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    const left = await client.query(`SELECT count(*)::int AS n FROM ops_daily_prices WHERE product_code LIKE 'RBR-A%'`);
    console.log(
      JSON.stringify(
        {
          scanned: rows.length,
          updated,
          skipped,
          conflictsMerged: conflicts,
          compositionalLeft: left.rows[0].n,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
