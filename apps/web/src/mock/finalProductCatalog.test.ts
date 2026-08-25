import assert from "node:assert/strict";
import { test } from "node:test";
import catalog from "./category-products.json" with { type: "json" };
import website from "../../../../data/website-sku-catalog.prod.json" with { type: "json" };

test("runtime catalog only contains Website SKUs — never Final Product invented codes", () => {
  const active = new Set(
    (website.products as Array<{ sku?: string; isActive?: boolean }>)
      .filter((item) => item.sku && item.isActive !== false)
      .map((item) => String(item.sku).trim()),
  );
  assert.ok(catalog.length > 0);
  assert.equal(new Set(catalog.map((item) => item.sku)).size, catalog.length);
  for (const row of catalog) {
    assert.ok(active.has(row.sku), `unknown sku not on website: ${row.sku}`);
    assert.equal(/^RBR-A[23]-\d+$/.test(row.sku), false, `compositional sku leaked: ${row.sku}`);
  }
});

test("catalog lock keeps every runtime sku unique and present", () => {
  assert.ok(catalog.every((item) => typeof item.sku === "string" && item.sku.trim().length > 0));
});
