const STORAGE_KEY = "price-update.table-cols.v1";

export type ColumnWidthMap = Record<string, number>;
type AllTables = Record<string, ColumnWidthMap>;

function loadAll(): AllTables {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AllTables;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function loadColumnWidths(tableId: string): ColumnWidthMap {
  const all = loadAll();
  const widths = all[tableId];
  if (!widths || typeof widths !== "object") return {};
  const clean: ColumnWidthMap = {};
  for (const [key, value] of Object.entries(widths)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) clean[key] = Math.round(value);
  }
  return clean;
}

export function saveColumnWidths(tableId: string, widths: ColumnWidthMap): void {
  if (typeof localStorage === "undefined") return;
  const all = loadAll();
  all[tableId] = widths;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export const MIN_COLUMN_WIDTH = 72;
