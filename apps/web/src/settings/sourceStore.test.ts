import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultPilotSources,
  emptySourceInput,
  isDroppedSource,
  needsIdentityEnrichment,
  patchSource,
  upsertSource,
  validateSourceInput,
  type PriceSource,
} from "./sourceStore.ts";

function sampleSource(overrides: Partial<PriceSource> = {}): PriceSource {
  const now = "2026-08-20T00:00:00.000Z";
  return {
    id: "src-1",
    name: "کانال میلگرد",
    sourceType: "manual",
    address: "",
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
    identityStatus: "incomplete",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test("quick-add can skip address for website sources", () => {
  const input = { ...emptySourceInput(), name: "سایت رقیب", sourceType: "website" as const, address: "" };
  assert.equal(validateSourceInput(input), "برای سایت، تلگرام و بله، آدرس یا شناسه کانال لازم است.");
  assert.equal(validateSourceInput(input, { allowIncomplete: true }), null);
});

test("thin incomplete sources need identity enrichment", () => {
  assert.equal(needsIdentityEnrichment(sampleSource()), true);
  assert.equal(needsIdentityEnrichment(sampleSource({ identityStatus: "suggested" })), false);
  assert.equal(needsIdentityEnrichment(sampleSource({ identityStatus: "confirmed" })), false);
  assert.equal(needsIdentityEnrichment(sampleSource({ address: "https://example.com" })), false);
});

test("confirming identity writes official cells without inventing products", () => {
  const patched = patchSource([sampleSource()], "src-1", {
    officialName: "شرکت نمونه",
    officialUrl: "https://example.com",
    address: "https://example.com",
    identityStatus: "confirmed",
  });
  assert.equal(patched[0]?.officialName, "شرکت نمونه");
  assert.equal(patched[0]?.officialUrl, "https://example.com");
  assert.equal(patched[0]?.identityStatus, "confirmed");
  assert.equal(patched[0]?.autoPublish, false);
});

test("new source without address stays incomplete and usable", () => {
  const next = upsertSource([], { ...emptySourceInput(), name: "کانال ناقص", address: "" });
  assert.equal(next[0]?.identityStatus, "incomplete");
  assert.equal(next[0]?.officialName, null);
  assert.equal(needsIdentityEnrichment(next[0]!), true);
});

test("pilot rebar sources have public website addresses", () => {
  const seeded = defaultPilotSources("2026-08-20T00:00:00.000Z");
  assert.equal(seeded.length, 1);
  assert.equal(seeded[0]?.sourceType, "website");
  assert.match(seeded[0]?.address ?? "", /ahanonline\.com/);
});

test("pivan is dropped from the source list", () => {
  assert.equal(isDroppedSource({ id: "pilot-pivan-rebar", name: "پیوان" }), true);
  assert.equal(isDroppedSource({ id: "other", name: "آهن آنلاین" }), false);
});
