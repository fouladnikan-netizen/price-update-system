import { CATEGORY_BRANDS, getCategoryBrands } from "../mock/category-brands";
import { getUiCategoryCode, productRecordKey, type CatalogProduct } from "../mock/catalog";
import { getProductCategory, getProductGroup } from "../mock/data";

const STORAGE_KEY = "price-update.producer-tags.v1";

export type Manufacturer = {
  id: string;
  groupCode: string;
  categoryCode: string;
  brandName: string;
  officialName: string;
  source: "website";
};

export type ProducerTagState = {
  officialNames: Record<string, string>;
  /** Disabled product×brand tags. Product and brand records stay. */
  disabledTags: string[];
};

const EMPTY_STATE: ProducerTagState = {
  officialNames: {},
  disabledTags: [],
};

export function websiteManufacturers(): Manufacturer[] {
  const rows: Manufacturer[] = [];
  for (const [key, brands] of Object.entries(CATEGORY_BRANDS)) {
    const [groupCode, categoryCode] = key.split("/");
    if (!groupCode || !categoryCode) continue;
    for (const brand of brands) {
      rows.push({
        id: brand.id,
        groupCode,
        categoryCode,
        brandName: brand.name,
        officialName: brand.name,
        source: "website",
      });
    }
  }
  return rows;
}

export function loadProducerTagState(): ProducerTagState {
  try {
    if (typeof localStorage === "undefined") return { ...EMPTY_STATE };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_STATE };
    const parsed = JSON.parse(raw) as Partial<ProducerTagState>;
    return {
      officialNames: parsed.officialNames ?? {},
      disabledTags: parsed.disabledTags ?? [],
    };
  } catch {
    return { ...EMPTY_STATE };
  }
}

export function saveProducerTagState(state: ProducerTagState): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function tagKey(productKey: string, brandId: string): string {
  return `${productKey}::${brandId}`;
}

export function manufacturersWithOverrides(state: ProducerTagState): Manufacturer[] {
  return websiteManufacturers().map((item) => ({
    ...item,
    officialName: state.officialNames[item.id] ?? item.officialName,
  }));
}

export function manufacturersForCategory(
  state: ProducerTagState,
  groupCode: string,
  categoryCode: string,
): Manufacturer[] {
  return manufacturersWithOverrides(state).filter(
    (item) => item.groupCode === groupCode && item.categoryCode === categoryCode,
  );
}

export function categoryLabel(groupCode: string, categoryCode: string): string {
  const group = getProductGroup(groupCode)?.nameFa ?? groupCode;
  const category = getProductCategory(groupCode, categoryCode)?.nameFa ?? categoryCode;
  return `${group} · ${category}`;
}

export function activeManufacturersForProduct(
  state: ProducerTagState,
  product: CatalogProduct,
): Manufacturer[] {
  const categoryCode = getUiCategoryCode(product);
  const record = productRecordKey(product);
  const disabled = new Set(state.disabledTags);
  return manufacturersForCategory(state, product.groupCode, categoryCode).filter(
    (item) => !disabled.has(tagKey(record, item.id)),
  );
}

export function isBrandActiveOnProduct(
  state: ProducerTagState,
  product: CatalogProduct,
  brandId: string,
): boolean {
  const categoryCode = getUiCategoryCode(product);
  const inCategory = manufacturersForCategory(state, product.groupCode, categoryCode).some(
    (item) => item.id === brandId,
  );
  if (!inCategory) return false;
  return !state.disabledTags.includes(tagKey(productRecordKey(product), brandId));
}

export function setOfficialName(
  state: ProducerTagState,
  manufacturerId: string,
  officialName: string,
): ProducerTagState {
  return {
    ...state,
    officialNames: { ...state.officialNames, [manufacturerId]: officialName },
  };
}

export function setProductBrandTag(
  state: ProducerTagState,
  product: CatalogProduct,
  brandId: string,
  active: boolean,
): ProducerTagState {
  const key = tagKey(productRecordKey(product), brandId);
  const disabled = new Set(state.disabledTags);
  if (active) disabled.delete(key);
  else disabled.add(key);
  return { ...state, disabledTags: [...disabled] };
}

export function setBulkProductBrandTag(
  state: ProducerTagState,
  products: CatalogProduct[],
  brandId: string,
  active: boolean,
): ProducerTagState {
  let next = state;
  for (const product of products) {
    if (!manufacturersForCategory(next, product.groupCode, getUiCategoryCode(product)).some((item) => item.id === brandId)) {
      continue;
    }
    next = setProductBrandTag(next, product, brandId, active);
  }
  return next;
}

export function websiteBrandNamesForCategory(groupCode: string, categoryCode: string): string[] {
  return getCategoryBrands(groupCode, categoryCode).map((item) => item.name);
}

export type ManufacturerFormInput = {
  groupCode: string;
  categoryCode: string;
  brandName: string;
  officialName: string;
};

export type ManufacturerFormResult =
  | { ok: true; manufacturer: Manufacturer; updatedOfficialName: boolean }
  | { ok: false; error: string };

export function applyManufacturerForm(
  state: ProducerTagState,
  input: ManufacturerFormInput,
): { state: ProducerTagState; result: ManufacturerFormResult } {
  const brandName = input.brandName.trim();
  const officialName = input.officialName.trim();
  if (!input.groupCode || !input.categoryCode) {
    return { state, result: { ok: false, error: "دسته محصول را انتخاب کنید." } };
  }
  if (!brandName || !officialName) {
    return { state, result: { ok: false, error: "نام برند و نام رسمی را وارد کنید." } };
  }
  const websiteNames = websiteBrandNamesForCategory(input.groupCode, input.categoryCode);
  if (!websiteNames.includes(brandName)) {
    return {
      state,
      result: {
        ok: false,
        error: "این نام برند در خروجی وب‌سایت این دسته نیست. برند جدید اینجا ساخته نمی‌شود.",
      },
    };
  }
  const existing = manufacturersWithOverrides(state).find(
    (item) =>
      item.groupCode === input.groupCode &&
      item.categoryCode === input.categoryCode &&
      item.brandName === brandName,
  );
  if (!existing) {
    return {
      state,
      result: { ok: false, error: "این برند وب‌سایت هنوز در فهرست پیش‌نمایش بارگذاری نشده است." },
    };
  }
  return {
    state: setOfficialName(state, existing.id, officialName),
    result: { ok: true, manufacturer: { ...existing, officialName }, updatedOfficialName: true },
  };
}
