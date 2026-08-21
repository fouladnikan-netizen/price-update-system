import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LARGE_PAGE_SKIP_MODEL,
  MODEL_FALLBACK_MAX_CHARS,
  shouldUseModelFallback,
} from "./extract.ts";

test("short messages still go to the model when the table parser finds little", () => {
  assert.equal(shouldUseModelFallback("قیمت میلگرد ۱۴ ذوب آهن ۷۶۵۰۰", 0), true);
  assert.equal(shouldUseModelFallback("x".repeat(6_000), 1), true);
});

test("parsed mill tables do not call the model", () => {
  assert.equal(shouldUseModelFallback("x".repeat(80_000), 12), false);
});

test("large unparsed pages skip the model so the update queue is not blocked", () => {
  assert.equal(shouldUseModelFallback("x".repeat(MODEL_FALLBACK_MAX_CHARS + 1), 0), false);
  assert.equal(shouldUseModelFallback("x".repeat(27_873), 0), false);
  assert.ok(LARGE_PAGE_SKIP_MODEL.includes("بقیه"));
});
