import { liveSources } from "../intake/priceUpdate";
import type { PriceSource } from "./sourceStore";

export const SCHEDULED_WEBSITE_HOSTS = [
  "ahanonline.com",
  "www.ahanonline.com",
  "ahanprice.com",
  "www.ahanprice.com",
] as const;

/** Website catalog scopes that the daily timer may collect. No invented products. */
export const SCHEDULED_COLLECT_SCOPES = [
  { groupCode: "rebar", categoryCode: "ribbed", nameFa: "میلگرد آجدار" },
  { groupCode: "sheet", categoryCode: "black", nameFa: "ورق سیاه" },
  { groupCode: "sheet", categoryCode: "st52", nameFa: "ورق ST52" },
  { groupCode: "sheet", categoryCode: "galvanized", nameFa: "ورق گالوانیزه" },
  { groupCode: "sheet", categoryCode: "oiled", nameFa: "ورق روغنی" },
  { groupCode: "sheet", categoryCode: "color", nameFa: "ورق رنگی" },
  { groupCode: "beam", categoryCode: "ipe", nameFa: "تیرآهن IPE" },
  { groupCode: "beam", categoryCode: "h", nameFa: "تیرآهن هاش" },
  { groupCode: "angle", categoryCode: "angle", nameFa: "نبشی" },
  { groupCode: "channel", categoryCode: "sabok", nameFa: "ناودانی سبک" },
  { groupCode: "channel", categoryCode: "sangin", nameFa: "ناودانی سنگین" },
  { groupCode: "pipe", categoryCode: "galvanized", nameFa: "لوله گالوانیزه" },
  { groupCode: "pipe", categoryCode: "greenhouse", nameFa: "لوله گلخانه‌ای" },
  { groupCode: "pipe", categoryCode: "welded", nameFa: "لوله درزدار" },
  { groupCode: "pipe", categoryCode: "water", nameFa: "لوله تست آب" },
  { groupCode: "pipe", categoryCode: "gas", nameFa: "لوله تست گاز" },
  { groupCode: "pipe", categoryCode: "api", nameFa: "لوله API" },
] as const;

const SCOPE_KEYS = new Set(SCHEDULED_COLLECT_SCOPES.map((item) => `${item.groupCode}/${item.categoryCode}`));
const HOSTS = new Set<string>(SCHEDULED_WEBSITE_HOSTS);

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

export function isScheduledCollectScope(groupCode: string, categoryCode: string): boolean {
  return SCOPE_KEYS.has(`${groupCode}/${categoryCode}`);
}

export function scheduledCollectSources(sources: PriceSource[]): PriceSource[] {
  return liveSources(sources).filter((source) => {
    if (source.sourceType !== "website") return false;
    return isScheduledWebsite(source.address) && isScheduledCollectScope(source.groupCode, source.categoryCode);
  });
}
