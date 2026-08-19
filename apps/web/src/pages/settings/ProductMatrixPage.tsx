import { useEffect, useMemo, useRef, useState } from "react";
import {
  getAllCatalogProducts,
  getUiCategoryCode,
  type CatalogProduct,
} from "../../mock/catalog";
import {
  EXCEL_COLUMNS,
  catalogColumnRow,
  displayExcelValue,
  visibleExcelColumns,
  type ExcelCatalogFields,
} from "../../mock/catalogColumns";
import { useProducerState } from "../../settings/ProducerState";
import type { Manufacturer } from "../../settings/producerStore";

type FilterKey = keyof ExcelCatalogFields;
type Filters = Partial<Record<FilterKey, string[]>>;
type MatrixRow = { product: CatalogProduct; columns: ReturnType<typeof catalogColumnRow> };

function matchesFilters(columns: ExcelCatalogFields, filters: Filters, except?: FilterKey): boolean {
  return EXCEL_COLUMNS.every(({ key }) => {
    if (key === except) return true;
    const allowed = filters[key];
    if (!allowed) return true;
    return allowed.includes(columns[key] ?? "");
  });
}

function uniqueColumnValues(source: MatrixRow[], key: FilterKey): string[] {
  const values = new Set(source.map(({ columns }) => columns[key] ?? ""));
  return [...values].sort((a, b) => {
    if (a === b) return 0;
    if (a === "") return 1;
    if (b === "") return -1;
    return a.localeCompare(b, "fa", { numeric: true });
  });
}

