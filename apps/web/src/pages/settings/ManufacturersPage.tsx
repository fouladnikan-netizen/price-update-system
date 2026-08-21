import { useState, type FormEvent } from "react";
import { PRODUCT_GROUPS } from "../../mock/data";
import { useProducerState } from "../../settings/ProducerState";
import { categoryLabel } from "../../settings/producerStore";
import { ResizableTable, ResizableTh } from "../../tables/ResizableTh";

export function ManufacturersPage() {
  const { manufacturers, submitManufacturerForm } = useProducerState();
  const [open, setOpen] = useState(false);
  const [groupCode, setGroupCode] = useState(PRODUCT_GROUPS[0]?.code ?? "");
  const [categoryCode, setCategoryCode] = useState(PRODUCT_GROUPS[0]?.categories[0]?.code ?? "");
  const [brandName, setBrandName] = useState("");
  const [officialName, setOfficialName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = submitManufacturerForm({ groupCode, categoryCode, brandName, officialName });
    if (!result.ok) {
      setError(result.error);
      setMessage(null);
      return;
    }
    setError(null);
    setMessage(
      result.updatedOfficialName
        ? "برند از قبل در این دسته بود. نام رسمی به‌روز شد. کالای جدیدی ساخته نشد."
        : "برند وب‌سایت در فهرست این دسته ثبت شد.",
    );
    setBrandName("");
    setOfficialName("");
    setOpen(false);
  }

  return (
    <>
      <div className="sheet-meta settings-toolbar">
        <span>{manufacturers.length.toLocaleString("fa-IR")} تولیدکننده از خروجی وب‌سایت</span>
        <button className="btn primary" type="button" onClick={() => setOpen(true)}>
          اضافه کردن
        </button>
      </div>
      {message ? <p className="settings-banner">{message}</p> : null}

      <div className="sheet table-wrap">
        <ResizableTable id="manufacturers" className="price-table settings-table">
          <thead>
            <tr>
              <ResizableTh id="brand">برند</ResizableTh>
              <ResizableTh id="official">نام رسمی</ResizableTh>
              <ResizableTh id="category">دسته</ResizableTh>
              <ResizableTh id="code">کد</ResizableTh>
            </tr>
          </thead>
          <tbody>
            {manufacturers.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.brandName}</strong>
                </td>
                <td>{item.officialName || "—"}</td>
                <td>{categoryLabel(item.groupCode, item.categoryCode)}</td>
                <td className="code cell-clip">{item.id}</td>
              </tr>
            ))}
          </tbody>
        </ResizableTable>
      </div>

      {open ? (
        <div className="drawer-backdrop" onClick={() => setOpen(false)} role="presentation">
          <div
            className="popup"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-mfr-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="drawer-head">
              <div>
                <p className="kicker">ثبت تولیدکننده</p>
                <h2 id="add-mfr-title">افزودن از وب‌سایت</h2>
              </div>
              <button className="btn ghost" type="button" onClick={() => setOpen(false)}>
                بستن
              </button>
            </header>
            <p className="muted">
              سه فیلد باید با خروجی وب‌سایت یکی باشد. کد یکتا ساخته نمی‌شود؛ همان شناسه محلی دسته تا آمدن
              brand_id وب‌سایت می‌ماند.
            </p>
            <form className="settings-form" onSubmit={submit}>
              <label>
                دسته محصول
                <select
                  value={`${groupCode}/${categoryCode}`}
                  onChange={(event) => {
                    const [nextGroup, nextCategory] = event.target.value.split("/");
                    setGroupCode(nextGroup ?? "");
                    setCategoryCode(nextCategory ?? "");
                  }}
                >
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
                نام برند
                <input value={brandName} onChange={(event) => setBrandName(event.target.value)} required />
              </label>
              <label>
                نام رسمی تولیدکننده
                <input value={officialName} onChange={(event) => setOfficialName(event.target.value)} required />
              </label>
              {error ? <p className="settings-error">{error}</p> : null}
              <div className="btn-row">
                <button className="btn primary" type="submit">
                  ثبت
                </button>
                <button className="btn ghost" type="button" onClick={() => setOpen(false)}>
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
