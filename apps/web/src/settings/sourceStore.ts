import { getCategoryBrands } from "../mock/category-brands";
import { getProductCategory, getProductGroup } from "../mock/data";

const STORAGE_KEY = "price-update.sources.v1";

export const SOURCE_TYPES = [
  { id: "website", label: "سایت" },
  { id: "telegram", label: "کانال تلگرام" },
  { id: "bale", label: "کانال بله" },
  { id: "excel", label: "فایل Excel" },
  { id: "csv", label: "فایل CSV" },
  { id: "pdf", label: "PDF" },
  { id: "image", label: "تصویر" },
  { id: "manual", label: "ورود دستی" },
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number]["id"];

export const PRICE_COVERAGES = [
  { id: "factory", label: "فقط کارخانه" },
  { id: "warehouse", label: "فقط انبار" },
  { id: "both", label: "کارخانه و انبار" },
] as const;

export type PriceCoverage = (typeof PRICE_COVERAGES)[number]["id"];

export const INTAKE_MODES = [
  { id: "manual", label: "فقط دستی / هنگام ورود" },
  { id: "on_message", label: "با هر پیام یا فایل جدید" },
  { id: "daily", label: "زمان‌بندی روزانه" },
] as const;

export type IntakeMode = (typeof INTAKE_MODES)[number]["id"];

export type PriceSource = {
  id: string;
  name: string;
  sourceType: SourceType;
  address: string;
  groupCode: string;
  categoryCode: string;
  brandIds: string[];
  priceCoverage: PriceCoverage;
  intakeMode: IntakeMode;
  isActive: boolean;
  autoPublish: false;
  createdAt: string;
  updatedAt: string;
};

export type SourceInput = {
  name: string;
  sourceType: SourceType;
  address: string;
  groupCode: string;
  categoryCode: string;
  brandIds: string[];
  priceCoverage: PriceCoverage;
  intakeMode: IntakeMode;
  isActive: boolean;
};

export function needsAddress(type: SourceType): boolean {
  return type === "website" || type === "telegram" || type === "bale";
}

export function addressFieldCopy(type: SourceType): { label: string; placeholder: string } {
  if (type === "telegram") {
    return { label: "شناسه یا لینک کانال تلگرام", placeholder: "فقط کانال مجاز سازمان" };
  }
  if (type === "bale") {
    return { label: "شناسه یا لینک کانال بله", placeholder: "مثلاً ble.ir/… — رمز ورود ذخیره نمی‌شود" };
  }
  if (type === "website") {
    return { label: "آدرس عمومی صفحه", placeholder: "فقط آدرس عمومی؛ بدون عبور از ورود یا CAPTCHA" };
  }
  return { label: "آدرس (اختیاری)", placeholder: "برای فایل و ورود دستی لازم نیست" };
}

export function sourceTypeLabel(type: SourceType): string {
  return SOURCE_TYPES.find((item) => item.id === type)?.label ?? type;
}

export function priceCoverageLabel(value: PriceCoverage): string {
  return PRICE_COVERAGES.find((item) => item.id === value)?.label ?? value;
}

export function intakeModeLabel(value: IntakeMode): string {
  return INTAKE_MODES.find((item) => item.id === value)?.label ?? value;
}

export function emptySourceInput(): SourceInput {
  return {
    name: "",
    sourceType: "manual",
    address: "",
    groupCode: "rebar",
    categoryCode: "ribbed",
    brandIds: getCategoryBrands("rebar", "ribbed").map((item) => item.id),
    priceCoverage: "both",
    intakeMode: "manual",
    isActive: true,
  };
}

export function inputFromSource(source: PriceSource): SourceInput {
  return {
    name: source.name,
    sourceType: source.sourceType,
    address: source.address,
    groupCode: source.groupCode,
    categoryCode: source.categoryCode,
    brandIds: [...source.brandIds],
    priceCoverage: source.priceCoverage,
    intakeMode: source.intakeMode,
    isActive: source.isActive,
  };
}

export function loadSources(): PriceSource[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PriceSource[];
    return Array.isArray(parsed) ? parsed.map(normalizeSource) : [];
  } catch {
    return [];
  }
}

function allowedBrandIds(groupCode: string, categoryCode: string): Set<string> {
  return new Set(getCategoryBrands(groupCode, categoryCode).map((item) => item.id));
}

function normalizeSource(item: PriceSource): PriceSource {
  const allowed = allowedBrandIds(item.groupCode, item.categoryCode);
  return {
    ...item,
    autoPublish: false,
    brandIds: (item.brandIds ?? []).filter((id) => allowed.has(id)),
    address: item.address ?? "",
  };
}

export function saveSources(sources: PriceSource[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
}

export function validateSourceInput(input: SourceInput): string | null {
  const name = input.name.trim();
  if (!name) return "نام منبع را وارد کنید.";
  if (!input.groupCode || !input.categoryCode) return "دسته مرتبط را انتخاب کنید.";
  if (!getProductGroup(input.groupCode) || !getProductCategory(input.groupCode, input.categoryCode)) {
    return "دسته انتخاب‌شده در کاتالوگ نیست.";
  }
  if (needsAddress(input.sourceType) && !input.address.trim()) {
    return "برای سایت، تلگرام و بله، آدرس یا شناسه کانال لازم است.";
  }
  const allowed = allowedBrandIds(input.groupCode, input.categoryCode);
  if (input.brandIds.some((id) => !allowed.has(id))) {
    return "برند قابل پوشش باید از برندهای همان دسته باشد. برند جدید ساخته نمی‌شود.";
  }
  return null;
}

export function upsertSource(sources: PriceSource[], input: SourceInput, editingId?: string): PriceSource[] {
  const now = new Date().toISOString();
  const allowed = allowedBrandIds(input.groupCode, input.categoryCode);
  const brandIds = input.brandIds.filter((id) => allowed.has(id));
  if (editingId) {
    return sources.map((item) =>
      item.id === editingId
        ? {
            ...item,
            ...input,
            name: input.name.trim(),
            address: input.address.trim(),
            brandIds,
            autoPublish: false,
            updatedAt: now,
          }
        : item,
    );
  }
  const created: PriceSource = {
    id: crypto.randomUUID(),
    ...input,
    name: input.name.trim(),
    address: input.address.trim(),
    brandIds,
    autoPublish: false,
    createdAt: now,
    updatedAt: now,
  };
  return [created, ...sources];
}

export function setSourceActive(sources: PriceSource[], id: string, isActive: boolean): PriceSource[] {
  const now = new Date().toISOString();
  return sources.map((item) => (item.id === id ? { ...item, isActive, autoPublish: false, updatedAt: now } : item));
}

export function removeSource(sources: PriceSource[], id: string): PriceSource[] {
  return sources.filter((item) => item.id !== id);
}

export function categoryScopeLabel(groupCode: string, categoryCode: string): string {
  const group = getProductGroup(groupCode)?.nameFa ?? groupCode;
  const category = getProductCategory(groupCode, categoryCode)?.nameFa ?? categoryCode;
  return `${group} · ${category}`;
}
