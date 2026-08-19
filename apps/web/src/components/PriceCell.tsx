type Props = {
  value: number | null;
  source?: string | null;
  lane: "factory" | "warehouse";
};

export function PriceCell({ value, source, lane }: Props) {
  if (value == null) {
    return (
      <div className={`price-cell ${lane} is-missing`}>
        <span className="price-gap">بدون داده</span>
        <span className="price-src">غایب — صفر نشده</span>
      </div>
    );
  }

  return (
    <div className={`price-cell ${lane}`}>
      <div className="price-line">
        <span className="price-num">{value.toLocaleString("fa-IR")}</span>
        <span className="price-unit">تومان</span>
      </div>
      <span className="price-src">{source ?? "منبع نامشخص"}</span>
    </div>
  );
}
