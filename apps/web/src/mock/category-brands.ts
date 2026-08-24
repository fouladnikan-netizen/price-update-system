import generatedBrands from "./category-brands.generated.json" with { type: "json" };

export type CategoryBrand = {
  id: string;
  name: string;
};

/** Website export only — no hardcoded fallback brands. */
export const CATEGORY_BRANDS = generatedBrands as Record<string, CategoryBrand[]>;

export function getAllCategoryBrandScopes(): [string, CategoryBrand[]][] {
  return Object.entries(CATEGORY_BRANDS);
}

export function getCategoryBrands(groupCode: string | undefined, categoryCode: string | undefined): CategoryBrand[] {
  if (!groupCode || !categoryCode) return [];
  const key = `${groupCode}/${categoryCode}`;
  return CATEGORY_BRANDS[key] ?? [];
}
