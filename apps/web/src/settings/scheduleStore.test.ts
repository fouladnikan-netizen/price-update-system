import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultSchedule, parseSchedule, shouldRunSchedule } from "./scheduleStore.ts";

test("parseSchedule keeps a valid clock and drops illegal weekdays", () => {
  const parsed = parseSchedule({ enabled: true, time: "14:00", days: [6, 99] });
  assert.equal(parsed.time, "14:00");
  assert.deepEqual(parsed.days, [6]);
});

test("disabled schedule never runs", () => {
  const schedule = { ...defaultSchedule(), enabled: false, days: [6], time: "09:00" };
  assert.equal(shouldRunSchedule(schedule, { weekday: 6, time: "09:00", dateKey: "2026-08-20" }, null), false);
});

test("schedule runs once per matching Tehran day and time", () => {
  const schedule = { enabled: true, days: [6], time: "09:00" };
  const clock = { weekday: 6, time: "09:00", dateKey: "2026-08-20" };
  assert.equal(shouldRunSchedule(schedule, clock, null), true);
  assert.equal(shouldRunSchedule(schedule, clock, "2026-08-20"), false);
  assert.equal(shouldRunSchedule(schedule, { ...clock, time: "09:01" }, null), false);
  assert.equal(shouldRunSchedule(schedule, { ...clock, weekday: 0 }, null), false);
});
