import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSourceIdentity } from "./sourceIdentity.ts";

test("identity parse keeps nulls when the model is unsure", () => {
  const parsed = parseSourceIdentity({
    officialName: "",
    officialUrl: "not-a-url",
    note: "نامشخص است",
    confidence: 0.1,
  });
  assert.equal(parsed.officialName, null);
  assert.equal(parsed.officialUrl, null);
  assert.equal(parsed.note, "نامشخص است");
});

test("identity parse accepts a public https url", () => {
  const parsed = parseSourceIdentity({
    officialName: "ذوب‌آهن اصفهان",
    officialUrl: "https://www.esfahansteel.com",
    note: null,
    confidence: 0.7,
  });
  assert.equal(parsed.officialName, "ذوب‌آهن اصفهان");
  assert.equal(parsed.officialUrl, "https://www.esfahansteel.com");
});
