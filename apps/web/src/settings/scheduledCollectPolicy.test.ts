import assert from "node:assert/strict";
import { test } from "node:test";
import type { PriceSource } from "./sourceStore.ts";
import {
  isApprovedCollectUrl,
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

test("approved thinktank hosts are scheduled websites", () => {
  assert.equal(isScheduledWebsite("https://ahanonline.com/قیمت-میلگرد/"), true);
  assert.equal(isScheduledWebsite("https://www.ahanprice.com/rebar"), true);
  assert.equal(isScheduledWebsite("https://pivan.co/product-category/uchannel/"), true);
  assert.equal(isScheduledWebsite("https://www.ahan.shop/price/color-sheet/"), true);
  assert.equal(isScheduledWebsite("https://fooladiranian.com/rebar"), false);
});

test("exact approved URLs only — no substitute pages", () => {
  assert.equal(
    isApprovedCollectUrl("https://ahanonline.com/product-category/میلگرد/قیمت-میلگرد/"),
    true,
  );
  assert.equal(isApprovedCollectUrl("https://ahanonline.com/some-other-page/"), false);
});

test("scheduled scopes follow approved web_max categories", () => {
  assert.equal(isScheduledCollectScope("rebar", "ribbed"), true);
  assert.equal(isScheduledCollectScope("rebar", "plain"), true);
  assert.equal(isScheduledCollectScope("sheet", "st52"), true);
  assert.equal(isScheduledCollectScope("channel", "sangin"), true);
  assert.equal(isScheduledCollectScope("sheet", "a516"), false); // formula, not web scrape
  assert.equal(isScheduledCollectScope("profile", "construction"), false); // manual
});

test("daily timer keeps only exact approved URLs in web_max scopes", () => {
  const sources = [
    source({ id: "ahan-ribbed" }),
    source({
      id: "price-black",
      name: "آهن پرایس",
      address: "https://ahanprice.com/Price/ورق-سیاه",
      groupCode: "sheet",
      categoryCode: "black",
    }),
    source({
      id: "wrong-url-same-host",
      address: "https://ahanonline.com/random-page/",
      groupCode: "rebar",
      categoryCode: "ribbed",
    }),
    source({
      id: "formula-a516",
      address: "https://ahanonline.com/product-category/انواع-ورق/ورق-st52/",
      groupCode: "sheet",
      categoryCode: "a516",
    }),
    source({
      id: "other-site",
      name: "سایت دیگر",
      address: "https://example.com/rebar",
    }),
  ];
  assert.deepEqual(
    scheduledCollectSources(sources).map((item) => item.id).sort(),
    ["ahan-ribbed", "price-black"],
  );
});
