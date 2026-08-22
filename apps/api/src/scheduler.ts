import {
  defaultSchedule,
  dueScheduleSlot,
  markSlotRan,
  parseLastRun,
  parseSchedule,
  tehranClock,
  type LastScheduleRun,
  type UpdateSchedule,
} from "../../web/src/settings/scheduleStore.ts";
import { loadMetaJson, saveMetaJson } from "./opsStore.ts";
import { persistenceEnabled } from "./pg.ts";
import { runScheduledSourceUpdate } from "./scheduledUpdate.ts";

const SCHEDULE_KEY = "update_schedule";
const LAST_RUN_KEY = "update_schedule_last_run";
const POLL_MS = 30_000;

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

async function loadLastRun(): Promise<LastScheduleRun | null> {
  return parseLastRun(await loadMetaJson<unknown>(LAST_RUN_KEY));
}

async function saveLastRun(run: LastScheduleRun): Promise<void> {
  await saveMetaJson(LAST_RUN_KEY, run);
}

let ticking = false;
let timer: ReturnType<typeof setInterval> | null = null;

export async function tickSchedule(now = tehranClock()): Promise<{ ran: boolean; saved: number }> {
  const schedule = await loadPersistedSchedule();
  const lastRun = await loadLastRun();
  const slot = dueScheduleSlot(schedule, now, lastRun);
  if (!slot) return { ran: false, saved: 0 };
  const result = await runScheduledSourceUpdate(slot.mode);
  await saveLastRun(markSlotRan(lastRun, now.dateKey, slot.time));
  console.log(
    `schedule ${slot.time} ${slot.mode} saved=${result.saved} filled=${result.filled} changed=${result.changed} sources=${result.collected}; website publish stays off`,
  );
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
