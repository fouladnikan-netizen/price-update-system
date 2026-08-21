import { parsePriceNumber } from "./numbers.ts";

export type ExtractedItemDraft = {
  raw_text: string;
  suggested_product_code: string | null;
  suggested_brand_id: string | null;
  suggested_brand_name: string | null;
  grade: string | null;
  size: string | null;
  factory_price: number | null;
  warehouse_price: number | null;
  unit: "toman_per_kg" | "rial_per_kg" | "toman_per_bar" | "unknown" | null;
  confidence: number;
  notes: string | null;
};

export type ModelExtractResult = {
  is_price_message: boolean;
  message_kind: "price_list" | "other" | "unclear";
  items: ExtractedItemDraft[];
  suspicious_reasons: string[];
};

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text : null;
}

function asUnit(value: unknown): ExtractedItemDraft["unit"] {
  if (value === "toman_per_kg" || value === "rial_per_kg" || value === "toman_per_bar" || value === "unknown") return value;
  return null;
}

function asKind(value: unknown): ModelExtractResult["message_kind"] {
  if (value === "price_list" || value === "other" || value === "unclear") return value;
  return "unclear";
}

export function parseModelExtract(raw: unknown): ModelExtractResult {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const itemsIn = Array.isArray(data.items) ? data.items : [];
  const items: ExtractedItemDraft[] = itemsIn.map((entry) => {
    const item = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const confidence = typeof item.confidence === "number" && Number.isFinite(item.confidence) ? item.confidence : 0;
    return {
      raw_text: asString(item.raw_text) ?? "",
      suggested_product_code: asString(item.suggested_product_code),
      suggested_brand_id: asString(item.suggested_brand_id),
      suggested_brand_name: asString(item.suggested_brand_name),
      grade: asString(item.grade),
      size: asString(item.size),
      factory_price: parsePriceNumber(item.factory_price),
      warehouse_price: parsePriceNumber(item.warehouse_price),
      unit: asUnit(item.unit),
      confidence: Math.min(1, Math.max(0, confidence)),
      notes: asString(item.notes),
    };
  });
  const reasons = Array.isArray(data.suspicious_reasons)
    ? data.suspicious_reasons.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  return {
    is_price_message: Boolean(data.is_price_message),
    message_kind: asKind(data.message_kind),
    items,
    suspicious_reasons: reasons,
  };
}
