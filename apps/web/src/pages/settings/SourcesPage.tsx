import { useMemo, useState, type FormEvent } from "react";
import { BrandTabs } from "../../components/BrandTabs";
import { getCategoryBrands } from "../../mock/category-brands";
import { PRODUCT_GROUPS, getProductGroup } from "../../mock/data";
import { SourceFormDialog } from "../../settings/SourceFormDialog";
import { useSourceState } from "../../settings/SourceState";
import { ResizableTable, ResizableTh } from "../../tables/ResizableTh";
import {
  identityStatusLabel,
  inputFromSource,
  intakeModeLabel,
  priceCoverageLabel,
  sourceInputForScope,
  sourceTypeLabel,
  type PriceSource,
  type SourceInput,
} from "../../settings/sourceStore";

const GROUP_TABS = PRODUCT_GROUPS.map((group) => ({ id: group.code, name: group.nameFa }));

export function SourcesPage() {
  const { sources, saveSource, setActive, remove } = useSourceState();
  const [draft, setDraft] = useState<SourceInput | null>(null);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState(PRODUCT_GROUPS[0]?.code ?? "rebar");
  const [selectedCategory, setSelectedCategory] = useState(
    PRODUCT_GROUPS[0]?.categories[0]?.code ?? "ribbed",
  );

  const group = getProductGroup(selectedGroup) ?? PRODUCT_GROUPS[0];
  const categoryTabs = (group?.categories ?? []).map((category) => ({
    id: category.code,
    name: category.nameFa,
  }));
  const categoryName =
    group?.categories.find((category) => category.code === selectedCategory)?.nameFa ?? selectedCategory;

  const visible = useMemo(
    () =>
      sources.filter(
        (item) => item.groupCode === selectedGroup && item.categoryCode === selectedCategory,
      ),
    [selectedCategory, selectedGroup, sources],
  );

  function selectGroup(groupId: string) {
    if (groupId === selectedGroup) return;
    const nextGroup = getProductGroup(groupId);
    const nextCategory = nextGroup?.categories[0]?.code ?? "";
    setSelectedGroup(groupId);
    setSelectedCategory(nextCategory);
  }

  function openCreate() {
    setDraft(sourceInputForScope(selectedGroup, selectedCategory));
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
    setSelectedGroup(draft.groupCode);
    setSelectedCategory(draft.categoryCode);
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
      <BrandTabs
        brands={GROUP_TABS}
        brandId={selectedGroup}
        onChange={selectGroup}
        showAll={false}
        ariaLabel="گروه‌های کالا"
      />
      <BrandTabs
        brands={categoryTabs}
        brandId={selectedCategory}
        onChange={setSelectedCategory}
        showAll={false}
        ariaLabel={`دسته‌های ${group?.nameFa ?? ""}`}
      />
      <div className="sheet-meta settings-toolbar">
        <span>
          {group?.nameFa} · {categoryName} · {visible.length.toLocaleString("fa-IR")} منبع
        </span>
        <div className="btn-row">
          <button className="btn primary" type="button" onClick={openCreate}>
            تعریف منبع
          </button>
        </div>
      </div>
      {message ? <p className="settings-banner">{message}</p> : null}

      <div className="sheet table-wrap">
        <ResizableTable id="sources" className="price-table settings-table">
          <thead>
            <tr>
              <ResizableTh id="name">منبع</ResizableTh>
              <ResizableTh id="address">آدرس و هویت</ResizableTh>
              <ResizableTh id="coverage">پوشش</ResizableTh>
              <ResizableTh id="status">وضعیت</ResizableTh>
              <ResizableTh id="actions" className="col-action"></ResizableTh>
            </tr>
          </thead>
          <tbody>
            {visible.length ? (
              visible.map((source) => (
                <tr key={source.id}>
                  <td>
                    <strong>{source.name}</strong>
                    <div className="muted">{sourceTypeLabel(source.sourceType)}</div>
                  </td>
                  <td className="cell-wrap">
                    <div>{source.address || source.officialName || "—"}</div>
                    {source.officialName && source.address ? (
                      <div className="muted">{source.officialName}</div>
                    ) : null}
                    <div className="muted">{identityStatusLabel(source.identityStatus)}</div>
                  </td>
                  <td>
                    {priceCoverageLabel(source.priceCoverage)}
                    <div className="muted">
                      {source.taxMode === "includes_vat"
                        ? "با مالیات — ۱۰٪ جدا می‌شود"
                        : source.taxMode === "excludes_vat"
                          ? "بدون مالیات"
                          : "مالیات خودکار"}
                    </div>
                    <div className="muted">
                      {source.brandIds.length.toLocaleString("fa-IR")} برند · {intakeModeLabel(source.intakeMode)}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${source.isActive ? "success" : ""}`}>
                      {source.isActive ? "فعال" : "غیرفعال"}
                    </span>
                    <div className="muted">انتشار خودکار خاموش</div>
                  </td>
                  <td className="col-action">
                    <div className="icon-actions">
                      <button
                        className="icon-action"
                        type="button"
                        title="ویرایش"
                        aria-label={`ویرایش ${source.name}`}
                        onClick={() => openEdit(source)}
                      >
                        <PencilIcon />
                      </button>
                      <button
                        className={`icon-action ${source.isActive ? "is-on" : "is-off"}`}
                        type="button"
                        title={source.isActive ? "غیرفعال کردن" : "فعال کردن"}
                        aria-label={source.isActive ? `غیرفعال کردن ${source.name}` : `فعال کردن ${source.name}`}
                        onClick={() => setActive(source.id, !source.isActive)}
                      >
                        <EyeIcon />
                      </button>
                      <button
                        className="icon-action is-off"
                        type="button"
                        title="حذف"
                        aria-label={`حذف ${source.name}`}
                        onClick={() => confirmRemove(source)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="muted">
                  هنوز منبعی برای این دسته تعریف نشده است. سایت یا کانال عمومی با آدرس ثبت کنید.
                </td>
              </tr>
            )}
          </tbody>
        </ResizableTable>
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

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.8 3.7a2.1 2.1 0 0 1 3 3L8 18.5 3.5 20l1.5-4.5L16.8 3.7zM13.5 6.8l3.7 3.7"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 12s3.6-7 9.5-7 9.5 7 9.5 7-3.6 7-9.5 7-9.5-7-9.5-7z"
      />
      <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"
      />
    </svg>
  );
}
