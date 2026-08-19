import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { BrandTabs } from "../components/BrandTabs";
import { DetailsModal } from "../components/DetailsModal";
import { PriceTable } from "../components/PriceTable";
import { getCategoryBrands } from "../mock/category-brands";
import {
  HASH_VARIANT_TABS,
  filterHashVariant,
  getCategoryProducts,
  isHashCategory,
  productSizeColumnLabel,
  type CatalogProduct,
} from "../mock/catalog";
import { MOCK_DATES, getProductCategory, getProductGroup } from "../mock/data";
import { useProducerState } from "../settings/ProducerState";

export function CategoryPage() {
  const { groupCode, categoryCode } = useParams();
  const group = getProductGroup(groupCode);
  const category = getProductCategory(groupCode, categoryCode);
  const brands = getCategoryBrands(groupCode, categoryCode);
  const hashCategory = isHashCategory(groupCode, categoryCode);
  const { isBrandActive } = useProducerState();
  const [dateIndex, setDateIndex] = useState(MOCK_DATES.length - 1);
  const [brandId, setBrandId] = useState<"all" | string>(hashCategory ? "light" : "all");
  const [detailsProduct, setDetailsProduct] = useState<CatalogProduct | null>(null);
  const dateLabel = MOCK_DATES[dateIndex];
  const activeBrand = hashCategory
    ? HASH_VARIANT_TABS.find((item) => item.id === brandId)
    : brands.find((brand) => brand.id === brandId);
  const products = useMemo(() => {
    const list = getCategoryProducts(groupCode, categoryCode, undefined);
    const byBrand =
      !hashCategory && activeBrand ? list.filter((product) => isBrandActive(product, activeBrand.id)) : list;
    if (!hashCategory) return byBrand;
    return filterHashVariant(byBrand, brandId);
  }, [groupCode, categoryCode, brandId, activeBrand, hashCategory, isBrandActive]);

  useEffect(() => {
    setBrandId(isHashCategory(groupCode, categoryCode) ? "light" : "all");
  }, [groupCode, categoryCode]);

  if (!group) {
    return <Navigate to="/category/rebar" replace />;
  }

  if (categoryCode && !category) {
    return <Navigate to={`/category/${group.code}`} replace />;
  }

  const heading = category ? `${group.nameFa} · ${category.nameFa}` : group.nameFa;
  const brandLabel = activeBrand?.name ?? (hashCategory ? "هاش سبک" : "همه برندها");

  return (
    <section className="desk">
      <header className="page-head session-head">
        <div>
          <p className="kicker">جدول روزانه · {heading}</p>
          <h1>قیمت {dateLabel}</h1>
        </div>
        <div className="session-nav" role="group" aria-label="جابه‌جایی روز">
          <button className="btn" type="button" onClick={() => setDateIndex((value) => Math.max(0, value - 1))}>
            روز قبل
          </button>
          <input className="session-date" readOnly value={dateLabel} aria-label="تاریخ انتخاب‌شده" />
          <button
            className="btn"
            type="button"
            onClick={() => setDateIndex((value) => Math.min(MOCK_DATES.length - 1, value + 1))}
          >
            روز بعد
          </button>
          <button className="btn" type="button" disabled title="خروجی تصویر در پیش‌نمایش فعال نیست">
            خروجی تصویر
          </button>
        </div>
      </header>

      {category ? (
        <>
          {hashCategory ? (
            <BrandTabs
              brands={HASH_VARIANT_TABS}
              brandId={brandId}
              onChange={setBrandId}
              showAll={false}
              ariaLabel="حالت تیرآهن هاش"
            />
          ) : (
            <>
              <BrandTabs brands={brands} brandId={brandId} onChange={setBrandId} />
              {brands.length === 0 ? (
                <p className="brand-empty">این دسته در خروجی وب‌سایت فهرست برند ندارد. نبود تب برند خطا نیست.</p>
              ) : null}
            </>
          )}
          <PriceTable
            products={products}
            brandLabel={brandLabel}
            sizeColumnLabel={productSizeColumnLabel(groupCode, categoryCode)}
            onDetails={setDetailsProduct}
          />
        </>
      ) : (
        <article className="sheet empty-group">
          <p className="kicker">{group.nameFa}</p>
          <h2>دسته را از زیرمنو انتخاب کنید</h2>
          <ul className="category-index">
            {group.categories.map((item) => (
              <li key={item.code}>
                <Link to={`/category/${group.code}/${item.code}`}>{item.nameFa}</Link>
              </li>
            ))}
          </ul>
        </article>
      )}

      {detailsProduct ? <DetailsModal product={detailsProduct} onClose={() => setDetailsProduct(null)} /> : null}
    </section>
  );
}
