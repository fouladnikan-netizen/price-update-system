import assert from "node:assert/strict";
import { test } from "node:test";
import catalog from "./category-products.json" with { type: "json" };
import excelRows from "./excel-catalog-rows.json" with { type: "json" };

test("price catalog has exactly one product per Final Product row", () => {
  assert.equal(catalog.length, excelRows.length);
  assert.equal(new Set(catalog.map((item) => item.sku)).size, excelRows.length);
  const names = catalog.map((item) => item.name).sort((a, b) => a.localeCompare(b, "fa"));
  const excelNames = excelRows.map((item) => item.name).sort((a, b) => a.localeCompare(b, "fa"));
  assert.deepEqual(names, excelNames);
});

test("final file categories that must stay empty stay empty", () => {
  assert.equal(excelRows.filter((row) => /کلاف|بستر|لوله صنعتی/.test(row.category)).length, 0);
});
