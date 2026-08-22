import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultSchedule, parseSchedule, shouldRunSchedule } from "../../web/src/settings/scheduleStore.ts";
import { runScheduledSourceUpdate } from "./scheduledUpdate.ts";

process.env.PRICE_UPDATE_STORE = "file";

test("parseSchedule replaces the old 09:00 clock with the daily slot plan", () => {
  const parsed = parseSchedule({ enabled: true, time: "25:99", days: [6, 99] });
  assert.equal(parsed.time, defaultSchedule().time);
  assert.equal(parsed.slots[0]?.time, "11:00");
  assert.deepEqual(parsed.days, [6]);
  assert.equal(parsed.enabled, true);
});

test("scheduled collect without sources saves nothing and does not publish", async () => {
  const result = await runScheduledSourceUpdate("first");
  assert.equal(result.saved, 0);
  assert.equal(result.autoPublish, false);
  assert.equal(result.mode, "first");
});

test("schedule tick helper still requires Tehran weekday and slot time", () => {
  const schedule = { ...defaultSchedule(), enabled: true, days: [6] };
  assert.equal(shouldRunSchedule(schedule, { weekday: 6, time: "11:00", dateKey: "2026-08-21" }, null), true);
  assert.equal(
    shouldRunSchedule(schedule, { weekday: 6, time: "11:00", dateKey: "2026-08-21" }, { dateKey: "2026-08-21", times: ["11:00"] }),
    false,
  );
  assert.equal(shouldRunSchedule(schedule, { weekday: 6, time: "09:00", dateKey: "2026-08-21" }, null), false);
});
