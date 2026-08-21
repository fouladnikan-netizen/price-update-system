import { useMemo, useState, type FormEvent } from "react";
import { getCategoryBrands } from "../mock/category-brands";
import { SourcePicker } from "./SourcePicker";
import { useIntakeState } from "./IntakeState";
import { usePriceUpdate } from "./PriceUpdateState";
import type { IntakeKind, IntakeRecord } from "./rawStore";
import { SourceFormDialog } from "../settings/SourceFormDialog";
import { emptySourceInput, type SourceInput } from "../settings/sourceStore";
import { useSourceState } from "../settings/SourceState";

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

export function ManualIntakeModal({ onClose }: { onClose: () => void }) {
  const { sources, createSource } = useSourceState();
  const { recordIntake } = useIntakeState();
  const { applyIntakesToTable } = usePriceUpdate();
  const activeSources = sources.filter((item) => item.isActive);
  const [mode, setMode] = useState<IntakeKind>("text");
  const [sourceId, setSourceId] = useState(activeSources[0]?.id ?? "");
  const [draft, setDraft] = useState<SourceInput | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => activeSources.find((item) => item.id === sourceId) ?? null,
    [activeSources, sourceId],
  );

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

  function submitNewSource(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const created = createSource(draft, { allowIncomplete: true });
    if ("error" in created) {
      setFormError(created.error);
      return;
    }
    setSourceId(created.source.id);
    setDraft(null);
    setFormError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selected) {
      setError("منبع را انتخاب کنید.");
      return;
    }
    if (mode === "text" && !text.trim()) {
      setError("متن قیمت را وارد کنید.");
      return;
    }
    if (mode === "image" && !image) {
      setError("تصویر لیست قیمت را انتخاب کنید.");
      return;
    }
    const intake: IntakeRecord = {
      id: crypto.randomUUID(),
      sourceId: selected.id,
      sourceName: selected.name,
      groupCode: selected.groupCode,
      categoryCode: selected.categoryCode,
      priceCoverage: selected.priceCoverage,
      inputKind: mode,
      rawText: mode === "text" ? text.trim() : `تصویر: ${image?.name ?? ""}`,
      imageUrl: null,
      fileName: image?.name ?? null,
      receivedAt: new Date().toISOString(),
      promptVersion: null,
      canPublish: false,
      error: null,
      result: null,
    };
    setBusy(true);
    setError(null);
    try {
      if (mode === "text") {
        const response = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: intake.rawText,
            groupCode: selected.groupCode,
            categoryCode: selected.categoryCode,
          }),
        });
        const payload = (await response.json()) as { promptVersion?: string; error?: string };
        if (!response.ok) intake.error = payload.error ?? "استخراج انجام نشد.";
        else {
          intake.promptVersion = payload.promptVersion ?? null;
          intake.result = payload;
        }
      } else if (image) {
        const imageBase64 = await fileToBase64(image);
        const response = await fetch("/api/extract-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupCode: selected.groupCode,
            categoryCode: selected.categoryCode,
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
      }
    } catch {
      intake.error = "سرویس استخراج در دسترس نیست. ورودی خام ذخیره شد.";
    }
    recordIntake(intake);
    if (!intake.error) await applyIntakesToTable([intake]);
    setBusy(false);
    if (intake.error) {
      setError(intake.error);
      return;
    }
    onClose();
  }

  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <div className="popup popup-wide" role="dialog" aria-modal="true" aria-labelledby="manual-intake-title" onClick={(event) => event.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <p className="kicker">ورود دستی</p>
            <h2 id="manual-intake-title">متن یا تصویر قیمت</h2>
          </div>
          <button className="btn ghost" type="button" onClick={onClose}>
            بستن
          </button>
        </header>
        <form className="settings-form" onSubmit={(event) => void onSubmit(event)}>
          <nav className="settings-tabs" aria-label="نوع ورود">
            <button className={mode === "text" ? "active" : ""} type="button" onClick={() => setMode("text")}>
              متن
            </button>
            <button className={mode === "image" ? "active" : ""} type="button" onClick={() => setMode("image")}>
              تصویر
            </button>
          </nav>
          <SourcePicker
            sources={activeSources}
            value={sourceId}
            onChange={(source) => setSourceId(source.id)}
            onAddNew={() => {
              const input = emptySourceInput();
              if (mode === "image") input.sourceType = "image";
              setDraft(input);
            }}
          />
          {mode === "text" ? (
            <label>
              متن قیمت
              <textarea value={text} onChange={(event) => setText(event.target.value)} rows={7} placeholder="متن قیمت را اینجا بچسبانید." />
            </label>
          ) : (
            <label>
              تصویر لیست قیمت
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
            </label>
          )}
          {error ? <p className="settings-error">{error}</p> : null}
          <div className="btn-row">
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? "در حال استخراج…" : "ثبت و تطبیق"}
            </button>
          </div>
        </form>
      </div>
      {draft ? (
        <SourceFormDialog
          draft={draft}
          editing={false}
          error={formError}
          allowIncomplete
          kicker="ورود دستی"
          title="افزودن منبع"
          onChange={setDraft}
          onChangeScope={changeDraftScope}
          onClose={() => {
            setDraft(null);
            setFormError(null);
          }}
          onSubmit={submitNewSource}
        />
      ) : null}
    </div>
  );
}
