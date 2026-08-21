import assert from "node:assert/strict";
import { test } from "node:test";
import { loadColumnWidths, saveColumnWidths } from "./columnWidthStore.ts";

const memory = new Map<string, string>();

Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
  },
  configurable: true,
});

test("saved column widths come back for the same table", () => {
  memory.clear();
  saveColumnWidths("sources", { name: 180, category: 120 });
  const loaded = loadColumnWidths("sources");
  assert.equal(loaded.name, 180);
  assert.equal(loaded.category, 120);
  assert.deepEqual(loadColumnWidths("intake"), {});
});
