const STORAGE_KEY = "price-update.schedule.v1";
const LAST_RUN_KEY = "price-update.schedule-last-run.v1";

export const WEEKDAYS = [
  { id: 6, label: "شنبه" },
  { id: 0, label: "یکشنبه" },
  { id: 1, label: "دوشنبه" },
  { id: 2, label: "سه‌شنبه" },
  { id: 3, label: "چهارشنبه" },
  { id: 4, label: "پنجشنبه" },
  { id: 5, label: "جمعه" },
] as const;

export type ScheduleSlotMode = "first" | "missing" | "audit";

export type ScheduleSlot = {
  time: string;
  mode: ScheduleSlotMode;
};

export type UpdateSchedule = {
  enabled: boolean;
  time: string;
  days: number[];
  slots: ScheduleSlot[];
};

export type LastScheduleRun = {
  dateKey: string;
  times: string[];
};

export const DEFAULT_SLOTS: ScheduleSlot[] = [
  { time: "11:00", mode: "first" },
  { time: "11:30", mode: "missing" },
  { time: "12:00", mode: "missing" },
  { time: "14:00", mode: "missing" },
  { time: "14:30", mode: "audit" },
];

export const SLOT_LABELS: Record<ScheduleSlotMode, string> = {
  first: "جمع‌آوری اول همه منابع",
  missing: "فقط جداول بدون قیمت",
  audit: "کنترل تغییر قیمت همه محصولات",
};

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function isSlotMode(value: unknown): value is ScheduleSlotMode {
  return value === "first" || value === "missing" || value === "audit";
}

export function parseSlots(raw: unknown): ScheduleSlot[] {
  if (!Array.isArray(raw)) return DEFAULT_SLOTS;
  const slots = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Partial<ScheduleSlot>;
      if (typeof row.time !== "string" || !TIME_RE.test(row.time) || !isSlotMode(row.mode)) return null;
      return { time: row.time, mode: row.mode };
    })
    .filter((item): item is ScheduleSlot => item != null);
  return slots.length ? slots : DEFAULT_SLOTS;
}

export function defaultSchedule(): UpdateSchedule {
  return { enabled: false, time: DEFAULT_SLOTS[0].time, days: [6, 0, 1, 2, 3], slots: DEFAULT_SLOTS };
}

export function parseSchedule(raw: unknown): UpdateSchedule {
  const fallback = defaultSchedule();
  if (!raw || typeof raw !== "object") return fallback;
  const parsed = raw as Partial<UpdateSchedule>;
  const slots = parseSlots(parsed.slots);
  const days = Array.isArray(parsed.days)
    ? parsed.days.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6)
    : fallback.days;
  return {
    enabled: Boolean(parsed.enabled),
    time: slots[0]?.time ?? fallback.time,
    days,
    slots,
  };
}

export function loadSchedule(): UpdateSchedule {
  try {
    if (typeof localStorage === "undefined") return defaultSchedule();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSchedule();
    return parseSchedule(JSON.parse(raw));
  } catch {
    return defaultSchedule();
  }
}

export function saveSchedule(schedule: UpdateSchedule): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(parseSchedule(schedule)));
}

export function parseLastRun(raw: unknown): LastScheduleRun | null {
  if (!raw || typeof raw !== "object") return null;
  const dateKey = typeof (raw as { dateKey?: unknown }).dateKey === "string" ? (raw as { dateKey: string }).dateKey : "";
  if (!dateKey) return null;
  const times = Array.isArray((raw as { times?: unknown }).times)
    ? (raw as { times: unknown[] }).times.filter((item): item is string => typeof item === "string" && TIME_RE.test(item))
    : [];
  return { dateKey, times };
}

export function loadLastScheduleRun(): LastScheduleRun | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_RUN_KEY);
    if (!raw) return null;
    return parseLastRun(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLastScheduleRun(run: LastScheduleRun): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LAST_RUN_KEY, JSON.stringify(run));
}

export function tehranClock(): { weekday: number; time: string; dateKey: string } {
  const now = new Date();
  const weekdayName = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tehran", weekday: "short" }).format(now);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(now);
  return { weekday: map[weekdayName] ?? now.getDay(), time, dateKey };
}

export function dueScheduleSlot(
  schedule: UpdateSchedule,
  clock = tehranClock(),
  lastRun: LastScheduleRun | null = loadLastScheduleRun(),
): ScheduleSlot | null {
  if (!schedule.enabled) return null;
  if (!schedule.days.includes(clock.weekday)) return null;
  const slot = schedule.slots.find((item) => item.time === clock.time);
  if (!slot) return null;
  if (lastRun?.dateKey === clock.dateKey && lastRun.times.includes(slot.time)) return null;
  return slot;
}

export function shouldRunSchedule(
  schedule: UpdateSchedule,
  clock = tehranClock(),
  lastRun: LastScheduleRun | string | null = loadLastScheduleRun(),
): boolean {
  const run = typeof lastRun === "string" ? { dateKey: lastRun, times: [] } : lastRun;
  return dueScheduleSlot(schedule, clock, run) != null;
}

export function markSlotRan(lastRun: LastScheduleRun | null, dateKey: string, time: string): LastScheduleRun {
  if (lastRun?.dateKey !== dateKey) return { dateKey, times: [time] };
  if (lastRun.times.includes(time)) return lastRun;
  return { dateKey, times: [...lastRun.times, time] };
}
