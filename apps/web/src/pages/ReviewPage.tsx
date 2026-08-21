import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { approvedCeiling } from "../intake/ceiling";
import { extractTextForRematch } from "../intake/dates";
import { useIntakeState } from "../intake/IntakeState";
import { isCatalogItem, isOpenStatus, type QueueItem, type QueueKind } from "../intake/queueStore";
import { formatToman, getProductGroup, statusLabel, statusTone, type ObservationStatus } from "../mock/data";
import { usePublishState } from "../publish/PublishState";
import { canRequestPublish, publicationStatusLabel, tehranDate, type PublicationRecord } from "../publish/publishStore";
import { categoryScopeLabel } from "../settings/sourceStore";

type ReviewFilter = "catalog" | "extras" | "open";

function kindLabel(kind: QueueKind): string {
  if (kind === "unmatched") return "خارج از کاتالوگ";
  if (kind === "suspicious") return "تطبیق پیشنهادی";
  return "کالای ما";
}

function kindTone(kind: QueueKind): string {
  if (kind === "unmatched") return "warning";
  if (kind === "suspicious") return "danger";
  return "";
}

export function ReviewPage() {
  const { intakes, items, openCount, decide, patchIntake, assignLane, clearQueue } = useIntakeState();
  const [filter, setFilter] = useState<ReviewFilter>("open");
  const [rematchBusy, setRematchBusy] = useState(false);
  const [rematchNote, setRematchNote] = useState<string | null>(null);
  const [rematchError, setRematchError] = useState<string | null>(null);

  const catalogItems = useMemo(() => items.filter(isCatalogItem), [items]);
  const extraItems = useMemo(() => items.filter((item) => !isCatalogItem(item)), [items]);
  const visible = useMemo(() => {
    if (filter === "catalog") return catalogItems;
    if (filter === "extras") return extraItems;
    return items.filter((item) => isOpenStatus(item.status));
  }, [catalogItems, extraItems, filter, items]);
  const [selectedId, setSelectedId] = useState(visible[0]?.id ?? "");

  useEffect(() => {
    if (!visible.some((item) => item.id === selectedId)) {
      setSelectedId(visible[0]?.id ?? "");
    }
  }, [selectedId, visible]);

  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];
  const ceiling = selected?.productCode
    ? approvedCeiling(items, selected.productCode, selected.brandId)
    : null;

  async function rematchCatalog() {
    setRematchBusy(true);
    setRematchError(null);
    setRematchNote(null);
    let updated = 0;
    try {
      if (!intakes.length) {
        setRematchError("ورودی خامی برای تطبیق نیست. اول «دریافت و تطبیق همه» را بزنید.");
        return;
      }
      for (const [index, intake] of intakes.entries()) {
        const groupCode = intake.groupCode;
        const categoryCode = intake.categoryCode || getProductGroup(groupCode)?.categories[0]?.code || "";
        const text = extractTextForRematch(intake.rawText, intake.result);
        if (!groupCode || !categoryCode || !text) continue;
        setRematchNote(`استخراج و تطبیق ${index + 1} از ${intakes.length}…`);
        const response = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, groupCode, categoryCode }),
        });
        const payload = (await response.json()) as { observations?: unknown; extracted?: unknown; promptVersion?: string; error?: string };
        if (!response.ok) {
          setRematchError(payload.error ?? `تطبیق «${intake.sourceName}» انجام نشد.`);
          return;
        }
        const current = intake.result && typeof intake.result === "object" ? intake.result : {};
        patchIntake(intake.id, {
          categoryCode,
          error: null,
          promptVersion: payload.promptVersion ?? intake.promptVersion,
          result: { ...current, ...payload },
        });
        updated += 1;
      }
      if (!updated) {
        setRematchError("متن خامی برای استخراج دوباره نبود.");
        return;
      }
      setRematchNote(`${updated.toLocaleString("fa-IR")} ورودی دوباره استخراج و با کاتالوگ تطبیق شد.`);
    } catch {
      setRematchError("سرویس استخراج در دسترس نیست.");
    } finally {
      setRematchBusy(false);
    }
  }

  function archiveExtras() {
    for (const item of extraItems) {
      if (isOpenStatus(item.status)) decide(item.id, "archived");
    }
  }

  return (
    <section className="desk">
      <header className="page-head">
        <div>
          <p className="kicker">صف بررسی انسانی</p>
          <h1>{openCount.toLocaleString("fa-IR")} مورد باز</h1>
        </div>
        <p className="page-head-note">
          مسیر اصلی یک دکمه است: دریافت و تطبیق. این صفحه برای تأیید انسان و موارد مبهم است. تطبیق دوباره فقط وقتی لازم
          است که استخراج قبلی ناقص مانده باشد.
        </p>
      </header>

      <div className="settings-toolbar">
        <div className="bulk-bar">
          <button className={`btn slim ${filter === "catalog" ? "primary" : ""}`} type="button" onClick={() => setFilter("catalog")}>
            کالاهای ما
          </button>
          <button className={`btn slim ${filter === "extras" ? "primary" : ""}`} type="button" onClick={() => setFilter("extras")}>
            خارج از کاتالوگ
          </button>
          <button className={`btn slim ${filter === "open" ? "primary" : ""}`} type="button" onClick={() => setFilter("open")}>
            همهٔ باز
          </button>
        </div>
        <button className="btn" type="button" disabled={rematchBusy} onClick={() => void rematchCatalog()}>
          {rematchBusy ? "در حال تطبیق…" : "تطبیق دوباره با کاتالوگ"}
        </button>
        <Link className="btn primary" to="/compare">
          ماتریس مقایسه
        </Link>
        {extraItems.some((item) => isOpenStatus(item.status)) ? (
          <button className="btn" type="button" onClick={archiveExtras}>
            بایگانی خارج از کاتالوگ
          </button>
        ) : null}
        <Link className="btn" to="/collect">
          دریافت
        </Link>
        <button className="btn" type="button" disabled={!intakes.length} onClick={() => clearQueue()}>
          خالی کردن صف
        </button>
      </div>
      {rematchNote ? <p className="settings-banner">{rematchNote}</p> : null}
      {rematchError ? <p className="settings-error">{rematchError}</p> : null}

      {items.length === 0 ? (
        <div className="sheet">
          <p className="muted">صف خالی است. یک‌بار «دریافت و تطبیق همه» را بزنید و تا پایان صبر کنید.</p>
          <Link className="btn primary" to="/collect">
            رفتن به دریافت
          </Link>
        </div>
      ) : (
        <div className="queue">
          <aside className="queue-list" aria-label="موارد صف">
            {visible.length ? (
              visible.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`queue-item ${item.id === selected?.id ? "active" : ""}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className={`badge ${kindTone(item.kind)}`}>{kindLabel(item.kind)}</span>
                  <strong>{item.title}</strong>
                  <span className="muted">{item.sourceName}</span>
                </button>
              ))
            ) : (
              <p className="muted" style={{ padding: 16 }}>
                {filter === "catalog"
                  ? "هنوز ردیفی به کالای کاتالوگ وصل نشده. تطبیق دوباره را بزنید یا خارج از کاتالوگ را ببینید."
                  : "موردی در این فیلتر نیست."}
              </p>
            )}
          </aside>

          {selected ? (
            <QueueDetail
              item={selected}
              ceiling={ceiling}
              onDecide={(status) => decide(selected.id, status)}
              onAssignLane={(lane) => assignLane(selected.id, lane)}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}

function QueueDetail({
  item,
  ceiling,
  onDecide,
  onAssignLane,
}: {
  item: QueueItem;
  ceiling: ReturnType<typeof approvedCeiling> | null;
  onDecide: (status: ObservationStatus) => void;
  onAssignLane: (lane: "factory" | "warehouse") => void;
}) {
  const catalogRow = Boolean(item.productCode);

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
          <dt>دسته</dt>
          <dd>{categoryScopeLabel(item.groupCode, item.categoryCode)}</dd>
        </div>
        <div>
          <dt>قیمت کارخانه این منبع</dt>
          <dd className="price-num">{formatToman(item.factoryPrice)}</dd>
        </div>
        <div>
          <dt>قیمت انبار این منبع</dt>
          <dd className="price-num">{formatToman(item.warehousePrice)}</dd>
        </div>
        <div>
          <dt>کالای کاتالوگ</dt>
          <dd>{item.productCode ? `${item.productName ?? item.productCode}` : "وصل نشد — ساخته هم نمی‌شود"}</dd>
        </div>
        <div>
          <dt>کارخانه</dt>
          <dd>{item.brandName ?? "مشخص نشد"}</dd>
        </div>
      </dl>

      {catalogRow && ceiling && ceiling.approvedCount > 0 ? (
        <p className="policy">
          حد بالای تأییدشده برای همین کالا و کارخانه: کارخانه {formatToman(ceiling.factoryPrice)} · انبار{" "}
          {formatToman(ceiling.warehousePrice)} ({ceiling.approvedCount.toLocaleString("fa-IR")} منبع تأییدشده)
        </p>
      ) : null}

      <div>
        <p className="muted">{item.imageUrl ? "تصویر خام محفوظ" : "متن خام محفوظ"}</p>
        {item.imageUrl ? (
          <img className="raw-image" src={item.imageUrl} alt={item.fileName ?? "تصویر خام"} />
        ) : null}
        <pre className="raw-preview">{item.rawText}</pre>
      </div>

      {catalogRow ? (
        <p className="policy">
          تأیید یعنی این مبلغ برای همین کالای کاتالوگ درست است. نادرست یعنی مبلغ یا کارخانه اشتباه است. بعداً یعنی هنوز
          مطمئن نیستید. کالای جدید ساخته نمی‌شود.
        </p>
      ) : (
        <p className="policy">
          این ردیف در محصولات ما نیست. بایگانی می‌شود تا منبع خام بماند. به کاتالوگ اضافه نمی‌شود.
        </p>
      )}

      {item.needsLane ? (
        <div className="review-actions">
          <p className="policy">محل انتشار در پیام مشخص نیست. کارخانه است یا انبار؟</p>
          <button className="btn primary" type="button" onClick={() => onAssignLane("factory")}>
            این قیمت کارخانه است
          </button>
          <button className="btn" type="button" onClick={() => onAssignLane("warehouse")}>
            این قیمت انبار است
          </button>
        </div>
      ) : null}

      {isOpenStatus(item.status) ? (
        catalogRow ? (
          <div className="review-actions">
            <button className="btn primary" type="button" onClick={() => onDecide("approved")}>
              تأیید این قیمت
            </button>
            <button className="btn danger" type="button" onClick={() => onDecide("rejected")}>
              نادرست
            </button>
            <button className="btn" type="button" onClick={() => onDecide("needs_more_review")}>
              بعداً
            </button>
          </div>
        ) : (
          <div className="review-actions">
            <button className="btn" type="button" onClick={() => onDecide("archived")}>
              بایگانی — در کاتالوگ ما نیست
            </button>
          </div>
        )
      ) : (
        <p className="muted">تصمیم ثبت شد. انتشار خودکار خاموش است.</p>
      )}
      <ControlledPublish item={item} />
    </article>
  );
}

function ControlledPublish({ item }: { item: QueueItem }) {
  const { forItem, record } = usePublishState();
  const existing = forItem(item.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allowed = canRequestPublish(item);

  async function publish() {
    if (!allowed) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queueItemId: item.id,
          productCode: item.productCode,
          brandId: item.brandId,
          brandName: item.brandName,
          factoryPrice: item.factoryPrice,
          warehousePrice: item.warehousePrice,
          unit: item.unit,
          priceDate: tehranDate(),
          reviewStatus: item.status,
          autoGenerated: false,
        }),
      });
      const payload = (await response.json()) as PublicationRecord & { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "انتشار انجام نشد.");
        return;
      }
      record({
        id: crypto.randomUUID(),
        queueItemId: payload.queueItemId,
        productCode: payload.productCode,
        brandId: payload.brandId,
        brandName: payload.brandName,
        factoryPrice: payload.factoryPrice,
        warehousePrice: payload.warehousePrice,
        unit: payload.unit,
        priceDate: payload.priceDate,
        idempotencyKey: payload.idempotencyKey,
        status: payload.status,
        autoGenerated: false,
        dryRun: payload.dryRun,
        websiteOperationId: payload.websiteOperationId,
        errorMessage: payload.errorMessage,
        requestedAt: new Date().toISOString(),
      });
    } catch {
      setError("سرویس انتشار در دسترس نیست.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="review-actions" style={{ marginTop: 12 }}>
      {existing ? (
        <p className="settings-banner">
          {publicationStatusLabel(existing.status)}
          {existing.dryRun ? " — کلید وب‌سایت نبود؛ در صف محلی ماند." : ""}
          {existing.errorMessage ? ` ${existing.errorMessage}` : ""}{" "}
          <Link to="/settings/publish">سابقه انتشار</Link>
        </p>
      ) : null}
      {allowed && !existing ? (
        <button className="btn primary" type="button" disabled={busy} onClick={() => void publish()}>
          {busy ? "در حال ارسال…" : "انتشار کنترل‌شده به وب‌سایت"}
        </button>
      ) : null}
      {item.status === "approved" && !allowed ? (
        <p className="settings-error">بدون sku یا بدون مبلغ مثبت، ارسال به وب‌سایت ممکن نیست. صفر ارسال نمی‌شود.</p>
      ) : null}
      {error ? <p className="settings-error">{error}</p> : null}
    </div>
  );
}
