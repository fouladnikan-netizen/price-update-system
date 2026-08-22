import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_SLOTS,
  defaultSchedule,
  dueScheduleSlot,
  markSlotRan,
  parseSchedule,
  shouldRunSchedule,
} from "./scheduleStore.ts";

test("old single-time schedules become the 11:00 to 14:30 slots", () => {
  const parsed = parseSchedule({ enabled: true, time: "09:00", days: [6, 99] });
  assert.deepEqual(parsed.slots, DEFAULT_SLOTS);
  assert.equal(parsed.time, "11:00");
  assert.deepEqual(parsed.days, [6]);
  assert.equal(parsed.enabled, true);
});

test("disabled schedule never runs a slot", () => {
  const schedule = { ...defaultSchedule(), enabled: false, days: [6] };
  assert.equal(dueScheduleSlot(schedule, { weekday: 6, time: "11:00", dateKey: "2026-08-22" }, null), null);
});

test("each Tehran slot runs once per day", () => {
  const schedule = { ...defaultSchedule(), enabled: true, days: [6] };
  const clock = { weekday: 6, time: "11:30", dateKey: "2026-08-22" };
  assert.equal(dueScheduleSlot(schedule, clock, null)?.mode, "missing");
  assert.equal(
    dueScheduleSlot(schedule, clock, { dateKey: "2026-08-22", times: ["11:30"] }),
    null,
  );
  assert.equal(dueScheduleSlot(schedule, { ...clock, time: "14:30" }, { dateKey: "2026-08-22", times: ["11:30"] })?.mode, "audit");
  assert.equal(shouldRunSchedule(schedule, { weekday: 6, time: "09:00", dateKey: "2026-08-22" }, null), false);
});

test("marking a slot does not block later slots the same day", () => {
  const first = markSlotRan(null, "2026-08-22", "11:00");
  const second = markSlotRan(first, "2026-08-22", "11:30");
  assert.deepEqual(second.times, ["11:00", "11:30"]);
});
