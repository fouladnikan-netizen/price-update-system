import type { QuoteUnit } from "../mock/quoteUnit";
import { priceUnitText } from "../mock/quoteUnit";

type Props = {
  value: number | null;
  source?: string | null;
  lane: "factory" | "warehouse";
  unit?: QuoteUnit | null;
};

export function PriceCell({ value, source, lane, unit = null }: Props) {
  const unitLabel = priceUnitText(unit);
  if (value == null) {
    return (
      <div className={`price-cell ${lane} is-missing`}>
        <span className="price-gap">بدون داده</span>
        <span className="price-src">{unit ?? "غایب — صفر نشده"}</span>
      </div>
    );
  }

  return (
    <div className={`price-cell ${lane}`}>
      <div className="price-line">
        <span className="price-num">{value.toLocaleString("fa-IR")}</span>
        <span className="price-unit">{unitLabel}</span>
      </div>
      <span className="price-src">{source ?? "منبع نامشخص"}</span>
    </div>
  );
}
