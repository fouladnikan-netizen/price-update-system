import assert from "node:assert/strict";
import { test } from "node:test";
import { applySourceTax, intakesFromKeptSources, liveSources, sourceUpdateReport } from "./priceUpdate.ts";
import type { PriceSource } from "../settings/sourceStore.ts";

function source(overrides: Partial<PriceSource>): PriceSource {
  const now = "2026-08-20T00:00:00.000Z";
  return {
    id: "src",
    name: "نگین فولاد السا",
    sourceType: "website",
    address: "https://example.com/rebar",
    groupCode: "rebar",
    categoryCode: "ribbed",
    brandIds: [],
    priceCoverage: "both",
    taxMode: "auto",
    intakeMode: "manual",
    isActive: true,
    autoPublish: false,
    officialName: null,
    officialUrl: null,
    identityStatus: "confirmed",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test("category update does not collect another category of the same mill", () => {
  const sources = [
    source({ id: "ribbed", categoryCode: "ribbed", address: "https://example.com/ribbed" }),
    source({ id: "plain", categoryCode: "plain", address: "https://example.com/plain" }),
  ];
  const live = liveSources(sources, { groupCode: "rebar", categoryCode: "ribbed" });
  assert.deepEqual(
    live.map((item) => item.id),
    ["ribbed"],
  );
});

test("telegram sources are skipped while collect is paused", () => {
  const sources = [
    source({ id: "web", name: "آهن آنلاین" }),
    source({ id: "tg", name: "کانال تلگرام", sourceType: "telegram", address: "https://t.me/s/example" }),
    source({ id: "bale", name: "کانال بله", sourceType: "bale", address: "https://ble.ir/example" }),
  ];
  assert.deepEqual(
    liveSources(sources).map((item) => item.id),
    ["web", "bale"],
  );
  const lines = sourceUpdateReport(sources, []);
  assert.ok(lines.some((line) => line.includes("کانال تلگرام") && line.includes("متوقف")));
});

test("included vat quotes are stored without the 10 percent", () => {
  const taxed = applySourceTax(
    { observations: [{ factoryPrice: 74500, warehousePrice: null }] },
    "includes_vat",
  ) as { observations: Array<{ factoryPrice: number | null }> };
  assert.equal(taxed.observations[0]?.factoryPrice, 67730);
});

test("category report names skipped and other-category sources", () => {
  const sources = [
    source({ id: "web", name: "آهن آنلاین", address: "https://example.com/a" }),
    source({ id: "file", name: "اکسل کارخانه", sourceType: "excel", address: "" }),
    source({ id: "plain", name: "پیوان ساده", categoryCode: "plain", address: "https://example.com/p" }),
  ];
  const lines = sourceUpdateReport(sources, [], { groupCode: "rebar", categoryCode: "ribbed" });
  assert.ok(lines.some((line) => line.includes("آهن آنلاین") && line.includes("خوانده نشد")));
  assert.ok(lines.some((line) => line.includes("اکسل کارخانه") && line.includes("ورود دستی")));
  assert.ok(lines.some((line) => line.includes("پیوان ساده")));
});

test("pivan intakes are excluded when rebuilding from stored sources", () => {
  const sources = [
    source({ id: "ahan", name: "آهن آنلاین" }),
    source({ id: "other", name: "منبع سوم" }),
  ];
  const intakes = [
    {
      id: "1",
      sourceId: "pilot-pivan-rebar",
      sourceName: "پیوان",
      groupCode: "rebar",
      categoryCode: "ribbed",
      inputKind: "collect" as const,
      rawText: "",
      imageUrl: null,
      fileName: null,
      receivedAt: "2026-08-20T00:00:00.000Z",
      promptVersion: null,
      canPublish: false as const,
      error: null,
      result: { observations: [{ productCode: "RBR-A3-12", brandId: "rebar-ribbed-11", factoryPrice: 74500 }] },
    },
    {
      id: "2",
      sourceId: "ahan",
      sourceName: "آهن آنلاین",
      groupCode: "rebar",
      categoryCode: "ribbed",
      inputKind: "collect" as const,
      rawText: "",
      imageUrl: null,
      fileName: null,
      receivedAt: "2026-08-20T00:00:00.000Z",
      promptVersion: null,
      canPublish: false as const,
      error: null,
      result: { observations: [] },
    },
  ];
  const kept = intakesFromKeptSources(intakes, sources);
  assert.equal(kept.length, 1);
  assert.equal(kept[0]?.sourceName, "آهن آنلاین");
});
