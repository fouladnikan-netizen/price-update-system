/**
 * Deterministic formula pricing (IRR). AI must not invent adjustments.
 * Catalog lock: only existing website product_code rows may be targets.
 */
export type FormulaRule = {
  id: string;
  version: string;
  targetCategoryKey: string;
  referenceCategoryKey: string;
  fixedAdjustmentIrr: number;
  active: boolean;
};

export type FormulaInput = {
  targetProductCode: string;
  referenceProductCode: string;
  referenceNetPriceIrr: number;
  priceType: "factory" | "warehouse";
  rule: FormulaRule;
};

export type FormulaResult =
  | {
      ok: true;
      derivedNetPriceIrr: number;
      targetProductCode: string;
      referenceProductCode: string;
      formulaId: string;
      formulaVersion: string;
      fixedAdjustmentIrr: number;
      priceType: "factory" | "warehouse";
    }
  | {
      ok: false;
      reason: "inactive_rule" | "invalid_reference_price" | "circular" | "missing_reference";
    };

const DEFAULT_RULES: FormulaRule[] = [
  {
    id: "sheet-roof-from-color",
    version: "1",
    targetCategoryKey: "sheet/roof",
    referenceCategoryKey: "sheet/color",
    fixedAdjustmentIrr: 23_000,
    active: true,
  },
  {
    id: "sheet-deck-from-galvanized",
    version: "1",
    targetCategoryKey: "sheet/deck",
    referenceCategoryKey: "sheet/galvanized",
    fixedAdjustmentIrr: 23_000,
    active: true,
  },
  {
    id: "sheet-a283-from-black",
    version: "1",
    targetCategoryKey: "sheet/a283",
    referenceCategoryKey: "sheet/black",
    fixedAdjustmentIrr: 15_000,
    active: true,
  },
  {
    id: "sheet-a36-from-black",
    version: "1",
    targetCategoryKey: "sheet/a36",
    referenceCategoryKey: "sheet/black",
    fixedAdjustmentIrr: 15_000,
    active: true,
  },
  {
    id: "sheet-a516-from-st52",
    version: "1",
    targetCategoryKey: "sheet/a516",
    referenceCategoryKey: "sheet/st52",
    fixedAdjustmentIrr: 15_000,
    active: true,
  },
];

export function listDefaultFormulaRules(): FormulaRule[] {
  return DEFAULT_RULES.map((rule) => ({ ...rule }));
}

export function detectFormulaCycle(rules: FormulaRule[]): string[] {
  const active = rules.filter((rule) => rule.active);
  const edges = new Map(active.map((rule) => [rule.targetCategoryKey, rule.referenceCategoryKey]));
  const cycles: string[] = [];
  for (const start of edges.keys()) {
    const seen = new Set<string>();
    let node: string | undefined = start;
    while (node) {
      if (seen.has(node)) {
        cycles.push(`${start} → … → ${node}`);
        break;
      }
      seen.add(node);
      node = edges.get(node);
    }
  }
  return [...new Set(cycles)];
}

export function applyFormulaPrice(input: FormulaInput): FormulaResult {
  if (!input.rule.active) return { ok: false, reason: "inactive_rule" };
  if (!(input.referenceNetPriceIrr > 0)) return { ok: false, reason: "invalid_reference_price" };
  if (!input.targetProductCode.trim() || !input.referenceProductCode.trim()) {
    return { ok: false, reason: "missing_reference" };
  }
  if (input.rule.targetCategoryKey === input.rule.referenceCategoryKey) {
    return { ok: false, reason: "circular" };
  }
  return {
    ok: true,
    derivedNetPriceIrr: input.referenceNetPriceIrr + input.rule.fixedAdjustmentIrr,
    targetProductCode: input.targetProductCode.trim(),
    referenceProductCode: input.referenceProductCode.trim(),
    formulaId: input.rule.id,
    formulaVersion: input.rule.version,
    fixedAdjustmentIrr: input.rule.fixedAdjustmentIrr,
    priceType: input.priceType,
  };
}

/** Highest valid comparable net price (IRR). Never invents products. */
export function selectMaxComparablePriceIrr(
  candidates: Array<{ priceIrr: number | null; valid: boolean }>,
): number | null {
  const values = candidates
    .filter((item) => item.valid && item.priceIrr !== null && item.priceIrr > 0)
    .map((item) => item.priceIrr as number);
  if (!values.length) return null;
  return Math.max(...values);
}
