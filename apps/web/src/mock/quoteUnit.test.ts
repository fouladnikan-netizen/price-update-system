import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acceptedSourceQuoteUnits,
  displayQuoteUnit,
  priceUnitText,
  quoteUnitForLane,
  toWebsiteKilogramPrice,
} from "./quoteUnit.ts";

test("IPE factory is per kilogram and warehouse is per bar", () => {
  assert.equal(quoteUnitForLane("beam", "ipe", "factory"), "کیلوگرم");
  assert.equal(quoteUnitForLane("beam", "ipe", "warehouse"), "شاخه");
  assert.deepEqual(acceptedSourceQuoteUnits("beam", "ipe", "warehouse"), ["شاخه"]);
});

test("pipe display is kilogram; warehouse sources may also be per bar", () => {
  assert.equal(displayQuoteUnit("pipe", "seamless", "factory"), "کیلوگرم");
  assert.equal(displayQuoteUnit("pipe", "seamless", "warehouse"), "کیلوگرم");
  assert.deepEqual(acceptedSourceQuoteUnits("pipe", "galvanized", "factory"), ["کیلوگرم"]);
  assert.deepEqual(acceptedSourceQuoteUnits("pipe", "galvanized", "warehouse"), ["کیلوگرم", "شاخه"]);
});

test("hash beam has no IPE or pipe override", () => {
  assert.equal(quoteUnitForLane("beam", "h", "factory"), null);
  assert.equal(quoteUnitForLane("rebar", "ribbed", "factory"), null);
});

test("price cell copy names the quote unit", () => {
  assert.equal(priceUnitText("کیلوگرم"), "ریال / کیلوگرم");
  assert.equal(priceUnitText("شاخه"), "ریال / شاخه");
  assert.equal(priceUnitText(null), "ریال");
});

test("pipe bar quotes convert to kilogram only with a known bar weight", () => {
  assert.equal(toWebsiteKilogramPrice(120_000, "کیلوگرم", null), 120_000);
  assert.equal(toWebsiteKilogramPrice(600_000, "شاخه", 12), 50_000);
  assert.equal(toWebsiteKilogramPrice(600_000, "شاخه", null), null);
  assert.equal(toWebsiteKilogramPrice(600_000, "شاخه", 0), null);
  assert.equal(toWebsiteKilogramPrice(0, "کیلوگرم", 12), null);
});
