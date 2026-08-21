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

export type UpdateSchedule = {
  enabled: boolean;
  time: string;
  days: number[];
};

export function defaultSchedule(): UpdateSchedule {
  return { enabled: false, time: "09:00", days: [6, 0, 1, 2, 3] };
}

export function parseSchedule(raw: unknown): UpdateSchedule {
  const fallback = defaultSchedule();
  if (!raw || typeof raw !== "object") return fallback;
  const parsed = raw as Partial<UpdateSchedule>;
  const time =
    typeof parsed.time === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(parsed.time) ? parsed.time : fallback.time;
  const days = Array.isArray(parsed.days)
    ? parsed.days.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6)
    : fallback.days;
  return { enabled: Boolean(parsed.enabled), time, days };
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule));
}

export function loadLastScheduleRun(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(LAST_RUN_KEY);
}

export function saveLastScheduleRun(dateKey: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LAST_RUN_KEY, dateKey);
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

export function shouldRunSchedule(schedule: UpdateSchedule, clock = tehranClock(), lastRun: string | null = loadLastScheduleRun()): boolean {
  if (!schedule.enabled) return false;
  if (!schedule.days.includes(clock.weekday)) return false;
  if (clock.time !== schedule.time) return false;
  return lastRun !== clock.dateKey;
}
