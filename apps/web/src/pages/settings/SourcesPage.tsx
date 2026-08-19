import { useMemo, useState, type FormEvent } from "react";
import { getCategoryBrands } from "../../mock/category-brands";
import { PRODUCT_GROUPS } from "../../mock/data";
import { useSourceState } from "../../settings/SourceState";
import {
  addressFieldCopy,
  INTAKE_MODES,
  PRICE_COVERAGES,
  SOURCE_TYPES,
  categoryScopeLabel,
  emptySourceInput,
  inputFromSource,
  intakeModeLabel,
  needsAddress,
  priceCoverageLabel,
  sourceTypeLabel,
  type PriceSource,
  type SourceInput,
  type SourceType,
} from "../../settings/sourceStore";

export function SourcesPage() {
  const { sources, saveSource, setActive, remove } = useSourceState();
  const [draft, setDraft] = useState<SourceInput | null>(null);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState("all");

  const visible = useMemo(() => {
    if (scopeFilter === "all") return sources;
    const [groupCode, categoryCode] = scopeFilter.split("/");
    return sources.filter((item) => item.groupCode === groupCode && item.categoryCode === categoryCode);
  }, [scopeFilter, sources]);

  function openCreate() {
    setDraft(emptySourceInput());
    setEditingId(undefined);
    setError(null);
  }

  function openEdit(source: PriceSource) {
    setDraft(inputFromSource(source));
    setEditingId(source.id);
    setError(null);
  }

  function changeScope(value: string) {
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

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const result = saveSource(draft, editingId);
    if (result) {
      setError(result);
      return;
    }
    setMessage(editingId ? "ساختار منبع به‌روز شد. اتصال خودکار هنوز فعال نیست." : "منبع ثبت شد. کالا یا برند جدید ساخته نشد.");
    setDraft(null);
    setEditingId(undefined);
    setError(null);
  }

  function confirmRemove(source: PriceSource) {
    if (!window.confirm(`منبع «${source.name}» حذف شود؟ کالا یا برند کاتالوگ تغییر نمی‌کند.`)) return;
    remove(source.id);
    setMessage("منبع حذف شد. کاتالوگ کالا و برند دست نخورده ماند.");
  }

  return (
    <>
      <div className="sheet-meta settings-toolbar">
        <div className="bulk-bar">
          <span>{visible.length.toLocaleString("fa-IR")} منبع</span>
          <select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)} aria-label="فیلتر دسته">
            <option value="all">همه دسته‌ها</option>
            {PRODUCT_GROUPS.flatMap((group) =>
              group.categories.map((category) => (
                <option key={`${group.code}/${category.code}`} value={`${group.code}/${category.code}`}>
                  {group.nameFa} · {category.nameFa}
                </option>
              )),
            )}
          </select>
        </div>
        <button className="btn primary" type="button" onClick={openCreate}>
          تعریف منبع
        </button>
      </div>
      {message ? <p className="settings-banner">{message}</p> : null}

      <div className="sheet table-wrap">
        <table className="price-table settings-table">
          <thead>
            <tr>
              <th>نام</th>
              <th>نوع</th>
              <th>دسته</th>
              <th>آدرس</th>
              <th>نوع قیمت</th>
              <th>زمان دریافت</th>
              <th>برندها</th>
              <th>وضعیت</th>
              <th>انتشار خودکار</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.length ? (
              visible.map((source) => (
                <tr key={source.id}>
                  <td>
                    <strong>{source.name}</strong>
                  </td>
                  <td>{sourceTypeLabel(source.sourceType)}</td>
                  <td>{categoryScopeLabel(source.groupCode, source.categoryCode)}</td>
                  <td>{source.address || "—"}</td>
                  <td>{priceCoverageLabel(source.priceCoverage)}</td>
                  <td>{intakeModeLabel(source.intakeMode)}</td>
                  <td>{source.brandIds.length.toLocaleString("fa-IR")} برند دسته</td>
                  <td>
                    <span className={`badge ${source.isActive ? "success" : ""}`}>
                      {source.isActive ? "فعال" : "غیرفعال"}
                    </span>
                  </td>
                  <td>
                    <span className="badge warning">خاموش</span>
                  </td>
                  <td>
                    <div className="btn-row">
                      <button className="btn slim" type="button" onClick={() => openEdit(source)}>
                        ویرایش
                      </button>
                      <button
                        className="btn slim"
                        type="button"
                        onClick={() => setActive(source.id, !source.isActive)}
                      >
                        {source.isActive ? "غیرفعال" : "فعال"}
                      </button>
                      <button className="btn slim danger" type="button" onClick={() => confirmRemove(source)}>
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="muted">
                  هنوز منبعی برای این محدوده تعریف نشده است. سایت، تلگرام و بله فعلاً فقط به‌صورت تعریف منبع ثبت می‌شوند.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {draft ? (
        <SourceFormDialog
          draft={draft}
          editing={Boolean(editingId)}
          error={error}
          onChange={setDraft}
          onChangeScope={changeScope}
          onClose={() => {
            setDraft(null);
            setEditingId(undefined);
            setError(null);
          }}
          onSubmit={submit}
        />
      ) : null}
    </>
  );
}

function SourceFormDialog({
  draft,
  editing,
  error,
  onChange,
  onChangeScope,
  onClose,
  onSubmit,
}: {
  draft: SourceInput;
  editing: boolean;
  error: string | null;
  onChange: (next: SourceInput) => void;
  onChangeScope: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const brands = getCategoryBrands(draft.groupCode, draft.categoryCode);
  const showAddress = needsAddress(draft.sourceType);
  const addressCopy = addressFieldCopy(draft.sourceType);

  function toggleBrand(id: string) {
    onChange({
      ...draft,
      brandIds: draft.brandIds.includes(id)
        ? draft.brandIds.filter((item) => item !== id)
        : [...draft.brandIds, id],
    });
  }

  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <div
        className="popup popup-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="drawer-head">
          <div>
            <p className="kicker">ساختار منبع</p>
            <h2 id="source-form-title">{editing ? "ویرایش منبع" : "تعریف منبع"}</h2>
          </div>
          <button className="btn ghost" type="button" onClick={onClose}>
            بستن
          </button>
        </header>
        <p className="muted">
          منبع به دسته وصل می‌شود، نه به ساخت کالای جدید. رمز تلگرام، بله و کلید API اینجا ذخیره نمی‌شود. انتشار
          خودکار خاموش است.
        </p>
        <form className="settings-form" onSubmit={onSubmit}>
          <label>
            نام منبع
            <input
              value={draft.name}
              onChange={(event) => onChange({ ...draft, name: event.target.value })}
              required
            />
          </label>
          <label>
            نوع منبع
            <select
              value={draft.sourceType}
              onChange={(event) => onChange({ ...draft, sourceType: event.target.value as SourceType })}
            >
              {SOURCE_TYPES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            دسته مرتبط
            <select value={`${draft.groupCode}/${draft.categoryCode}`} onChange={(event) => onChangeScope(event.target.value)}>
              {PRODUCT_GROUPS.flatMap((group) =>
                group.categories.map((category) => (
                  <option key={`${group.code}/${category.code}`} value={`${group.code}/${category.code}`}>
                    {group.nameFa} · {category.nameFa}
                  </option>
                )),
              )}
            </select>
          </label>
          <label>
            {addressCopy.label}
            <input
              value={draft.address}
              onChange={(event) => onChange({ ...draft, address: event.target.value })}
              required={showAddress}
              placeholder={addressCopy.placeholder}
            />
          </label>
          <label>
            نوع قیمت
            <select
              value={draft.priceCoverage}
              onChange={(event) => onChange({ ...draft, priceCoverage: event.target.value as SourceInput["priceCoverage"] })}
            >
              {PRICE_COVERAGES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            زمان دریافت
            <select
              value={draft.intakeMode}
              onChange={(event) => onChange({ ...draft, intakeMode: event.target.value as SourceInput["intakeMode"] })}
            >
              {INTAKE_MODES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="brand-fieldset">
            <legend>برندهای قابل پوشش</legend>
            <p className="muted">فقط برندهای ثبت‌شده همین دسته. خالی یعنی منبع بدون تگ برند است، نه ساخت برند جدید.</p>
            <div className="filter-menu-actions">
              <button
                type="button"
                className="btn slim"
                onClick={() => onChange({ ...draft, brandIds: brands.map((item) => item.id) })}
              >
                همه برندهای دسته
              </button>
              <button type="button" className="btn slim" onClick={() => onChange({ ...draft, brandIds: [] })}>
                هیچ‌کدام
              </button>
            </div>
            {brands.length ? (
              <ul className="picker-list">
                {brands.map((brand) => (
                  <li key={brand.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={draft.brandIds.includes(brand.id)}
                        onChange={() => toggleBrand(brand.id)}
                      />
                      <span>{brand.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">این دسته در خروجی وب‌سایت برند ندارد.</p>
            )}
          </fieldset>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) => onChange({ ...draft, isActive: event.target.checked })}
            />
            منبع فعال است
          </label>
          <label className="inline-check">
            <input type="checkbox" checked={false} disabled />
            انتشار خودکار — در پایلوت خاموش و قفل است
          </label>
          {error ? <p className="settings-error">{error}</p> : null}
          <div className="btn-row">
            <button className="btn primary" type="submit">
              ثبت منبع
            </button>
            <button className="btn ghost" type="button" onClick={onClose}>
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
