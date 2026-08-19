import { useMemo, useState, type FormEvent } from "react";
import { addIntake, loadIntakes, saveIntakes, type IntakeRecord } from "../intake/rawStore";
import { PRODUCT_GROUPS } from "../mock/data";
import { categoryScopeLabel } from "../settings/sourceStore";
import { useSourceState } from "../settings/SourceState";

type Observation = {
  rawText: string;
  productCode: string | null;
  productName: string | null;
  brandId: string | null;
  brandName: string | null;
  matchMethod: string;
  factoryPrice: number | null;
  warehousePrice: number | null;
  unit: string | null;
  confidence: number;
  status: string;
  reasons: string[];
};

type ExtractResponse = {
  promptVersion: string;
  canPublish: false;
  observations: Observation[];
  error?: string;
};

function formatPrice(value: number | null): string {
  if (value === null) return "ناموجود";
  return value.toLocaleString("fa-IR");
}

export function IntakePage() {
  const { sources } = useSourceState();
  const activeSources = sources.filter((item) => item.isActive);
  const [sourceId, setSourceId] = useState(activeSources[0]?.id ?? "");
  const [scope, setScope] = useState("rebar/ribbed");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<IntakeRecord[]>(() => loadIntakes());

  const selected = useMemo(
    () => activeSources.find((item) => item.id === sourceId) ?? null,
    [activeSources, sourceId],
  );
  const [groupCode, categoryCode] = selected
    ? [selected.groupCode, selected.categoryCode]
    : scope.split("/");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const rawText = text.trim();
    if (!rawText) {
      setError("متن خام را وارد کنید. ورودی خالی استخراج نمی‌شود.");
      return;
    }
    if (!groupCode || !categoryCode) {
      setError("دسته را انتخاب کنید.");
      return;
    }
    const receivedAt = new Date().toISOString();
    const draft: IntakeRecord = {
      id: crypto.randomUUID(),
      sourceId: selected?.id ?? null,
      sourceName: selected?.name ?? "ورود آزمایشی بدون منبع ثبت‌شده",
      groupCode,
      categoryCode,
      rawText,
      receivedAt,
      promptVersion: null,
      canPublish: false,
      error: null,
      result: null,
    };
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: rawText,
          groupCode,
          categoryCode,
          sourceId: draft.sourceId,
        }),
      });
      const payload = (await response.json()) as ExtractResponse & { error?: string };
      if (!response.ok) {
        draft.error = payload.error ?? "استخراج انجام نشد.";
      } else {
        draft.promptVersion = payload.promptVersion;
        draft.result = payload;
      }
    } catch {
      draft.error = "سرویس استخراج در دسترس نیست. متن خام ذخیره شد.";
    }
    const next = addIntake(records, draft);
    saveIntakes(next);
    setRecords(next);
    setText("");
    setBusy(false);
  }

  return (
    <section className="desk desk-wide">
      <header className="page-head">
        <div>
          <p className="kicker">ورود خام</p>
          <h1>متن قیمت</h1>
        </div>
        <p className="page-head-note">
          دسته از منبع می‌آید. متن اصلی قبل از استخراج نگه داشته می‌شود. نتیجه مدل منتشر نمی‌شود.
        </p>
      </header>

      <form className="sheet settings-form" onSubmit={submit}>
        <label>
          منبع
          <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
            <option value="">ورود آزمایشی بدون منبع ثبت‌شده</option>
            {activeSources.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — {categoryScopeLabel(item.groupCode, item.categoryCode)}
              </option>
            ))}
          </select>
        </label>
        {selected ? (
          <p className="muted">دسته این منبع: {categoryScopeLabel(selected.groupCode, selected.categoryCode)}</p>
        ) : (
          <label>
            دسته
            <select value={scope} onChange={(event) => setScope(event.target.value)}>
              {PRODUCT_GROUPS.flatMap((group) =>
                group.categories.map((category) => (
                  <option key={`${group.code}/${category.code}`} value={`${group.code}/${category.code}`}>
                    {group.nameFa} · {category.nameFa}
                  </option>
                )),
              )}
            </select>
          </label>
        )}
        <label>
          متن خام
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={8}
            placeholder="متن قیمت لوله، تیرآهن، میلگرد یا دسته دیگر را اینجا بچسبانید."
          />
        </label>
        {error ? <p className="settings-error">{error}</p> : null}
        <div className="btn-row">
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "در حال استخراج…" : "ثبت متن و استخراج"}
          </button>
        </div>
      </form>

      <div className="sheet table-wrap" style={{ marginTop: 20 }}>
        <table className="price-table settings-table">
          <thead>
            <tr>
              <th>زمان</th>
              <th>منبع</th>
              <th>دسته</th>
              <th>متن خام</th>
              <th>وضعیت تطبیق</th>
              <th>انتشار</th>
            </tr>
          </thead>
          <tbody>
            {records.length ? (
              records.map((item) => {
                const observations = (item.result as ExtractResponse | null)?.observations ?? [];
                return (
                  <tr key={item.id}>
                    <td>{new Date(item.receivedAt).toLocaleString("fa-IR")}</td>
                    <td>{item.sourceName}</td>
                    <td>{categoryScopeLabel(item.groupCode, item.categoryCode)}</td>
                    <td>
                      <pre className="raw-preview">{item.rawText}</pre>
                    </td>
                    <td>
                      {item.error ? (
                        <span className="badge danger">خطا — خام ذخیره شد</span>
                      ) : observations.length ? (
                        <ul className="obs-list">
                          {observations.map((obs, index) => (
                            <li key={`${item.id}-${index}`}>
                              <strong>{obs.productName ?? "بدون تطبیق"}</strong>
                              {obs.brandName ? ` · ${obs.brandName}` : ""}
                              <div className="muted">
                                کارخانه {formatPrice(obs.factoryPrice)} · انبار {formatPrice(obs.warehousePrice)}
                              </div>
                              {obs.reasons.length ? <div className="muted">{obs.reasons.join("؛ ")}</div> : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="muted">بدون مشاهده</span>
                      )}
                    </td>
                    <td>
                      <span className="badge warning">خاموش</span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="muted">
                  هنوز ورودی خامی ثبت نشده است. اول متن ذخیره می‌شود، بعد استخراج.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
