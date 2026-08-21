import assert from "node:assert/strict";
import { test } from "node:test";
import { roundRialToThousands, toRegisteredRial } from "./rial.ts";

test("rial amounts round so the last three digits are zero", () => {
  assert.equal(roundRialToThousands(765_500), 766_000);
  assert.equal(roundRialToThousands(765_499), 765_000);
  assert.equal(roundRialToThousands(766_000), 766_000);
});

test("toman quotes become vat-inclusive rial rounded to thousands", () => {
  assert.equal(toRegisteredRial(69_600), 766_000);
  assert.equal(toRegisteredRial(76_550), 842_000);
});

test("already-rial values are only rounded to thousands", () => {
  assert.equal(toRegisteredRial(765_500), 766_000);
  assert.equal(toRegisteredRial(842_000), 842_000);
  assert.equal(toRegisteredRial(765_500, "rial_per_kg"), 766_000);
  assert.equal(toRegisteredRial(null), null);
});

test("toman per bar still receives vat and rial conversion", () => {
  assert.equal(toRegisteredRial(2_500_000, "toman_per_bar"), 27_500_000);
});
