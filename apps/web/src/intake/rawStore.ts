const STORAGE_KEY = "price-update.raw-inputs.v1";

export type IntakeKind = "text" | "image" | "collect";

export type IntakeRecord = {
  id: string;
  sourceId: string | null;
  sourceName: string;
  groupCode: string;
  categoryCode: string;
  priceCoverage?: "factory" | "warehouse" | "both";
  inputKind: IntakeKind;
  rawText: string;
  imageUrl: string | null;
  fileName: string | null;
  receivedAt: string;
  promptVersion: string | null;
  canPublish: false;
  error: string | null;
  result: unknown;
};

export function loadIntakes(): IntakeRecord[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as IntakeRecord[];
    return Array.isArray(parsed) ? parsed.map(normalizeIntake) : [];
  } catch {
    return [];
  }
}

export function saveIntakes(items: IntakeRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function clearIntakes(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function addIntake(items: IntakeRecord[], record: IntakeRecord): IntakeRecord[] {
  return [normalizeIntake(record), ...items];
}

function normalizeIntake(item: IntakeRecord): IntakeRecord {
  return {
    ...item,
    inputKind: item.inputKind === "image" ? "image" : item.inputKind === "collect" ? "collect" : "text",
    imageUrl: item.imageUrl ?? null,
    fileName: item.fileName ?? null,
  };
}
