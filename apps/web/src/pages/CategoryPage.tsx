import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { BrandTabs } from "../components/BrandTabs";
import { DetailsModal } from "../components/DetailsModal";
import { PriceTable } from "../components/PriceTable";
import { useDailyPrices } from "../intake/DailyPriceState";
import { datesInStore } from "../intake/dailyPriceStore";
import { tehranJalaliKey, tehranJalaliLabel } from "../intake/dates";
import { getCategoryBrands } from "../mock/category-brands";
import {
  HASH_VARIANT_TABS,
  filterHashVariant,
  getCategoryProducts,
  isHashCategory,
  productSizeColumnLabel,
  type CatalogProduct,
} from "../mock/catalog";
import { getProductCategory, getProductGroup } from "../mock/data";
import { useProducerState } from "../settings/ProducerState";

export function CategoryPage() {
  const { groupCode, categoryCode } = useParams();
  const group = getProductGroup(groupCode);
  const category = getProductCategory(groupCode, categoryCode);
  const brands = getCategoryBrands(groupCode, categoryCode);
  const hashCategory = isHashCategory(groupCode, categoryCode);
  const { isBrandActive } = useProducerState();
  const { prices, lookup } = useDailyPrices();
  const dateKeys = useMemo(() => {
    const today = tehranJalaliKey();
    const stored = datesInStore(prices);
    return stored.includes(today) ? stored : [...stored, today];
  }, [prices]);
  const [dateIndex, setDateIndex] = useState(0);
  const [brandId, setBrandId] = useState<"all" | string>(hashCategory ? "light" : brands[0]?.id ?? "all");
  const [detailsProduct, setDetailsProduct] = useState<CatalogProduct | null>(null);
  const userPickedBrand = useRef(false);

  useEffect(() => {
    setDateIndex(Math.max(0, dateKeys.length - 1));
  }, [dateKeys.length]);

  const dateKey = dateKeys[dateIndex] ?? tehranJalaliKey();
  const dateLabel = dateKey === tehranJalaliKey() ? tehranJalaliLabel() : dateKey;
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
    userPickedBrand.current = false;
    setBrandId(isHashCategory(groupCode, categoryCode) ? "light" : getCategoryBrands(groupCode, categoryCode)[0]?.id ?? "all");
  }, [groupCode, categoryCode]);

  useEffect(() => {
    if (hashCategory || userPickedBrand.current) return;
    const hasPrice = (id: string) =>
      prices.some(
        (item) =>
          item.date === dateKey && item.brandId === id && (item.factoryPrice != null || item.warehousePrice != null),
      );
    if (brandId !== "all" && hasPrice(brandId)) return;
    const millWithPrice = brands.find((brand) => hasPrice(brand.id));
    if (millWithPrice) setBrandId(millWithPrice.id);
  }, [brandId, brands, dateKey, hashCategory, prices]);

  if (!group) {
    return <Navigate to="/category/rebar" replace />;
  }

  if (categoryCode && !category) {
    return <Navigate to={`/category/${group.code}`} replace />;
  }

  const heading = category ? `${group.nameFa} · ${category.nameFa}` : group.nameFa;
  const brandLabel = activeBrand?.name ?? (hashCategory ? "هاش سبک" : "همه برندها");
  const lookupBrandId = hashCategory || brandId === "all" ? null : brandId;

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
            onClick={() => setDateIndex((value) => Math.min(dateKeys.length - 1, value + 1))}
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
              onChange={(id) => {
                userPickedBrand.current = true;
                setBrandId(id);
              }}
              showAll={false}
              ariaLabel="حالت تیرآهن هاش"
            />
          ) : (
            <>
              <BrandTabs
                brands={brands}
                brandId={brandId}
                onChange={(id) => {
                  userPickedBrand.current = true;
                  setBrandId(id);
                }}
              />
              {brands.length === 0 ? (
                <p className="brand-empty">این دسته در خروجی وب‌سایت فهرست برند ندارد. نبود تب برند خطا نیست.</p>
              ) : null}
            </>
          )}
          {brandId === "all" && !hashCategory ? (
            <p className="muted" style={{ margin: "0 0 12px" }}>
              تب همه برندها قیمت کارخانه‌ها را مخلوط نمی‌کند. یک کارخانه را انتخاب کنید.
            </p>
          ) : null}
          {!prices.some((item) => item.date === dateKey) ? (
            <p className="muted" style={{ margin: "0 0 12px" }}>
              قیمت این روز هنوز ثبت نشده. دکمهٔ به‌روزرسانی قیمت را بزنید. سلول خالی یعنی ناموجود است، نه صفر.
            </p>
          ) : null}
          <PriceTable
            products={products}
            brandLabel={brandLabel}
            sizeColumnLabel={productSizeColumnLabel(groupCode, categoryCode)}
            onDetails={setDetailsProduct}
            resolvePrice={(product) => {
              if (!lookupBrandId) return null;
              const row = lookup(product.sku, lookupBrandId, dateKey);
              if (!row) return null;
              return {
                factoryPrice: row.factoryPrice,
                factorySource: row.factorySource,
                warehousePrice: row.warehousePrice,
                warehouseSource: row.warehouseSource,
              };
            }}
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

      {detailsProduct ? (
        <DetailsModal product={detailsProduct} brandId={lookupBrandId} date={dateKey} onClose={() => setDetailsProduct(null)} />
      ) : null}
    </section>
  );
}
