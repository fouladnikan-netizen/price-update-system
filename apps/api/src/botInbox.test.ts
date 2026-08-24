import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";
import { tehranJalaliKey } from "../../web/src/intake/dates.ts";
import { saveAppliedPrices, upsertAppliedPrices } from "./appliedPrices.ts";
import { dailyRowsFromObservations, processBaleInbox } from "./botInbox.ts";
import type { ObservationMatch } from "./match.ts";

import { getScopeBrands } from "./catalog.ts";

process.env.APPLIED_PRICES_DIR = mkdtempSync(join(tmpdir(), "price-update-applied-"));

const rebarBrands = getScopeBrands("rebar", "ribbed");
const esfahanBrandId = rebarBrands.find((item) => item.name === "ذوب آهن اصفهان")?.id ?? "";

function observation(overrides: Partial<ObservationMatch>): ObservationMatch {
  return {
    rawText: "میلگرد ۱۴ ذوب آهن",
    productCode: "RBR-000002",
    productName: "میلگرد آجدار A3 سایز 14  ذوب آهن",
    brandId: esfahanBrandId,
    brandName: "ذوب آهن اصفهان",
    matchMethod: "grade_size",
    factoryPrice: 76500,
    warehousePrice: null,
    unit: "toman_per_kg",
    confidence: 0.9,
    status: "pending_review",
    reasons: [],
    notes: null,
    ...overrides,
  };
}

test("matched bot observations become daily rial prices without publishing", () => {
  const rows = dailyRowsFromObservations([observation({})], "کانال نمونه", "1405/05/30");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.productCode, "RBR-000002");
  assert.equal(rows[0]?.brandId, esfahanBrandId);
  assert.equal(rows[0]?.factoryPrice, 842000);
  assert.equal(rows[0]?.factorySource, "کانال نمونه");
});

test("unmatched observations are not applied", () => {
  const rows = dailyRowsFromObservations(
    [observation({ productCode: null, brandId: null, status: "unmatched" })],
    "کانال نمونه",
  );
  assert.equal(rows.length, 0);
});

test("private forwarded messages are extracted and applied without an app button", async () => {
  const calls: string[] = [];
  const result = await processBaleInbox(async (method, body) => {
    calls.push(method);
    if (method === "getUpdates") {
      return [
        {
          update_id: 9,
          message: {
            date: 1_700_000_000,
            text: "میلگرد ۱۴ ذوب آهن ۷۶۵۰۰",
            chat: { id: 77, type: "private" },
            forward_from_chat: { username: "steel_prices", title: "فولاد", type: "channel" },
          },
        },
      ];
    }
    if (method === "sendMessage") return { message_id: 1 };
    throw new Error(String(method) + JSON.stringify(body));
  }, async () => ({
    promptVersion: "test",
    canPublish: false as const,
    extracted: { is_price_message: true, message_kind: "price_list" as const, items: [], suspicious_reasons: [] },
    observations: [observation({})],
  }));
  assert.equal(result.applied, 1);
  assert.ok(calls.includes("getUpdates"));
  assert.ok(calls.includes("sendMessage"));
});

test("operator policy messages adjust today's prices without extraction", async () => {
  process.env.APPLIED_PRICES_DIR = mkdtempSync(join(tmpdir(), "price-update-policy-inbox-"));
  saveAppliedPrices([]);
  upsertAppliedPrices([
    {
      date: tehranJalaliKey(),
      productCode: "RBR-000002",
      brandId: esfahanBrandId,
      brandName: "ذوب آهن اصفهان",
      factoryPrice: 842_000,
      warehousePrice: null,
      factorySource: "لیست صبح",
      warehouseSource: null,
      updatedAt: "2026-08-21T08:00:00.000Z",
    },
  ]);
  let extracted = false;
  const replies: string[] = [];
  const result = await processBaleInbox(async (method, body) => {
    if (method === "getUpdates") {
      return [
        {
          update_id: 12,
          message: {
            text: "تمام دسته میلگرد آجدار مثبت ۱۰۰۰ ریال",
            chat: { id: 77, type: "private" },
          },
        },
      ];
    }
    if (method === "sendMessage") {
      replies.push(String((body as { text?: string }).text ?? ""));
      return { message_id: 2 };
    }
    throw new Error(String(method));
  }, async () => {
    extracted = true;
    return {
      promptVersion: "test",
      canPublish: false as const,
      extracted: { is_price_message: true, message_kind: "price_list" as const, items: [], suspicious_reasons: [] },
      observations: [],
    };
  });
  assert.equal(extracted, false);
  assert.equal(result.applied, 1);
  assert.ok(replies[0]?.includes("ریال"));
});
