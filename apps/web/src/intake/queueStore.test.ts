import assert from "node:assert/strict";
import { test } from "node:test";
import { buildQueueItems, openQueueCount } from "./queueStore.ts";
import type { IntakeRecord } from "./rawStore.ts";

const base: IntakeRecord = {
  id: "raw-1",
  sourceId: null,
  sourceName: "ورود آزمایشی",
  groupCode: "beam",
  categoryCode: "ipe",
  rawText: "تیرآهن ۱۴ اصفهان ۴۲۰۰۰",
  inputKind: "text",
  imageUrl: null,
  fileName: null,
  receivedAt: "2026-08-20T00:00:00.000Z",
  promptVersion: "extract.steel.v1",
  canPublish: false,
  error: null,
  result: {
    promptVersion: "extract.steel.v1",
    canPublish: false,
    observations: [
      {
        rawText: "تیرآهن ۱۴ اصفهان ۴۲۰۰۰",
        productCode: "BEAM-14",
        productName: "تیرآهن 14",
        brandId: "beam-ipe-02",
        brandName: "اصفهان",
        matchMethod: "product_code",
        factoryPrice: 42000,
        warehousePrice: null,
        unit: "toman_per_kg",
        confidence: 0.8,
        status: "pending_review",
        reasons: [],
      },
    ],
  },
};

test("matched observations enter the human queue and cannot publish", () => {
  const items = buildQueueItems([base], {});
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "matched");
  assert.equal(items[0].status, "pending_review");
  assert.equal(items[0].canPublish, false);
  assert.equal(items[0].warehousePrice, null);
  assert.equal(items[0].factoryPrice, 462_000);
  assert.equal(items[0].unit, "rial_per_kg");
  assert.equal(openQueueCount(items), 1);
});

test("unmatched observations stay unmatched and invent no sku", () => {
  const unmatched: IntakeRecord = {
    ...base,
    id: "raw-2",
    result: {
      promptVersion: "extract.steel.v1",
      canPublish: false,
      observations: [
        {
          rawText: "کالای نامعلوم",
          productCode: null,
          productName: null,
          brandId: null,
          brandName: null,
          matchMethod: "unmatched",
          factoryPrice: 1000,
          warehousePrice: null,
          unit: null,
          confidence: 0.2,
          status: "unmatched",
          reasons: ["تطبیق قطعی با product_code ممکن نشد"],
        },
      ],
    },
  };
  const items = buildQueueItems([unmatched], {});
  assert.equal(items[0].kind, "unmatched");
  assert.equal(items[0].productCode, null);
  assert.equal(items[0].status, "unmatched");
});

test("failed extract still queues the preserved raw text", () => {
  const failed: IntakeRecord = {
    ...base,
    id: "raw-3",
    error: "سرویس استخراج در دسترس نیست. متن خام ذخیره شد.",
    result: null,
  };
  const items = buildQueueItems([failed], {});
  assert.equal(items[0].kind, "unmatched");
  assert.equal(items[0].rawText, failed.rawText);
  assert.equal(openQueueCount(items), 1);
});

test("image intakes keep the stored file url on the queue item", () => {
  const image: IntakeRecord = {
    ...base,
    id: "raw-img",
    inputKind: "image",
    rawText: "تصویر: list.jpg",
    imageUrl: "/api/raw/11111111-1111-1111-1111-111111111111",
    fileName: "list.jpg",
  };
  const items = buildQueueItems([image], {});
  assert.equal(items[0].imageUrl, image.imageUrl);
  assert.equal(items[0].fileName, "list.jpg");
  assert.equal(items[0].canPublish, false);
});

test("approved items leave the open count", () => {
  const items = buildQueueItems([base], { "raw-1:0": "approved" });
  assert.equal(items[0].status, "approved");
  assert.equal(openQueueCount(items), 0);
});
