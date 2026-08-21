import assert from "node:assert/strict";
import { test } from "node:test";
import { clipSourceText, htmlToText } from "./htmlText.ts";

test("keeps the mill heading with the price table", () => {
  const noise = "منو ".repeat(4000);
  const text = `${noise}میلگرد ذوب آهن اصفهان\nآخرین بروزرسانی\nسایز\nمحل تحویل\nقیمت (تومان)\n12\nA3\nکارخانه\n78550`;
  const clipped = clipSourceText(text, 500);
  assert.ok(clipped.includes("ذوب آهن اصفهان"));
  assert.ok(clipped.includes("78550"));
});

test("clips from the earliest price marker, not a later تومان heading", () => {
  const early = "قیمت میلگرد 8 آذر فولاد امین A2 4.5\n70545\n";
  const late = "قیمت (تومان)\nپاورقی";
  const text = `${early}${"x".repeat(90_000)}${late}`;
  const clipped = clipSourceText(text, 800);
  assert.ok(clipped.includes("آذر فولاد امین"));
  assert.ok(clipped.includes("70545"));
});

test("drops hidden in-tax spans and keeps the visible ex-tax price", () => {
  const html = `<span class="toggle-price-when-check in-tax" style="display: none">۷۴,۵۰۰</span><span class="ex-tax">۶۷,۷۰۰</span>`;
  const text = htmlToText(html);
  assert.doesNotMatch(text, /۷۴,۵۰۰/);
  assert.match(text, /۶۷,۷۰۰/);
});
