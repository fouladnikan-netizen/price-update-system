import { getCategoryBrands } from "../mock/category-brands";
import { PRODUCT_GROUPS } from "../mock/data";
import {
  addressFieldCopy,
  INTAKE_MODES,
  PRICE_COVERAGES,
  SOURCE_TYPES,
  TAX_MODES,
  TELEGRAM_COLLECT_PAUSED,
  needsAddress,
  type SourceInput,
  type SourceType,
} from "./sourceStore";
import type { FormEvent } from "react";

export function SourceFormDialog({
  draft,
  editing,
  error,
  allowIncomplete = false,
  title,
  kicker,
  onChange,
  onChangeScope,
  onClose,
  onSubmit,
}: {
  draft: SourceInput;
  editing: boolean;
  error: string | null;
  allowIncomplete?: boolean;
  title?: string;
  kicker?: string;
  onChange: (next: SourceInput) => void;
  onChangeScope: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const brands = getCategoryBrands(draft.groupCode, draft.categoryCode);
  const showAddress = needsAddress(draft.sourceType);
  const addressRequired = showAddress && !allowIncomplete;
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
            <p className="kicker">{kicker ?? "ساختار منبع"}</p>
            <h2 id="source-form-title">{title ?? (editing ? "ویرایش منبع" : "تعریف منبع")}</h2>
          </div>
          <button className="btn ghost" type="button" onClick={onClose}>
            بستن
          </button>
        </header>
        <p className="muted">
          منبع به دسته وصل می‌شود، نه به ساخت کالای جدید. رمز تلگرام، بله و کلید API اینجا ذخیره نمی‌شود. انتشار
          خودکار خاموش است.
        </p>
        {allowIncomplete ? (
          <p className="muted">
            آدرس را می‌توان خالی گذاشت. هویت رسمی بعداً پیشنهاد می‌شود و ورود قیمت را متوقف نمی‌کند.
          </p>
        ) : null}
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
            گروه
            <select
              value={draft.groupCode}
              onChange={(event) => {
                const nextGroup = PRODUCT_GROUPS.find((item) => item.code === event.target.value);
                const nextCategory = nextGroup?.categories[0]?.code ?? "";
                onChangeScope(`${event.target.value}/${nextCategory}`);
              }}
            >
              {PRODUCT_GROUPS.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.nameFa}
                </option>
              ))}
            </select>
          </label>
          <label>
            دسته
            <select
              value={draft.categoryCode}
              onChange={(event) => onChangeScope(`${draft.groupCode}/${event.target.value}`)}
            >
              {(PRODUCT_GROUPS.find((item) => item.code === draft.groupCode)?.categories ?? []).map((item) => (
                <option key={item.code} value={item.code}>
                  {item.nameFa}
                </option>
              ))}
            </select>
          </label>
          <label>
            {addressCopy.label}
            <input
              value={draft.address}
              onChange={(event) => onChange({ ...draft, address: event.target.value })}
              required={addressRequired}
              placeholder={addressCopy.placeholder}
            />
          </label>
          {TELEGRAM_COLLECT_PAUSED && draft.sourceType === "telegram" ? (
            <p className="muted">جمع‌آوری تلگرام فعلاً متوقف است. برای کانال پیام‌رسان از نوع «کانال بله» استفاده کنید.</p>
          ) : null}
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
            مالیات ارزش افزوده
            <select
              value={draft.taxMode}
              onChange={(event) => onChange({ ...draft, taxMode: event.target.value as SourceInput["taxMode"] })}
            >
              {TAX_MODES.map((item) => (
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
