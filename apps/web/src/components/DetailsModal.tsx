import { formatToman, type Observation } from "../mock/data";
import type { CatalogProduct } from "../mock/catalog";
import { useProducerState } from "../settings/ProducerState";

type Props = {
  product: CatalogProduct;
  onClose: () => void;
};

export function DetailsModal({ product, onClose }: Props) {
  const { activeForProduct } = useProducerState();
  const brands = activeForProduct(product);
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
          <FinalCell label="کارخانه انتخاب‌شده" lane="factory" observation={undefined} />
          <FinalCell label="انبار انتخاب‌شده" lane="warehouse" observation={undefined} />
        </div>

        <ol className="obs-timeline">
          <li className="muted">مشاهده قیمتی برای این کالا ثبت نشده است. قیمت غایب صفر نیست.</li>
        </ol>
      </div>
    </div>
  );
}

function FinalCell({
  label,
  lane,
  observation,
}: {
  label: string;
  lane: "factory" | "warehouse";
  observation: Observation | undefined;
}) {
  return (
    <div className={`final-cell ${lane}`}>
      <div className="muted">{label}</div>
      <div className="price-num">{formatToman(observation?.extractedPrice ?? null)}</div>
      <div className="muted">
        {observation ? `${observation.sourceName} — ${observation.receivedAt}` : "قیمت نهایی انتخاب نشده است"}
      </div>
    </div>
  );
}
