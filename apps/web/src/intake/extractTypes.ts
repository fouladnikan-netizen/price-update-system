export type ExtractedObservation = {
  rawText: string;
  productCode: string | null;
  productName: string | null;
  brandId: string | null;
  brandName: string | null;
  matchMethod: string;
  factoryPrice: number | null;
  warehousePrice: number | null;
  unit: string | null;
  confidence: number;
  status: string;
  reasons: string[];
  notes: string | null;
};

export type ExtractResponse = {
  promptVersion: string;
  canPublish: false;
  observations: ExtractedObservation[];
  error?: string;
};

export function parseExtractResult(result: unknown): ExtractResponse | null {
  if (!result || typeof result !== "object") return null;
  const data = result as Partial<ExtractResponse>;
  if (!Array.isArray(data.observations)) return null;
  return {
    promptVersion: typeof data.promptVersion === "string" ? data.promptVersion : "",
    canPublish: false,
    observations: data.observations.map(normalizeObservation),
  };
}

export function parseExtractedDrafts(result: unknown): unknown[] {
  if (!result || typeof result !== "object") return [];
  const data = result as { extracted?: { items?: unknown } };
  return Array.isArray(data.extracted?.items) ? data.extracted.items : [];
}

function normalizeObservation(item: Partial<ExtractedObservation> | null | undefined): ExtractedObservation {
  const row = item ?? {};
  return {
    rawText: typeof row.rawText === "string" ? row.rawText : "",
    productCode: row.productCode ?? null,
    productName: row.productName ?? null,
    brandId: row.brandId ?? null,
    brandName: row.brandName ?? null,
    matchMethod: typeof row.matchMethod === "string" ? row.matchMethod : "unmatched",
    factoryPrice: typeof row.factoryPrice === "number" ? row.factoryPrice : null,
    warehousePrice: typeof row.warehousePrice === "number" ? row.warehousePrice : null,
    unit: row.unit ?? null,
    confidence: typeof row.confidence === "number" ? row.confidence : 0,
    status: typeof row.status === "string" ? row.status : "unmatched",
    reasons: Array.isArray(row.reasons) ? row.reasons.filter((value): value is string => typeof value === "string") : [],
    notes: row.notes ?? null,
  };
}
