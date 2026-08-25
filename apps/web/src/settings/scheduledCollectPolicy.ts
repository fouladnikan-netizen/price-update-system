import type { PriceSource } from "./sourceStore";
import { liveSources } from "../intake/priceUpdate";
import approvedConfig from "../mock/category-sources.approved.json";

type ApprovedCategory = {
  nameFa: string;
  groupCode: string;
  categoryCode: string;
  pricingMode: string;
  sources: Array<{ url: string }>;
};

const CATEGORIES = (approvedConfig as { categories: ApprovedCategory[] }).categories;

export const SCHEDULED_COLLECT_SCOPES = CATEGORIES.filter(
  (item) => item.pricingMode === "web_max" && item.sources.length > 0,
).map((item) => ({
  groupCode: item.groupCode,
  categoryCode: item.categoryCode,
  nameFa: item.nameFa,
}));

function hostsFromApproved(): Set<string> {
  const hosts = new Set<string>();
  for (const category of CATEGORIES) {
    for (const source of category.sources ?? []) {
      try {
        const host = new URL(source.url).hostname.replace(/^www\./, "").toLowerCase();
        hosts.add(host);
        hosts.add(`www.${host}`);
      } catch {
        /* ignore */
      }
    }
  }
  return hosts;
}

export const SCHEDULED_WEBSITE_HOSTS = [...hostsFromApproved()] as string[];

const SCOPE_KEYS = new Set(SCHEDULED_COLLECT_SCOPES.map((item) => `${item.groupCode}/${item.categoryCode}`));
const HOSTS = hostsFromApproved();

const APPROVED_URLS = new Set(
  CATEGORIES.flatMap((category) =>
    (category.sources ?? []).map((source) => normalizeUrl(source.url)).filter(Boolean) as string[],
  ),
);

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

export function scheduledWebsiteHost(address: string): string | null {
  const raw = address.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function isScheduledWebsite(address: string): boolean {
  const host = scheduledWebsiteHost(address);
  if (!host) return false;
  return HOSTS.has(host) || HOSTS.has(`www.${host}`);
}

export function isApprovedCollectUrl(address: string): boolean {
  const normalized = normalizeUrl(address);
  return Boolean(normalized && APPROVED_URLS.has(normalized));
}

export function isScheduledCollectScope(groupCode: string, categoryCode: string): boolean {
  return SCOPE_KEYS.has(`${groupCode}/${categoryCode}`);
}

export function scheduledCollectSources(sources: PriceSource[]): PriceSource[] {
  return liveSources(sources).filter((source) => {
    if (source.sourceType !== "website") return false;
    if (!isScheduledCollectScope(source.groupCode, source.categoryCode)) return false;
    // Exact approved URL for that category — never substitute another page.
    return isApprovedCollectUrl(source.address);
  });
}
