import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type ThHTMLAttributes,
} from "react";
import { loadColumnWidths, MIN_COLUMN_WIDTH, saveColumnWidths, type ColumnWidthMap } from "./columnWidthStore";

type ResizeContextValue = {
  tableId: string;
  widths: ColumnWidthMap;
  tableClassName: string;
  beginResize: (columnId: string, event: ReactPointerEvent<HTMLElement>) => void;
};

const ColumnResizeContext = createContext<ResizeContextValue | null>(null);

export function ColumnResizeProvider({ tableId, children }: { tableId: string; children: ReactNode }) {
  const [widths, setWidths] = useState<ColumnWidthMap>(() => loadColumnWidths(tableId));
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  const commit = useCallback(
    (next: ColumnWidthMap, persist: boolean) => {
      widthsRef.current = next;
      setWidths(next);
      if (persist) saveColumnWidths(tableId, next);
    },
    [tableId],
  );

  const beginResize = useCallback(
    (columnId: string, event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const handle = event.currentTarget;
      const th = handle.closest("th");
      if (!th) return;
      const row = th.parentElement;
      if (!row) return;
      const startX = event.clientX;
      const rtl = getComputedStyle(th).direction === "rtl";
      const measured: ColumnWidthMap = { ...widthsRef.current };
      for (const cell of Array.from(row.children)) {
        const id = (cell as HTMLElement).dataset.colId;
        if (!id) continue;
        if (measured[id] == null) measured[id] = Math.round(cell.getBoundingClientRect().width);
      }
      const startWidth = measured[columnId] ?? Math.round(th.getBoundingClientRect().width);
      commit(measured, true);
      document.body.classList.add("is-col-resizing");

      function move(next: PointerEvent) {
        const delta = rtl ? startX - next.clientX : next.clientX - startX;
        const width = Math.max(MIN_COLUMN_WIDTH, Math.round(startWidth + delta));
        commit({ ...widthsRef.current, [columnId]: width }, false);
      }

      function stop() {
        document.body.classList.remove("is-col-resizing");
        saveColumnWidths(tableId, widthsRef.current);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
      }

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    },
    [commit],
  );

  const value = useMemo<ResizeContextValue>(
    () => ({
      tableId,
      widths,
      tableClassName: Object.keys(widths).length ? "has-col-widths" : "",
      beginResize,
    }),
    [beginResize, tableId, widths],
  );

  return <ColumnResizeContext.Provider value={value}>{children}</ColumnResizeContext.Provider>;
}

export function ResizableTable({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <ColumnResizeProvider tableId={id}>
      <ResizableTableInner className={className}>{children}</ResizableTableInner>
    </ColumnResizeProvider>
  );
}

function ResizableTableInner({ className, children }: { className?: string; children: ReactNode }) {
  const resizeClass = useResizableTableClass();
  return <table className={[className, resizeClass].filter(Boolean).join(" ")}>{children}</table>;
}

export function useResizableTableClass(): string {
  return useContext(ColumnResizeContext)?.tableClassName ?? "";
}

export function ResizableTh({
  id,
  children,
  className,
  ...rest
}: {
  id: string;
  children?: ReactNode;
  className?: string;
} & Omit<ThHTMLAttributes<HTMLTableCellElement>, "id">) {
  const ctx = useContext(ColumnResizeContext);
  if (!ctx) throw new Error("ResizableTh needs ColumnResizeProvider");
  const width = ctx.widths[id];
  return (
    <th
      {...rest}
      data-col-id={id}
      className={["resizable-th", className].filter(Boolean).join(" ")}
      style={width ? { width, minWidth: MIN_COLUMN_WIDTH } : rest.style}
    >
      {children}
      <span
        className="col-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="تغییر عرض ستون"
        onPointerDown={(event) => ctx.beginResize(id, event)}
      />
    </th>
  );
}
