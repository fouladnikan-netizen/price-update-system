import type { CategoryBrand } from "../mock/category-brands";

type Props = {
  brands: CategoryBrand[];
  brandId: string;
  onChange: (brandId: string) => void;
  showAll?: boolean;
  allLabel?: string;
  ariaLabel?: string;
};

export function BrandTabs({
  brands,
  brandId,
  onChange,
  showAll = true,
  allLabel = "همه برندها",
  ariaLabel = "برندهای همین دسته",
}: Props) {
  return (
    <div className="brand-bar" role="tablist" aria-label={ariaLabel}>
      {showAll ? (
        <button
          className={`brand-tab ${brandId === "all" ? "active" : ""}`}
          type="button"
          role="tab"
          aria-selected={brandId === "all"}
          onClick={() => onChange("all")}
        >
          {allLabel}
        </button>
      ) : null}
      {brands.map((brand) => (
        <button
          key={brand.id}
          className={`brand-tab ${brandId === brand.id ? "active" : ""}`}
          type="button"
          role="tab"
          aria-selected={brandId === brand.id}
          onClick={() => onChange(brand.id)}
        >
          {brand.name}
        </button>
      ))}
    </div>
  );
}
