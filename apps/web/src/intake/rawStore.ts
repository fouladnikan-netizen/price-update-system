const STORAGE_KEY = "price-update.raw-inputs.v1";

export type IntakeRecord = {
  id: string;
  sourceId: string | null;
  sourceName: string;
  groupCode: string;
  categoryCode: string;
  rawText: string;
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
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveIntakes(items: IntakeRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function addIntake(items: IntakeRecord[], record: IntakeRecord): IntakeRecord[] {
  return [record, ...items];
}
