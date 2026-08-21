import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeDigits, parseGradeFromText, parsePriceNumber, parseSizeFromText } from "./numbers.ts";

test("persian and arabic digits become ascii", () => {
  assert.equal(normalizeDigits("۳۸۵۰۰"), "38500");
  assert.equal(normalizeDigits("٤٢"), "42");
});

test("zero and empty prices become null", () => {
  assert.equal(parsePriceNumber(0), null);
  assert.equal(parsePriceNumber("۰"), null);
  assert.equal(parsePriceNumber(""), null);
  assert.equal(parsePriceNumber("—"), null);
});

test("comma-separated toman values parse", () => {
  assert.equal(parsePriceNumber("38,500"), 38500);
  assert.equal(parsePriceNumber("۳۸٬۵۰۰"), 38500);
});

test("size and grade are read from source wording", () => {
  assert.equal(parseSizeFromText("میلگرد ۱۲ میل ذوب آهن"), "12");
  assert.equal(parseGradeFromText("A3 کارخانه 78550"), "A3");
});