export function ProductMatrixPage() {
  const products = useMemo(() => getAllCatalogProducts(), []);
  const rows = useMemo(() => products.map((product) => ({ product, columns: catalogColumnRow(product) })), [products]);
  const { activeForProduct, manufacturersInCategory, setTag, setTagsBulk } = useProducerState();
  const [filters, setFilters] = useState<Filters>({});
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [picker, setPicker] = useState<CatalogProduct | null>(null);
  const [bulkBrandId, setBulkBrandId] = useState("");

  const visible = useMemo(
    () => rows.filter(({ columns }) => matchesFilters(columns, filters)),
    [filters, rows],
  );

  const tableColumns = visibleExcelColumns(visible.map(({ columns }) => columns));
  const selectedProducts = visible.filter(({ columns }) => selected.has(columns.key)).map((item) => item.product);

  const bulkBrands = useMemo(() => {
    const map = new Map<string, Manufacturer>();
    for (const product of selectedProducts) {
      for (const brand of manufacturersInCategory(product.groupCode, getUiCategoryCode(product))) {
        map.set(brand.id, brand);
      }
    }
    return [...map.values()];
  }, [manufacturersInCategory, selectedProducts]);

  function applyColumnFilter(key: FilterKey, selectedValues: string[] | undefined) {
    setFilters((current) => {
      const next = { ...current };
      if (!selectedValues) delete next[key];
      else next[key] = selectedValues;
      return next;
    });
    setOpenFilter(null);
  }

  function toggleRow(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAllVisible() {
    const keys = visible.map(({ columns }) => columns.key);
    const allOn = keys.every((key) => selected.has(key));
    setSelected(allOn ? new Set() : new Set(keys));
  }

  return (
    <>
      <div className="sheet-meta settings-toolbar">
        <span>
          {visible.length.toLocaleString("fa-IR")} کالا · ستون‌ها مطابق کاتالوگ اکسل · سلول خالی و NULL نمایش داده نمی‌شود
        </span>
        {selectedProducts.length ? (
          <div className="bulk-bar">
            <span>{selectedProducts.length.toLocaleString("fa-IR")} انتخاب‌شده</span>
            <select value={bulkBrandId} onChange={(event) => setBulkBrandId(event.target.value)}>
              <option value="">برند برای اعمال گروهی</option>
              {bulkBrands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.brandName}
                </option>
              ))}
            </select>
            <button
              className="btn slim"
              type="button"
              disabled={!bulkBrandId}
              onClick={() => setTagsBulk(selectedProducts, bulkBrandId, false)}
            >
              حذف تگ از انتخاب‌شده‌ها
            </button>
            <button
              className="btn slim"
              type="button"
              disabled={!bulkBrandId}
              onClick={() => setTagsBulk(selectedProducts, bulkBrandId, true)}
            >
              بازگرداندن تگ
            </button>
          </div>
        ) : (
          <span className="muted">برای حذف گروهی تگ، چند ردیف را انتخاب کنید</span>
        )}
      </div>

      <div className="sheet table-wrap matrix-wrap">
        <table className="price-table settings-table matrix-table">
          <thead>
            <tr>
              <th className="col-check">
                <input
                  type="checkbox"
                  checked={visible.length > 0 && visible.every(({ columns }) => selected.has(columns.key))}
                  onChange={toggleAllVisible}
                  aria-label="انتخاب همه ردیف‌های فیلترشده"
                />
              </th>
              {tableColumns.map((column) => {
                const options = uniqueColumnValues(
                  rows.filter(({ columns }) => matchesFilters(columns, filters, column.key)),
                  column.key,
                );
                return (
                  <th key={column.key}>
                    <div className="filter-pop">
                      <button
                        className={`filter-head ${filters[column.key] ? "is-on" : ""}`}
                        type="button"
                        onClick={() => setOpenFilter((current) => (current === column.key ? null : column.key))}
                      >
                        {column.label}
                        <span aria-hidden>▾</span>
                      </button>
                      {openFilter === column.key ? (
                        <ColumnFilterMenu
                          options={options}
                          applied={filters[column.key]}
                          onApply={(selectedValues) => applyColumnFilter(column.key, selectedValues)}
                          onClose={() => setOpenFilter(null)}
                        />
                      ) : null}
                    </div>
                  </th>
                );
              })}
              <th>تولیدکنندگان</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ product, columns }) => {
              const active = activeForProduct(product);
              const preview = active
                .slice(0, 3)
                .map((item) => item.brandName)
                .join("، ");
              return (
                <tr key={columns.key}>
                  <td className="col-check">
                    <input
                      type="checkbox"
                      checked={selected.has(columns.key)}
                      onChange={() => toggleRow(columns.key)}
                      aria-label={`انتخاب ${product.name}`}
                    />
                  </td>
                  {tableColumns.map((column) => (
                    <td key={column.key}>{displayExcelValue(columns[column.key])}</td>
                  ))}
                  <td>
                    <button className="producer-chip" type="button" onClick={() => setPicker(product)}>
                      <span className="producer-icon" aria-hidden>
                        ⚙
                      </span>
                      <span>
                        {active.length.toLocaleString("fa-IR")} برند
                        {preview ? ` · ${preview}` : ""}
                        {active.length > 3 ? "…" : ""}
                      </span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {picker ? (
        <ProducerPicker
          product={picker}
          brands={manufacturersInCategory(picker.groupCode, getUiCategoryCode(picker))}
          activeIds={new Set(activeForProduct(picker).map((item) => item.id))}
          onToggle={(brandId, active) => setTag(picker, brandId, active)}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </>
  );
}

function ColumnFilterMenu({
  options,
  applied,
  onApply,
  onClose,
}: {
  options: string[];
  applied: string[] | undefined;
  onApply: (selected: string[] | undefined) => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Set<string>>(() => new Set(applied ?? options));
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const visibleOptions = options.filter((value) => {
    const haystack = (value || "خالی").toLocaleLowerCase("fa");
    return haystack.includes(query.trim().toLocaleLowerCase("fa"));
  });

  function commit(next: Set<string>) {
    if (next.size === options.length) onApply(undefined);
    else onApply([...next]);
  }

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const wrap = rootRef.current?.parentElement;
      if (!wrap?.contains(event.target as Node)) commit(draftRef.current);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onApply, onClose, options.length]);

  function toggleValue(value: string) {
    setDraft((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function setVisible(checked: boolean) {
    setDraft((current) => {
      const next = new Set(current);
      for (const value of visibleOptions) {
        if (checked) next.add(value);
        else next.delete(value);
      }
      return next;
    });
  }

  return (
    <div className="filter-menu" ref={rootRef} role="dialog" aria-label="فیلتر ستون">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="جستجو در مقادیر"
        autoFocus
      />
      <div className="filter-menu-actions">
        <button type="button" className="btn slim" onClick={() => setVisible(true)}>
          فعال کردن همه
        </button>
        <button type="button" className="btn slim" onClick={() => setVisible(false)}>
          غیرفعال کردن همه
        </button>
      </div>
      <div className="filter-menu-list">
        {visibleOptions.length ? (
          visibleOptions.map((value) => (
            <label key={value || "__empty__"}>
              <input type="checkbox" checked={draft.has(value)} onChange={() => toggleValue(value)} />
              {value || "خالی"}
            </label>
          ))
        ) : (
          <p className="muted">مقداری پیدا نشد.</p>
        )}
      </div>
      <div className="filter-menu-actions">
        <button type="button" className="btn slim primary" onClick={() => commit(draft)}>
          اعمال
        </button>
        <button type="button" className="btn slim ghost" onClick={onClose}>
          بستن
        </button>
      </div>
    </div>
  );
}

function ProducerPicker({
  product,
  brands,
  activeIds,
  onToggle,
  onClose,
}: {
  product: CatalogProduct;
  brands: Manufacturer[];
  activeIds: Set<string>;
  onToggle: (brandId: string, active: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <div
        className="popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="producer-picker-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="drawer-head">
          <div>
            <p className="kicker">تگ تولیدکننده</p>
            <h2 id="producer-picker-title">{product.name}</h2>
          </div>
          <button className="btn ghost" type="button" onClick={onClose}>
            بستن
          </button>
        </header>
        <p className="muted">
          پیش‌فرض همه برندهای این دسته‌اند. برداشتن تیک فقط تگ را قطع می‌کند؛ کالا و برند در داده می‌مانند.
        </p>
        {brands.length ? (
          <ul className="picker-list">
            {brands.map((brand) => {
              const checked = activeIds.has(brand.id);
              return (
                <li key={brand.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(brand.id, !checked)}
                    />
                    <span>
                      <strong>{brand.brandName}</strong>
                      <small className="muted">{brand.officialName}</small>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">این دسته در خروجی وب‌سایت فهرست برند ندارد. نبود برند خطا نیست.</p>
        )}
      </div>
    </div>
  );
}
