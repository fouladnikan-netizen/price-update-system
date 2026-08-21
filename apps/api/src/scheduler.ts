import { defaultSchedule, parseSchedule, shouldRunSchedule, tehranClock, type UpdateSchedule } from "../../web/src/settings/scheduleStore.ts";
import { loadMetaJson, saveMetaJson } from "./opsStore.ts";
import { persistenceEnabled } from "./pg.ts";
import { runScheduledSourceUpdate } from "./scheduledUpdate.ts";

const SCHEDULE_KEY = "update_schedule";
const LAST_RUN_KEY = "update_schedule_last_run";
const POLL_MS = 30_000;

type LastRun = { dateKey?: string };

export async function loadPersistedSchedule(): Promise<UpdateSchedule> {
  if (!persistenceEnabled()) return defaultSchedule();
  const stored = await loadMetaJson<UpdateSchedule>(SCHEDULE_KEY);
  return parseSchedule(stored ?? defaultSchedule());
}

export async function savePersistedSchedule(schedule: UpdateSchedule): Promise<boolean> {
  const next = parseSchedule(schedule);
  if (!persistenceEnabled()) return false;
  return saveMetaJson(SCHEDULE_KEY, next);
}

async function loadLastRun(): Promise<string | null> {
  const stored = await loadMetaJson<LastRun>(LAST_RUN_KEY);
  return stored?.dateKey ?? null;
}

async function saveLastRun(dateKey: string): Promise<void> {
  await saveMetaJson(LAST_RUN_KEY, { dateKey });
}

let ticking = false;
let timer: ReturnType<typeof setInterval> | null = null;

export async function tickSchedule(now = tehranClock()): Promise<{ ran: boolean; saved: number }> {
  const schedule = await loadPersistedSchedule();
  const lastRun = await loadLastRun();
  if (!shouldRunSchedule(schedule, now, lastRun)) return { ran: false, saved: 0 };
  const result = await runScheduledSourceUpdate();
  await saveLastRun(now.dateKey);
  console.log(`schedule ran ${result.saved} prices from ${result.collected} sources; website publish stays off`);
  return { ran: true, saved: result.saved };
}

export function startSchedulePoller(): void {
  if (timer) return;
  const run = async () => {
    if (ticking) return;
    ticking = true;
    try {
      await tickSchedule();
    } catch (error) {
      console.error("schedule tick failed", error instanceof Error ? error.message : error);
    } finally {
      ticking = false;
    }
  };
  void run();
  timer = setInterval(() => void run(), POLL_MS);
}
