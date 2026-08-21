import { useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getCategoryBrands } from "../mock/category-brands";
import { parseExtractResult } from "../intake/extractTypes";
import { useIntakeState } from "../intake/IntakeState";
import { SourcePicker } from "../intake/SourcePicker";
import type { IntakeKind, IntakeRecord } from "../intake/rawStore";
import { SourceFormDialog } from "../settings/SourceFormDialog";
import { ResizableTable, ResizableTh } from "../tables/ResizableTh";
import {
  categoryScopeLabel,
  emptySourceInput,
  type PriceSource,
  type SourceInput,
} from "../settings/sourceStore";
import { useSourceState } from "../settings/SourceState";

function formatPrice(value: number | null): string {
  if (value === null) return "ناموجود";
  return value.toLocaleString("fa-IR");
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function IntakePage() {
  const { sources, createSource } = useSourceState();
  const { intakes, recordIntake } = useIntakeState();
  const activeSources = sources.filter((item) => item.isActive);
  const [mode, setMode] = useState<IntakeKind>("text");
  const [sourceId, setSourceId] = useState("");
  const [draft, setDraft] = useState<SourceInput | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [needSource, setNeedSource] = useState(false);
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  const [sourceNote, setSourceNote] = useState<string | null>(null);
  const pendingKind = useRef<IntakeKind | null>(null);

  const selected = useMemo(
    () => activeSources.find((item) => item.id === sourceId) ?? null,
    [activeSources, sourceId],
  );

  function pickImage(file: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setImage(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  function openNewSource() {
    const input = emptySourceInput();
    if (mode === "image") input.sourceType = "image";
    setDraft(input);
    setFormError(null);
  }

  function closeNeedSource() {
    pendingKind.current = null;
    setNeedSource(false);
  }

  function changeDraftScope(value: string) {
    const [groupCode, categoryCode] = value.split("/");
    setDraft((current) =>
      current
        ? {
            ...current,
            groupCode: groupCode ?? "",
            categoryCode: categoryCode ?? "",
            brandIds: getCategoryBrands(groupCode, categoryCode).map((item) => item.id),
          }
        : current,
    );
  }

  function pickSource(source: PriceSource) {
    if (needSource || pendingKind.current) {
      finishWithSource(source);
      return;
    }
    setSourceId(source.id);
  }

  function finishWithSource(source: PriceSource) {
    const kind = pendingKind.current;
    pendingKind.current = null;
    setSourceId(source.id);
    setNeedSource(false);
    setDraft(null);
    if (kind) void extractWithSource(source, kind);
  }

  function submitNewSource(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const created = createSource(draft, { allowIncomplete: true });
    if ("error" in created) {
      setFormError(created.error);
      return;
    }
    const willContinue = Boolean(pendingKind.current);
    setSourceNote(
      willContinue
        ? `منبع «${created.source.name}» ثبت شد. استخراج ادامه می‌یابد.`
        : `منبع «${created.source.name}» به فهرست منابع اضافه شد.`,
    );
    finishWithSource(created.source);
  }

  function baseDraft(source: PriceSource): IntakeRecord {
    return {
      id: crypto.randomUUID(),
      sourceId: source.id,
      sourceName: source.name,
      groupCode: source.groupCode,
      categoryCode: source.categoryCode,
      priceCoverage: source.priceCoverage,
      inputKind: mode,
      rawText: "",
      imageUrl: null,
      fileName: null,
      receivedAt: new Date().toISOString(),
      promptVersion: null,
      canPublish: false,
      error: null,
      result: null,
    };
  }

  async function extractWithSource(source: PriceSource, kind: IntakeKind) {
    if (kind === "text") {
      const rawText = text.trim();
      if (!rawText) {
        setError("متن خام را وارد کنید. ورودی خالی استخراج نمی‌شود.");
        return;
      }
      const intake = { ...baseDraft(source), rawText };
      setBusy(true);
      setError(null);
      try {
        const response = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: rawText,
            groupCode: source.groupCode,
            categoryCode: source.categoryCode,
            sourceId: source.id,
          }),
        });
        const payload = (await response.json()) as { promptVersion?: string; error?: string };
        if (!response.ok) intake.error = payload.error ?? "استخراج انجام نشد.";
        else {
          intake.promptVersion = payload.promptVersion ?? null;
          intake.result = payload;
        }
      } catch {
        intake.error = "سرویس استخراج در دسترس نیست. متن خام ذخیره شد.";
      }
      recordIntake(intake);
      setLastId(intake.id);
      setText("");
      setBusy(false);
      return;
    }

    if (!image) {
      setError("تصویر لیست قیمت را انتخاب کنید.");
      return;
    }
    const intake = {
      ...baseDraft(source),
      inputKind: "image" as const,
      rawText: `تصویر: ${image.name}`,
      fileName: image.name,
    };
    setBusy(true);
    setError(null);
    try {
      const imageBase64 = await fileToBase64(image);
      const response = await fetch("/api/extract-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupCode: source.groupCode,
          categoryCode: source.categoryCode,
          sourceId: source.id,
          fileName: image.name,
          mimeType: image.type || "image/jpeg",
          imageBase64,
        }),
      });
      const payload = (await response.json()) as {
        promptVersion?: string;
        error?: string;
        rawFile?: { url: string; fileName: string };
      };
      intake.imageUrl = payload.rawFile?.url ?? null;
      intake.fileName = payload.rawFile?.fileName ?? image.name;
      if (!response.ok) intake.error = payload.error ?? "استخراج تصویر انجام نشد.";
      else {
        intake.promptVersion = payload.promptVersion ?? null;
        intake.result = payload;
      }
    } catch {
      intake.error = "سرویس استخراج در دسترس نیست. اگر فایل ذخیره شده باشد در صف می‌ماند.";
    }
    recordIntake(intake);
    setLastId(intake.id);
    pickImage(null);
    setBusy(false);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (mode === "text" && !text.trim()) {
      setError("متن خام را وارد کنید. ورودی خالی استخراج نمی‌شود.");
      return;
    }
    if (mode === "image" && !image) {
      setError("تصویر لیست قیمت را انتخاب کنید.");
      return;
    }
    if (!selected) {
      pendingKind.current = mode;
      setNeedSource(true);
      setError(null);
      return;
    }
    void extractWithSource(selected, mode);
  }

  const picker = (
    <SourcePicker
      sources={activeSources}
      value={sourceId}
      onChange={pickSource}
      onAddNew={openNewSource}
    />
  );

  return (
    <section className="desk desk-wide">
      <header className="page-head">
        <div>
          <p className="kicker">ورود خام</p>
          <h1>متن یا تصویر قیمت</h1>
        </div>
        <p className="page-head-note">
          متن یا تصویر را بفرستید. قیمت خوانده می‌شود و با کالای وب‌سایت تطبیق می‌گردد. اگر کارخانه یا انبار در پیام مشخص
          نباشد، در صف بررسی از شما پرسیده می‌شود. ثبت در جدول همان تغییر را برای وب‌سایت صف می‌کند.
        </p>
      </header>

      <nav className="settings-tabs" aria-label="نوع ورود">
        <button className={mode === "text" ? "active" : ""} type="button" onClick={() => setMode("text")}>
          متن
        </button>
        <button className={mode === "image" ? "active" : ""} type="button" onClick={() => setMode("image")}>
          تصویر
        </button>
      </nav>

      <form className="sheet settings-form" onSubmit={onSubmit}>
        {picker}
        {selected ? (
          <p className="muted">
            دسته این منبع: {categoryScopeLabel(selected.groupCode, selected.categoryCode)}
          </p>
        ) : null}
        {mode === "text" ? (
          <label>
            متن خام
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={8}
              placeholder="متن قیمت لوله، تیرآهن، میلگرد یا دسته دیگر را اینجا بچسبانید."
            />
          </label>
        ) : (
          <label>
            تصویر لیست قیمت
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) => pickImage(event.target.files?.[0] ?? null)}
            />
            {preview ? <img className="raw-image" src={preview} alt="پیش‌نمایش تصویر خام" /> : null}
            <span className="muted">JPEG، PNG، WebP یا GIF تا ۸ مگابایت. فایل قبل از استخراج ذخیره می‌شود.</span>
          </label>
        )}
        {error ? <p className="settings-error">{error}</p> : null}
        {sourceNote ? <p className="settings-banner">{sourceNote}</p> : null}
        {lastId ? (
          <p className="settings-banner">
            ورودی خام ثبت شد و به صف بررسی رفت.{" "}
            <Link to="/review">باز کردن صف</Link>
            {" · "}
            <Link to="/settings/sources">فهرست منابع</Link>
          </p>
        ) : null}
        <div className="btn-row">
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "در حال استخراج…" : mode === "image" ? "ثبت تصویر و استخراج" : "ثبت متن و استخراج"}
          </button>
        </div>
      </form>

      <div className="sheet table-wrap" style={{ marginTop: 20 }}>
        <ResizableTable id="intake" className="price-table settings-table">
          <thead>
            <tr>
              <ResizableTh id="time">زمان</ResizableTh>
              <ResizableTh id="source">منبع</ResizableTh>
              <ResizableTh id="raw">ورودی خام</ResizableTh>
              <ResizableTh id="match">وضعیت تطبیق</ResizableTh>
            </tr>
          </thead>
          <tbody>
            {intakes.length ? (
              intakes.map((item) => {
                const observations = parseExtractResult(item.result)?.observations ?? [];
                return (
                  <tr key={item.id}>
                    <td className="cell-nowrap">
                      {new Date(item.receivedAt).toLocaleString("fa-IR")}
                      <div className="muted">{categoryScopeLabel(item.groupCode, item.categoryCode)}</div>
                    </td>
                    <td>{item.sourceName}</td>
                    <td>
                      {item.imageUrl ? (
                        <div>
                          <img className="raw-thumb" src={item.imageUrl} alt={item.fileName ?? "تصویر خام"} />
                          <div className="muted">{item.fileName ?? "تصویر"}</div>
                        </div>
                      ) : (
                        <pre className="raw-preview">{item.rawText}</pre>
                      )}
                    </td>
                    <td>
                      {item.error ? (
                        <span className="badge danger">خطا — خام ذخیره شد</span>
                      ) : observations.length ? (
                        <ul className="obs-list">
                          {observations.slice(0, 4).map((obs, index) => (
                            <li key={`${item.id}-${index}`}>
                              <strong>{obs.productName ?? "خارج از کاتالوگ"}</strong>
                              {obs.brandName ? ` · ${obs.brandName}` : ""}
                              <div className="muted">
                                کارخانه {formatPrice(obs.factoryPrice)} · انبار {formatPrice(obs.warehousePrice)}
                              </div>
                            </li>
                          ))}
                          {observations.length > 4 ? (
                            <li className="muted">{(observations.length - 4).toLocaleString("fa-IR")} مورد دیگر در صف</li>
                          ) : null}
                        </ul>
                      ) : (
                        <span className="muted">بدون مشاهده</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="muted">
                  هنوز ورودی خامی ثبت نشده است. متن یا تصویر اول ذخیره می‌شود، بعد استخراج.
                </td>
              </tr>
            )}
          </tbody>
        </ResizableTable>
      </div>

      {needSource ? (
        <div className="drawer-backdrop" onClick={closeNeedSource} role="presentation">
          <div
            className="popup"
            role="dialog"
            aria-modal="true"
            aria-labelledby="need-source-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="drawer-head">
              <div>
                <p className="kicker">منبع قیمت</p>
                <h2 id="need-source-title">منبع را انتخاب کنید</h2>
              </div>
              <button className="btn ghost" type="button" onClick={closeNeedSource}>
                بستن
              </button>
            </header>
            <p className="muted">بدون منبع، ورودی ثبت نمی‌شود. از فهرست انتخاب کنید یا منبع جدید بسازید.</p>
            <SourcePicker
              sources={activeSources}
              value={sourceId}
              onChange={pickSource}
              onAddNew={openNewSource}
              openOnMount
            />
          </div>
        </div>
      ) : null}

      {draft ? (
        <SourceFormDialog
          draft={draft}
          editing={false}
          error={formError}
          allowIncomplete
          kicker="ورود خام"
          title="افزودن منبع جدید"
          onChange={setDraft}
          onChangeScope={changeDraftScope}
          onClose={() => {
            setDraft(null);
            setFormError(null);
          }}
          onSubmit={submitNewSource}
        />
      ) : null}
    </section>
  );
}
