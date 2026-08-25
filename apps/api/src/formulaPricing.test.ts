import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyFormulaPrice,
  detectFormulaCycle,
  listDefaultFormulaRules,
  selectMaxComparablePriceIrr,
} from "./formulaPricing.ts";
import {
  getApprovedCategory,
  isApprovedWebsiteUrl,
  listApprovedWebsiteHosts,
  seedSourcesFromApprovedConfig,
} from "./categorySources.ts";

test("approved sources include thinktank URLs and never invent products", () => {
  const rebar = getApprovedCategory("rebar", "ribbed");
  assert.ok(rebar);
  assert.equal(rebar?.pricingMode, "web_max");
  assert.ok(
    isApprovedWebsiteUrl(
      "https://ahanonline.com/product-category/میلگرد/قیمت-میلگرد/",
      "rebar",
      "ribbed",
    ),
  );
  assert.equal(
    isApprovedWebsiteUrl("https://ahanonline.com/some-other-page/", "rebar", "ribbed"),
    false,
  );
  const hosts = listApprovedWebsiteHosts();
  assert.ok(hosts.includes("ahanonline.com"));
  assert.ok(hosts.includes("pivan.co"));
  assert.ok(hosts.includes("ahan.shop"));
  const seeds = seedSourcesFromApprovedConfig();
  assert.ok(seeds.length >= 40);
  assert.ok(seeds.every((row) => row.sourceType === "website" && row.autoPublish === false));
});

test("formula adds exact IRR adjustments without inventing SKUs", () => {
  const rule = listDefaultFormulaRules().find((item) => item.id === "sheet-roof-from-color");
  assert.ok(rule);
  const result = applyFormulaPrice({
    targetProductCode: "VROOF-000001",
    referenceProductCode: "VCOLOR-000001",
    referenceNetPriceIrr: 400_000,
    priceType: "factory",
    rule: rule!,
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.derivedNetPriceIrr, 423_000);
});

test("formula cycle detection blocks self-reference", () => {
  const cycles = detectFormulaCycle([
    {
      id: "bad",
      version: "1",
      targetCategoryKey: "sheet/roof",
      referenceCategoryKey: "sheet/roof",
      fixedAdjustmentIrr: 1,
      active: true,
    },
  ]);
  assert.ok(cycles.length >= 1);
});

test("max comparable price ignores invalid candidates", () => {
  assert.equal(
    selectMaxComparablePriceIrr([
      { priceIrr: 100, valid: true },
      { priceIrr: 500, valid: false },
      { priceIrr: null, valid: true },
      { priceIrr: 250, valid: true },
    ]),
    250,
  );
  assert.equal(selectMaxComparablePriceIrr([{ priceIrr: 0, valid: true }]), null);
});
