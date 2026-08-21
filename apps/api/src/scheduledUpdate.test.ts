import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultSchedule, parseSchedule, shouldRunSchedule } from "../../web/src/settings/scheduleStore.ts";
import { runScheduledSourceUpdate } from "./scheduledUpdate.ts";

process.env.PRICE_UPDATE_STORE = "file";

test("parseSchedule rejects invalid time and keeps auto-publish off the schedule itself", () => {
  const parsed = parseSchedule({ enabled: true, time: "25:99", days: [6, 99] });
  assert.equal(parsed.time, defaultSchedule().time);
  assert.deepEqual(parsed.days, [6]);
  assert.equal(parsed.enabled, true);
});

test("scheduled collect without sources saves nothing and does not publish", async () => {
  const result = await runScheduledSourceUpdate();
  assert.equal(result.saved, 0);
  assert.equal(result.autoPublish, false);
});

test("schedule tick helper still requires Tehran weekday and time", () => {
  const schedule = { enabled: true, days: [6], time: "09:00" };
  assert.equal(shouldRunSchedule(schedule, { weekday: 6, time: "09:00", dateKey: "2026-08-21" }, null), true);
  assert.equal(shouldRunSchedule(schedule, { weekday: 6, time: "09:00", dateKey: "2026-08-21" }, "2026-08-21"), false);
});
