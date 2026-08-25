import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type CategorySourceEntry = {
  priority: number;
  name: string;
  url: string;
};

export type CategoryPricingMode = "web_max" | "formula" | "manual";

export type ApprovedCategoryConfig = {
  key: string;
  nameFa: string;
  groupCode: string;
  categoryCode: string;
  pricingMode: CategoryPricingMode;
  sources: CategorySourceEntry[];
  formula?: {
    referenceCategoryKey: string;
    fixedAdjustmentIrr: number;
  };
};

export type ApprovedSourcesFile = {
  version: string;
  selectionPolicy: string;
  categories: ApprovedCategoryConfig[];
};

const CONFIG_PATH = resolve(import.meta.dirname, "../../../data/category-sources.approved.json");

let cached: ApprovedSourcesFile | null = null;

export function loadApprovedCategorySources(): ApprovedSourcesFile {
  if (cached) return cached;
  cached = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as ApprovedSourcesFile;
  return cached;
}

export function getApprovedCategory(groupCode: string, categoryCode: string): ApprovedCategoryConfig | null {
  return (
    loadApprovedCategorySources().categories.find(
      (item) => item.groupCode === groupCode && item.categoryCode === categoryCode,
    ) ?? null
  );
}

export function listWebMaxScopes(): Array<{ groupCode: string; categoryCode: string; nameFa: string }> {
  return loadApprovedCategorySources()
    .categories.filter((item) => item.pricingMode === "web_max" && item.sources.length > 0)
    .map((item) => ({
      groupCode: item.groupCode,
      categoryCode: item.categoryCode,
      nameFa: item.nameFa,
    }));
}

export function listApprovedWebsiteHosts(): string[] {
  const hosts = new Set<string>();
  for (const category of loadApprovedCategorySources().categories) {
    for (const source of category.sources) {
      try {
        const host = new URL(source.url).hostname.replace(/^www\./, "").toLowerCase();
        hosts.add(host);
        hosts.add(`www.${host}`);
      } catch {
        /* ignore bad url in config */
      }
    }
  }
  return [...hosts];
}

export function isApprovedWebsiteUrl(address: string, groupCode: string, categoryCode: string): boolean {
  const category = getApprovedCategory(groupCode, categoryCode);
  if (!category || category.pricingMode !== "web_max") return false;
  const normalized = normalizeUrl(address);
  if (!normalized) return false;
  return category.sources.some((source) => normalizeUrl(source.url) === normalized);
}

function normalizeUrl(value: string): string | null {
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    url.hash = "";
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.protocol}//${url.hostname.toLowerCase()}${path}${url.search}`;
  } catch {
    return null;
  }
}

/** Build PriceSource-shaped seeds from approved config. Never invents products. */
export function seedSourcesFromApprovedConfig(now = new Date().toISOString()) {
  const rows = [];
  for (const category of loadApprovedCategorySources().categories) {
    if (category.pricingMode !== "web_max") continue;
    for (const source of category.sources) {
      rows.push({
        id: `approved-${category.key}-${source.priority}`,
        name: `${source.name} — ${category.nameFa}`,
        sourceType: "website" as const,
        address: source.url,
        groupCode: category.groupCode,
        categoryCode: category.categoryCode,
        brandIds: [] as string[],
        priceCoverage: "both" as const,
        taxMode: "auto" as const,
        intakeMode: "daily" as const,
        isActive: true,
        autoPublish: false as const,
        officialName: source.name,
        officialUrl: source.url,
        identityStatus: "confirmed" as const,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return rows;
}
