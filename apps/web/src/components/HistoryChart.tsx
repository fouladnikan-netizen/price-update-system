import type { HistoryPoint } from "../mock/data";

type Props = {
  points: HistoryPoint[];
};

export function HistoryChart({ points }: Props) {
  const width = 920;
  const height = 268;
  const pad = { top: 20, right: 18, bottom: 40, left: 64 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const values = points.flatMap((point) => [point.factory, point.warehouse]).filter((value): value is number => value != null);
  const min = values.length ? Math.min(...values) * 0.992 : 0;
  const max = values.length ? Math.max(...values) * 1.008 : 1;
  const span = Math.max(max - min, 1);
  const step = innerW / Math.max(points.length - 1, 1);
  const ticks = [0, 0.33, 0.66, 1];

  const y = (value: number) => pad.top + innerH - ((value - min) / span) * innerH;
  const x = (index: number) => pad.left + index * step;

  return (
    <div className="chart-frame">
      <svg className="chart-wrap" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="نمودار تاریخی قیمت نمایشی سایز ۱۴">
        {ticks.map((tick) => {
          const value = min + span * (1 - tick);
          const yPos = pad.top + innerH * tick;
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={yPos} y2={yPos} stroke="currentColor" className="chart-grid" />
              <text x={pad.left - 8} y={yPos + 4} textAnchor="end" className="chart-label">
                {Math.round(value).toLocaleString("fa-IR")}
              </text>
            </g>
          );
        })}
        {points.map((point, index) => (
          <text key={point.dateLabel} x={x(index)} y={height - 12} textAnchor="middle" className="chart-label">
            {point.dateLabel}
          </text>
        ))}
        <path d={buildPath(points, "factory", x, y)} fill="none" stroke="#1a1a1a" strokeWidth="2.2" />
        <path d={buildPath(points, "warehouse", x, y)} fill="none" stroke="#d92525" strokeWidth="2.2" strokeDasharray="5 4" />
        {points.map((point, index) => (
          <g key={`${point.dateLabel}-mark`}>
            {point.factory == null && point.warehouse == null ? (
              <line x1={x(index)} x2={x(index)} y1={pad.top} y2={pad.top + innerH} className="chart-gap" />
            ) : null}
            {point.factory != null ? <circle cx={x(index)} cy={y(point.factory)} r="3.4" fill="#1a1a1a" /> : null}
            {point.warehouse != null ? <circle cx={x(index)} cy={y(point.warehouse)} r="3.4" fill="#d92525" /> : null}
          </g>
        ))}
      </svg>
      <ul className="chart-legend">
        <li>
          <i className="swatch factory" />
          کارخانه
        </li>
        <li>
          <i className="swatch warehouse" />
          انبار
        </li>
        <li>
          <i className="swatch gap" />
          روز بدون داده
        </li>
      </ul>
    </div>
  );
}

function buildPath(
  points: HistoryPoint[],
  key: "factory" | "warehouse",
  x: (index: number) => number,
  y: (value: number) => number,
) {
  let d = "";
  let drawing = false;
  points.forEach((point, index) => {
    const value = point[key];
    if (value == null) {
      drawing = false;
      return;
    }
    const command = drawing ? "L" : "M";
    d += `${command}${x(index)},${y(value)} `;
    drawing = true;
  });
  return d.trim();
}
