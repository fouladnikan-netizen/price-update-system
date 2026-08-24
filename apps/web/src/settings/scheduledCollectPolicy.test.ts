import assert from "node:assert/strict";
import { test } from "node:test";
import type { PriceSource } from "./sourceStore.ts";
import {
  isScheduledCollectScope,
  isScheduledWebsite,
  scheduledCollectSources,
} from "./scheduledCollectPolicy.ts";

function source(overrides: Partial<PriceSource>): PriceSource {
  const now = "2026-08-24T00:00:00.000Z";
  return {
    id: "src",
    name: "آهن آنلاین",
    sourceType: "website",
    address: "https://ahanonline.com/product-category/میلگرد/قیمت-میلگرد/",
    groupCode: "rebar",
    categoryCode: "ribbed",
    brandIds: [],
    priceCoverage: "both",
    taxMode: "excludes_vat",
    intakeMode: "daily",
    isActive: true,
    autoPublish: false,
    officialName: "آهن آنلاین",
    officialUrl: "https://ahanonline.com/",
    identityStatus: "confirmed",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test("only ahanonline and ahanprice hosts are scheduled websites", () => {
  assert.equal(isScheduledWebsite("https://ahanonline.com/قیمت-میلگرد/"), true);
  assert.equal(isScheduledWebsite("https://www.ahanprice.com/rebar"), true);
  assert.equal(isScheduledWebsite("https://fooladiranian.com/rebar"), false);
  assert.equal(isScheduledWebsite("https://ble.ir/channel"), false);
});

test("scheduled scopes keep listed catalog categories and drop the rest", () => {
  assert.equal(isScheduledCollectScope("rebar", "ribbed"), true);
  assert.equal(isScheduledCollectScope("sheet", "st52"), true);
  assert.equal(isScheduledCollectScope("pipe", "api"), true);
  assert.equal(isScheduledCollectScope("sheet", "a516"), false);
  assert.equal(isScheduledCollectScope("profile", "construction"), false);
  assert.equal(isScheduledCollectScope("rebar", "plain"), false);
});

test("daily timer keeps only the two websites in allowed categories", () => {
  const sources = [
    source({ id: "ahan-ribbed" }),
    source({
      id: "price-black",
      name: "آهن پرایس",
      address: "https://ahanprice.com/sheet-black",
      groupCode: "sheet",
      categoryCode: "black",
    }),
    source({
      id: "ahan-a516",
      address: "https://ahanonline.com/a516",
      groupCode: "sheet",
      categoryCode: "a516",
    }),
    source({
      id: "other-site",
      name: "سایت دیگر",
      address: "https://example.com/rebar",
    }),
    source({
      id: "bale",
      name: "کانال بله",
      sourceType: "bale",
      address: "https://ble.ir/prices",
    }),
  ];
  assert.deepEqual(
    scheduledCollectSources(sources).map((item) => item.id).sort(),
    ["ahan-ribbed", "price-black"],
  );
});
