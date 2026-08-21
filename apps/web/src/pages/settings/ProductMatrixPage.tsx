import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BrandTabs } from "../../components/BrandTabs";
import {
  getAllCatalogProducts,
  getUiCategoryCode,
  GROUP_DISPLAY_ORDER,
  type CatalogProduct,
} from "../../mock/catalog";
import { getProductGroup } from "../../mock/data";
import {
  EXCEL_COLUMNS,
  catalogColumnRow,
  displayExcelValue,
  visibleExcelColumns,
  type ExcelCatalogFields,
} from "../../mock/catalogColumns";
import { useProducerState } from "../../settings/ProducerState";
import type { Manufacturer } from "../../settings/producerStore";
import { ColumnResizeProvider, ResizableTh, useResizableTableClass } from "../../tables/ResizableTh";

type FilterKey = keyof ExcelCatalogFields;
type Filters = Partial<Record<FilterKey, string[]>>;
type MatrixRow = { product: CatalogProduct; columns: ReturnType<typeof catalogColumnRow> };
type GroupCode = (typeof GROUP_DISPLAY_ORDER)[number];

const GROUP_TABS = GROUP_DISPLAY_ORDER.map((code) => ({
  id: code,
  name: getProductGroup(code)?.nameFa ?? code,
}));

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
  const [selectedGroup, setSelectedGroup] = useState<GroupCode>("rebar");
  const [filters, setFilters] = useState<Filters>({});
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [picker, setPicker] = useState<CatalogProduct | null>(null);
  const [bulkBrandId, setBulkBrandId] = useState("");

  const groupRows = useMemo(
    () => rows.filter(({ product }) => product.groupCode === selectedGroup),
    [rows, selectedGroup],
  );
  const visible = useMemo(
    () => groupRows.filter(({ columns }) => matchesFilters(columns, filters)),
    [filters, groupRows],
  );
  const tableColumns = visibleExcelColumns(groupRows.map(({ columns }) => columns));
  const groupName = getProductGroup(selectedGroup)?.nameFa ?? selectedGroup;

  function selectGroup(groupId: string) {
    const next = GROUP_DISPLAY_ORDER.find((code) => code === groupId);
    if (!next || next === selectedGroup) return;
    setSelectedGroup(next);
    setFilters({});
    setOpenFilter(null);
    setSelected(new Set());
    setBulkBrandId("");
    setPicker(null);
  }
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
    <ColumnResizeProvider tableId="product-matrix">
      <BrandTabs
        brands={GROUP_TABS}
        brandId={selectedGroup}
        onChange={selectGroup}
        showAll={false}
        ariaLabel="گروه‌های کالا"
      />
      <div className="sheet-meta settings-toolbar">
        <span>
          {groupName} · {visible.length.toLocaleString("fa-IR")} کالا · ستون‌ها مطابق داده همین گروه
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
        <MatrixTable
          visible={visible}
          rows={groupRows}
          filters={filters}
          openFilter={openFilter}
          selected={selected}
          tableColumns={tableColumns}
          activeForProduct={activeForProduct}
          setOpenFilter={setOpenFilter}
          applyColumnFilter={applyColumnFilter}
          toggleAllVisible={toggleAllVisible}
          toggleRow={toggleRow}
          setPicker={setPicker}
        />
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
    </ColumnResizeProvider>
  );
}

