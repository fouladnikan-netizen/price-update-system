import { useEffect, useMemo, useRef, useState } from "react";
import {
  categoryScopeLabel,
  sourceTypeLabel,
  type PriceSource,
} from "../settings/sourceStore";

const PLACEHOLDER = "منبع قیمت را انتخاب کنید";
const ADD_NEW_LABEL = "افزودن منبع جدید";

export function SourcePicker({
  sources,
  value,
  onChange,
  onAddNew,
  label = "منبع",
  openOnMount = false,
}: {
  sources: PriceSource[];
  value: string;
  onChange: (source: PriceSource) => void;
  onAddNew: () => void;
  label?: string;
  openOnMount?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(openOnMount);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => sources.find((item) => item.id === value) ?? null,
    [sources, value],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fa");
    if (!needle) return sources;
    return sources.filter((item) => {
      const hay = `${item.name} ${sourceTypeLabel(item.sourceType)} ${categoryScopeLabel(item.groupCode, item.categoryCode)}`.toLocaleLowerCase("fa");
      return hay.includes(needle);
    });
  }, [query, sources]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  function pick(source: PriceSource) {
    onChange(source);
    setQuery("");
    setOpen(false);
  }

  function addNew() {
    setQuery("");
    setOpen(false);
    onAddNew();
  }

  return (
    <div className="source-picker" ref={rootRef}>
      <span className="source-picker-label">{label}</span>
      <button
        type="button"
        className={`source-picker-trigger ${selected ? "" : "is-empty"}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="source-picker-value">
          {selected ? (
            <>
              <strong>{selected.name}</strong>
              <small>{categoryScopeLabel(selected.groupCode, selected.categoryCode)}</small>
            </>
          ) : (
            PLACEHOLDER
          )}
        </span>
        <span className="source-picker-caret" aria-hidden />
      </button>
      {open ? (
        <div className="source-picker-menu" role="listbox">
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
            placeholder="جستجوی منبع"
            aria-label="جستجوی منبع"
          />
          <div className="source-picker-list">
            {filtered.length ? (
              filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={item.id === value}
                  className={`source-picker-option ${item.id === value ? "is-active" : ""}`}
                  onClick={() => pick(item)}
                >
                  <strong>{item.name}</strong>
                  <small>
                    {sourceTypeLabel(item.sourceType)} · {categoryScopeLabel(item.groupCode, item.categoryCode)}
                  </small>
                </button>
              ))
            ) : (
              <p className="muted source-picker-empty">منبعی با این عبارت نیست.</p>
            )}
          </div>
          <div className="source-picker-add">
            <button type="button" onClick={addNew}>
              {ADD_NEW_LABEL}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
