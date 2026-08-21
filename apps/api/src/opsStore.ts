import type { PoolClient } from "pg";
import type { DailyPrice } from "../../web/src/intake/dailyPriceStore.ts";
import type { IntakeRecord } from "../../web/src/intake/rawStore.ts";
import { toRegisteredRial } from "../../web/src/intake/rial.ts";
import { isDroppedSource, type PriceSource } from "../../web/src/settings/sourceStore.ts";
import { withClient } from "./pg.ts";

export type StoreKind = "postgres" | "unavailable";

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function normalizeDailyPrice(row: DailyPrice): DailyPrice {
  const factoryPrice = toRegisteredRial(asNumber(row.factoryPrice));
  const warehousePrice = toRegisteredRial(asNumber(row.warehousePrice));
  return {
    ...row,
    productCode: row.productCode.trim(),
    brandId: row.brandId || null,
    factoryPrice,
    warehousePrice,
    factorySource: factoryPrice == null ? null : row.factorySource,
    warehouseSource: warehousePrice == null ? null : row.warehouseSource,
  };
}

function brandKey(brandId: string | null | undefined): string {
  return brandId ?? "";
}

function sourceFromRow(row: Record<string, unknown>): PriceSource {
  const brandIds = Array.isArray(row.brand_ids)
    ? (row.brand_ids as string[])
    : typeof row.brand_ids === "string"
      ? (JSON.parse(row.brand_ids) as string[])
      : [];
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    sourceType: row.source_type as PriceSource["sourceType"],
    address: String(row.address ?? ""),
    groupCode: String(row.group_code ?? ""),
    categoryCode: String(row.category_code ?? ""),
    brandIds,
    priceCoverage: row.price_coverage as PriceSource["priceCoverage"],
    taxMode: row.tax_mode as PriceSource["taxMode"],
    intakeMode: row.intake_mode as PriceSource["intakeMode"],
    isActive: Boolean(row.is_active),
    autoPublish: false,
    officialName: row.official_name == null ? null : String(row.official_name),
    officialUrl: row.official_url == null ? null : String(row.official_url),
    identityStatus: (row.identity_status as PriceSource["identityStatus"]) ?? "incomplete",
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function intakeFromRow(row: Record<string, unknown>): IntakeRecord {
  return {
    id: String(row.id),
    sourceId: row.source_id == null ? null : String(row.source_id),
    sourceName: String(row.source_name ?? ""),
    groupCode: String(row.group_code ?? ""),
    categoryCode: String(row.category_code ?? ""),
    priceCoverage: (row.price_coverage as IntakeRecord["priceCoverage"]) ?? undefined,
    inputKind: (row.input_kind as IntakeRecord["inputKind"]) ?? "text",
    rawText: String(row.raw_text ?? ""),
    imageUrl: row.image_url == null ? null : String(row.image_url),
    fileName: row.file_name == null ? null : String(row.file_name),
    receivedAt: new Date(String(row.received_at)).toISOString(),
    promptVersion: row.prompt_version == null ? null : String(row.prompt_version),
    canPublish: false,
    error: row.error == null ? null : String(row.error),
    result: row.result ?? null,
  };
}

function dailyFromRow(row: Record<string, unknown>): DailyPrice {
  const factoryPrice = toRegisteredRial(asNumber(row.factory_price));
  const warehousePrice = toRegisteredRial(asNumber(row.warehouse_price));
  return {
    date: String(row.price_date),
    productCode: String(row.product_code),
    brandId: row.brand_id ? String(row.brand_id) : null,
    brandName: row.brand_name == null ? null : String(row.brand_name),
    factoryPrice,
    warehousePrice,
    factorySource: factoryPrice == null ? null : row.factory_source == null ? null : String(row.factory_source),
    warehouseSource: warehousePrice == null ? null : row.warehouse_source == null ? null : String(row.warehouse_source),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function loadSourcesFromDb(): Promise<{ store: StoreKind; sources: PriceSource[] } | null> {
  return withClient(async (client) => {
    const result = await client.query("SELECT * FROM ops_sources ORDER BY updated_at DESC");
    return {
      store: "postgres" as const,
      sources: result.rows.map(sourceFromRow).filter((item) => !isDroppedSource(item)),
    };
  });
}

async function replaceSourcesInDb(client: PoolClient, sources: PriceSource[]): Promise<void> {
  await client.query("DELETE FROM ops_sources");
  for (const source of sources.filter((item) => !isDroppedSource(item))) {
    await client.query(
      `INSERT INTO ops_sources (
        id, name, source_type, address, group_code, category_code, brand_ids, price_coverage,
        tax_mode, intake_mode, is_active, auto_publish, official_name, official_url, identity_status, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,false,$12,$13,$14,$15,$16)`,
      [
        source.id,
        source.name,
        source.sourceType,
        source.address,
        source.groupCode,
        source.categoryCode,
        JSON.stringify(source.brandIds ?? []),
        source.priceCoverage,
        source.taxMode,
        source.intakeMode,
        source.isActive,
        source.officialName,
        source.officialUrl,
        source.identityStatus,
        source.createdAt,
        source.updatedAt,
      ],
    );
  }
}

export async function saveSourcesToDb(sources: PriceSource[]): Promise<boolean> {
  const result = await withClient(async (client) => {
    await replaceSourcesInDb(client, sources);
    return true;
  });
  return Boolean(result);
}

function intakeParams(item: IntakeRecord): unknown[] {
  return [
    item.id,
    item.sourceId,
    item.sourceName,
    item.groupCode,
    item.categoryCode,
    item.priceCoverage ?? null,
    item.inputKind,
    item.rawText,
    item.imageUrl,
    item.fileName,
    item.receivedAt,
    item.promptVersion,
    item.error,
    item.result == null ? null : JSON.stringify(item.result),
  ];
}

const INTAKE_INSERT = `INSERT INTO ops_raw_inputs (
  id, source_id, source_name, group_code, category_code, price_coverage, input_kind,
  raw_text, image_url, file_name, received_at, prompt_version, can_publish, error, result
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false,$13,$14::jsonb)
ON CONFLICT (id) DO UPDATE SET
  source_id = EXCLUDED.source_id,
  source_name = EXCLUDED.source_name,
  raw_text = EXCLUDED.raw_text,
  prompt_version = EXCLUDED.prompt_version,
  error = EXCLUDED.error,
  result = EXCLUDED.result`;

export async function loadIntakesFromDb(): Promise<{ store: StoreKind; intakes: IntakeRecord[] } | null> {
  return withClient(async (client) => {
    const result = await client.query("SELECT * FROM ops_raw_inputs ORDER BY received_at DESC");
    return { store: "postgres" as const, intakes: result.rows.map(intakeFromRow) };
  });
}

export async function saveIntakesToDb(intakes: IntakeRecord[]): Promise<boolean> {
  const result = await withClient(async (client) => {
    await client.query("DELETE FROM ops_raw_inputs");
    for (const item of intakes) {
      await client.query(INTAKE_INSERT, intakeParams(item));
    }
    return true;
  });
  return Boolean(result);
}

export async function appendIntakesToDb(intakes: IntakeRecord[]): Promise<boolean> {
  if (!intakes.length) return true;
  const result = await withClient(async (client) => {
    for (const item of intakes) {
      await client.query(INTAKE_INSERT, intakeParams(item));
    }
    return true;
  });
  return Boolean(result);
}

export async function loadDailyPricesFromDb(): Promise<{ store: StoreKind; prices: DailyPrice[] } | null> {
  return withClient(async (client) => {
    const result = await client.query("SELECT * FROM ops_daily_prices ORDER BY updated_at DESC");
    return { store: "postgres" as const, prices: result.rows.map(dailyFromRow) };
  });
}

export async function replaceDailyPricesInDb(prices: DailyPrice[]): Promise<boolean> {
  const result = await withClient(async (client) => {
    await client.query("DELETE FROM ops_daily_prices");
    for (const row of prices.map(normalizeDailyPrice)) {
      if (!row.productCode) continue;
      await client.query(
        `INSERT INTO ops_daily_prices (
          price_date, product_code, brand_id, brand_name, factory_price, warehouse_price,
          factory_source, warehouse_source, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          row.date,
          row.productCode,
          brandKey(row.brandId),
          row.brandName,
          row.factoryPrice,
          row.warehousePrice,
          row.factorySource,
          row.warehouseSource,
          row.updatedAt,
        ],
      );
    }
    return true;
  });
  return Boolean(result);
}

export async function upsertDailyPricesInDb(rows: DailyPrice[]): Promise<DailyPrice[] | null> {
  return withClient(async (client) => {
    for (const raw of rows) {
      const row = normalizeDailyPrice(raw);
      if (!row.productCode) continue;
      await client.query(
        `INSERT INTO ops_daily_prices (
          price_date, product_code, brand_id, brand_name, factory_price, warehouse_price,
          factory_source, warehouse_source, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (price_date, product_code, brand_id) DO UPDATE SET
          brand_name = EXCLUDED.brand_name,
          factory_price = EXCLUDED.factory_price,
          warehouse_price = EXCLUDED.warehouse_price,
          factory_source = EXCLUDED.factory_source,
          warehouse_source = EXCLUDED.warehouse_source,
          updated_at = EXCLUDED.updated_at`,
        [
          row.date,
          row.productCode,
          brandKey(row.brandId),
          row.brandName,
          row.factoryPrice,
          row.warehousePrice,
          row.factorySource,
          row.warehouseSource,
          row.updatedAt,
        ],
      );
    }
    const result = await client.query("SELECT * FROM ops_daily_prices ORDER BY updated_at DESC");
    return result.rows.map(dailyFromRow);
  });
}

export async function loadMetaNumber(key: string): Promise<number | null> {
  const result = await withClient(async (client) => {
    const row = await client.query("SELECT value FROM ops_meta WHERE key = $1", [key]);
    const value = row.rows[0]?.value;
    if (value && typeof value === "object" && "n" in value) return Number((value as { n: number }).n) || 0;
    return 0;
  });
  return result;
}

export async function loadMetaJson<T>(key: string): Promise<T | null> {
  const result = await withClient(async (client) => {
    const row = await client.query("SELECT value FROM ops_meta WHERE key = $1", [key]);
    return (row.rows[0]?.value as T) ?? null;
  });
  return result;
}

export async function saveMetaJson(key: string, value: unknown): Promise<boolean> {
  const result = await withClient(async (client) => {
    await client.query(
      `INSERT INTO ops_meta (key, value) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, JSON.stringify(value)],
    );
    return true;
  });
  return Boolean(result);
}

export async function saveMetaNumber(key: string, n: number): Promise<void> {
  await saveMetaJson(key, { n });
}