function MatrixTable({
  visible,
  rows,
  filters,
  openFilter,
  selected,
  tableColumns,
  activeForProduct,
  setOpenFilter,
  applyColumnFilter,
  toggleAllVisible,
  toggleRow,
  setPicker,
}: {
  visible: MatrixRow[];
  rows: MatrixRow[];
  filters: Filters;
  openFilter: FilterKey | null;
  selected: Set<string>;
  tableColumns: ReturnType<typeof visibleExcelColumns>;
  activeForProduct: (product: CatalogProduct) => Manufacturer[];
  setOpenFilter: (value: FilterKey | null | ((current: FilterKey | null) => FilterKey | null)) => void;
  applyColumnFilter: (key: FilterKey, selectedValues: string[] | undefined) => void;
  toggleAllVisible: () => void;
  toggleRow: (key: string) => void;
  setPicker: (product: CatalogProduct) => void;
}) {
  const resizeClass = useResizableTableClass();
  return (
    <table className={`price-table settings-table matrix-table ${resizeClass}`}>
      <thead>
        <tr>
          <ResizableTh id="check" className="col-check">
            <input
              type="checkbox"
              checked={visible.length > 0 && visible.every(({ columns }) => selected.has(columns.key))}
              onChange={toggleAllVisible}
              aria-label="انتخاب همه ردیف‌های فیلترشده"
            />
          </ResizableTh>
          {tableColumns.map((column) => {
            const options = uniqueColumnValues(
              rows.filter(({ columns }) => matchesFilters(columns, filters, column.key)),
              column.key,
            );
            return (
              <ResizableTh key={column.key} id={column.key}>
                <ColumnFilter
                  label={column.label}
                  options={options}
                  applied={filters[column.key]}
                  open={openFilter === column.key}
                  onToggle={() => setOpenFilter((current) => (current === column.key ? null : column.key))}
                  onApply={(selectedValues) => applyColumnFilter(column.key, selectedValues)}
                  onClose={() => setOpenFilter(null)}
                />
              </ResizableTh>
            );
          })}
          <ResizableTh id="producers">تولیدکنندگان</ResizableTh>
        </tr>
      </thead>
      <tbody>
        {visible.length ? (
          visible.map(({ product, columns }) => {
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
                <td key={column.key} className={column.key === "name" ? "cell-wrap" : "cell-clip"}>
                  {displayExcelValue(columns[column.key])}
                </td>
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
          })
        ) : (
          <tr>
            <td className="muted" colSpan={tableColumns.length + 2}>
              در این گروه کالایی با فیلتر فعلی نیست.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function ColumnFilter({
  label,
  options,
  applied,
  open,
  onToggle,
  onApply,
  onClose,
}: {
  label: string;
  options: string[];
  applied: string[] | undefined;
  open: boolean;
  onToggle: () => void;
  onApply: (selected: string[] | undefined) => void;
  onClose: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="filter-pop">
      <button
        ref={triggerRef}
        className={`filter-head ${applied ? "is-on" : ""}`}
        type="button"
        onClick={onToggle}
      >
        {label}
        <span className="filter-mark" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </button>
      {open ? (
        <ColumnFilterMenu
          anchor={triggerRef.current}
          options={options}
          applied={applied}
          onApply={onApply}
          onClose={onClose}
        />
      ) : null}
    </div>
  );
}

function ColumnFilterMenu({
  anchor,
  options,
  applied,
  onApply,
  onClose,
}: {
  anchor: HTMLElement | null;
  options: string[];
  applied: string[] | undefined;
  onApply: (selected: string[] | undefined) => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Set<string>>(() => new Set(applied ?? options));
  const [pos, setPos] = useState({ top: 0, left: 0 });
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

  useLayoutEffect(() => {
    const menu = rootRef.current;
    const box = anchor?.getBoundingClientRect();
    if (!menu || !box) return;
    const width = menu.offsetWidth || 260;
    const left = Math.min(Math.max(8, box.right - width), window.innerWidth - width - 8);
    const top = Math.min(box.bottom + 6, window.innerHeight - menu.offsetHeight - 8);
    setPos({ top: Math.max(8, top), left });
  }, [anchor, options.length]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || anchor?.contains(target)) return;
      commit(draftRef.current);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    function onReposition() {
      onClose();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    document.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      document.removeEventListener("scroll", onReposition, true);
    };
  }, [anchor, onApply, onClose, options.length]);

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

  return createPortal(
    <div
      className="filter-menu is-fixed"
      ref={rootRef}
      role="dialog"
      aria-label="فیلتر ستون"
      style={{ top: pos.top, left: pos.left }}
    >
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
    </div>,
    document.body,
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
