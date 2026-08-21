import { formatToman } from "../mock/data";
import type { CatalogProduct } from "../mock/catalog";
import { quoteUnitForProduct } from "../mock/quoteUnit";
import { useDailyPrices } from "../intake/DailyPriceState";
import { isCatalogItem } from "../intake/queueStore";
import { useIntakeState } from "../intake/IntakeState";
import { useProducerState } from "../settings/ProducerState";

type Props = {
  product: CatalogProduct;
  brandId?: string | null;
  date?: string;
  onClose: () => void;
};

export function DetailsModal({ product, brandId, date, onClose }: Props) {
  const { activeForProduct } = useProducerState();
  const { items } = useIntakeState();
  const { lookup } = useDailyPrices();
  const brands = activeForProduct(product);
  const quotes = items.filter((item) => {
    if (!isCatalogItem(item) || item.productCode !== product.sku) return false;
    if (brandId && item.brandId && item.brandId !== brandId) return false;
    return true;
  });
  const selected = brandId ? lookup(product.sku, brandId, date) : undefined;

  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <div
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="details-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="drawer-head">
          <div>
            <p className="kicker">مشاهدات جمع‌آوری‌شده</p>
            <h2 id="details-title">{product.name}</h2>
          </div>
          <button className="btn ghost" type="button" onClick={onClose}>
            بستن
          </button>
        </header>

        {brands.length ? (
          <p className="muted">برندهای فعال این کالا: {brands.map((item) => item.brandName).join("، ")}</p>
        ) : (
          <p className="muted">این کالا در خروجی وب‌سایت بدون تگ برند است، یا همه تگ‌ها قطع شده‌اند.</p>
        )}

        <div className="final-lanes">
          <FinalCell
            label="کارخانه انتخاب‌شده"
            lane="factory"
            unit={quoteUnitForProduct(product, "factory")}
            value={selected?.factoryPrice ?? null}
            source={selected?.factorySource ?? null}
          />
          <FinalCell
            label="انبار انتخاب‌شده"
            lane="warehouse"
            unit={quoteUnitForProduct(product, "warehouse")}
            value={selected?.warehousePrice ?? null}
            source={selected?.warehouseSource ?? null}
          />
        </div>

        <ol className="obs-timeline">
          {quotes.length ? (
            <>
              <li className="muted">هر منبع جدا ثبت می‌شود. عدد جدول سقف همین قیمت‌های ریال (با مالیات، رند سه‌صفر) است.</li>
              {quotes.map((item) => (
                <li key={item.id}>
                  {item.sourceName}
                  {item.brandName ? ` · ${item.brandName}` : ""} — کارخانه {formatToman(item.factoryPrice)} · انبار{" "}
                  {formatToman(item.warehousePrice)}
                </li>
              ))}
            </>
          ) : (
            <li className="muted">مشاهده قیمتی برای این کالا ثبت نشده است. قیمت غایب صفر نیست.</li>
          )}
          {product.groupCode === "pipe" ? (
            <li className="muted">
              نمایش وب‌سایت کیلوگرم است. منبع انبار ممکن است شاخه هم اعلام کند؛ بدون وزن شاخه تبدیل نمی‌شود.
            </li>
          ) : null}
        </ol>
      </div>
    </div>
  );
}

function FinalCell({
  label,
  lane,
  unit,
  value,
  source,
}: {
  label: string;
  lane: "factory" | "warehouse";
  unit: ReturnType<typeof quoteUnitForProduct>;
  value: number | null;
  source: string | null;
}) {
  return (
    <div className={`final-cell ${lane}`}>
      <div className="muted">
        {label}
        {unit ? ` · ${unit}` : ""}
      </div>
      <div className="price-num">{formatToman(value)}</div>
      <div className="muted">{source ?? "قیمت نهایی انتخاب نشده است"}</div>
    </div>
  );
}
