import { useMemo, useState } from "react";
import {
  MOCK_REVIEWS,
  formatToman,
  statusLabel,
  statusTone,
  type ObservationStatus,
  type ReviewItem,
} from "../mock/data";

type ReviewState = Record<string, ObservationStatus>;

export function ReviewPage() {
  const [decisions, setDecisions] = useState<ReviewState>({});
  const [selectedId, setSelectedId] = useState(MOCK_REVIEWS[0]?.id ?? "");

  const items = useMemo(
    () =>
      MOCK_REVIEWS.map((item) => ({
        ...item,
        status: decisions[item.id] ?? item.status,
      })),
    [decisions],
  );

  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const openCount = items.filter((item) => item.status === "suspicious" || item.status === "unmatched").length;

  return (
    <section className="desk">
      <header className="page-head">
        <div>
          <p className="kicker">صف بررسی انسانی</p>
          <h1>{openCount.toLocaleString("fa-IR")} مورد باز</h1>
        </div>
        <p className="page-head-note">انتشار از این صف ممکن نیست تا تصمیم ثبت شود</p>
      </header>

      <div className="queue">
        <aside className="queue-list" aria-label="موارد صف">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`queue-item ${item.id === selected?.id ? "active" : ""}`}
              onClick={() => setSelectedId(item.id)}
            >
              <span className={`badge ${item.kind === "suspicious" ? "danger" : "warning"}`}>
                {item.kind === "suspicious" ? "مشکوک" : "تطبیق‌نیافته"}
              </span>
              <strong>{item.title}</strong>
              <span className="muted">{item.sourceName}</span>
            </button>
          ))}
        </aside>

        {selected ? (
          <QueueDetail
            item={selected}
            onDecide={(status) => {
              setDecisions((current) => ({ ...current, [selected.id]: status }));
            }}
          />
        ) : null}
      </div>
    </section>
  );
}

function QueueDetail({
  item,
  onDecide,
}: {
  item: ReviewItem & { status: ObservationStatus };
  onDecide: (status: ObservationStatus) => void;
}) {
  return (
    <article className="queue-detail">
      <div className="queue-detail-head">
        <span className={`badge ${statusTone(item.status)}`}>{statusLabel(item.status)}</span>
        <h2>{item.title}</h2>
        <p>{item.detail}</p>
      </div>

      <dl className="detail-facts">
        <div>
          <dt>منبع خام</dt>
          <dd>{item.sourceName}</dd>
        </div>
        <div>
          <dt>مبلغ استخراج‌شده</dt>
          <dd className="price-num">{formatToman(item.extractedPrice)}</dd>
        </div>
        <div>
          <dt>نوع مورد</dt>
          <dd>{item.kind === "suspicious" ? "قیمت مشکوک" : "بدون تطبیق کالا"}</dd>
        </div>
      </dl>

      {item.kind === "unmatched" ? (
        <p className="policy">محصول یا برند جدید از روی این متن ساخته نمی‌شود. باید به sku وب‌سایت وصل شود یا رد گردد.</p>
      ) : (
        <p className="policy">این مشاهده تا تأیید انسان وارد قیمت نهایی روز نمی‌شود.</p>
      )}

      <div className="review-actions">
        <button className="btn primary" type="button" onClick={() => onDecide("approved")}>
          تأیید
        </button>
        <button className="btn danger" type="button" onClick={() => onDecide("rejected")}>
          رد
        </button>
        <button className="btn" type="button" onClick={() => onDecide("needs_more_review")}>
          بررسی بیشتر
        </button>
      </div>
    </article>
  );
}
