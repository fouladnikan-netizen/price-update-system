import assert from "node:assert/strict";
import { test } from "node:test";
import { officialNameFromBrandFile } from "./brandOfficial.ts";

test("rebar official names come from Brand.numbers", () => {
  assert.equal(officialNameFromBrandFile("rebar", "ribbed", "ذوب آهن اصفهان"), "ذوب‌آهن اصفهان");
  assert.equal(officialNameFromBrandFile("rebar", "ribbed", "نیشابور"), "مجتمع فولاد خراسان");
  assert.equal(officialNameFromBrandFile("rebar", "ribbed", "فایکو"), "فولاد البرز ایرانیان");
  assert.equal(officialNameFromBrandFile("rebar", "ribbed", "آناهیتا"), "فولاد آناهیتا گیلان");
  assert.equal(officialNameFromBrandFile("rebar", "plain", "کویر کاشان"), "شرکت تولیدی فولاد سپید فراب کویر");
});

test("beam and angle official names match the Brand table of that group", () => {
  assert.equal(officialNameFromBrandFile("beam", "ipe", "فایکو"), "شرکت فولاد البرز ایرانیان");
  assert.equal(officialNameFromBrandFile("beam", "ipe", "خیام نیشابور"), "شرکت فولاد خیام سپهر نیشابور");
  assert.equal(officialNameFromBrandFile("angle", "angle", "شکفته مشهد"), "گروه صنعتی شکفته");
});

test("sheet mill names use the matching Brand table", () => {
  assert.equal(officialNameFromBrandFile("sheet", "black", "فولاد مبارکه"), "شرکت فولاد مبارکه اصفهان");
  assert.equal(officialNameFromBrandFile("sheet", "ck45", "اکسین اهواز"), "شرکت فولاد اکسین خوزستان");
});

test("unmapped or ambiguous website tags stay empty", () => {
  assert.equal(officialNameFromBrandFile("rebar", "ribbed", "فولاد بناب"), "");
  assert.equal(officialNameFromBrandFile("beam", "ipe", "اطلس"), "");
  assert.equal(officialNameFromBrandFile("profile", "mobli", "آریان فولاد"), "");
  assert.equal(officialNameFromBrandFile("sheet", "wear", "واردات هند"), "");
});
