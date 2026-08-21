import assert from "node:assert/strict";
import { test } from "node:test";
import { CollectError, collectPublicText, fetchPublicPage, isBlockedIp, MAX_BYTES, normalizeCollectUrl } from "./collect.ts";
import { htmlToText, looksLikeAccessControl } from "./htmlText.ts";

test("telegram handle becomes public preview url", () => {
  assert.equal(normalizeCollectUrl("telegram", "@steel_prices"), "https://t.me/s/steel_prices");
  assert.equal(normalizeCollectUrl("telegram", "https://t.me/steel_prices"), "https://t.me/s/steel_prices");
  assert.equal(normalizeCollectUrl("telegram", "https://t.me/s/steel_prices"), "https://t.me/s/steel_prices");
});

test("private telegram invite links are rejected", () => {
  assert.throws(() => normalizeCollectUrl("telegram", "https://t.me/c/123456"), CollectError);
  assert.throws(() => normalizeCollectUrl("telegram", "https://t.me/+invite"), CollectError);
});

test("bale handle becomes public ble.ir url", () => {
  assert.equal(normalizeCollectUrl("bale", "@steel_prices"), "https://ble.ir/steel_prices");
  assert.equal(normalizeCollectUrl("bale", "https://ble.ir/steel_prices"), "https://ble.ir/steel_prices");
});

test("private bale invite links are rejected", () => {
  assert.throws(() => normalizeCollectUrl("bale", "https://ble.ir/join/abc"), CollectError);
  assert.throws(() => normalizeCollectUrl("bale", "-1001234567890"), CollectError);
});

test("telegram collect stays paused without an org session", async () => {
  process.env.TELEGRAM_API_ID = "";
  process.env.TELEGRAM_API_HASH = "";
  process.env.TELEGRAM_SESSION = "";
  await assert.rejects(
    () => collectPublicText("telegram", "@steel_prices"),
    (error: unknown) => error instanceof CollectError && /متوقف/.test(error.message),
  );
});

test("bale collect asks for the org bot token instead of scraping ble.ir", async () => {
  process.env.BALE_BOT_TOKEN = "";
  process.env.BALE_SESSION = "";
  await assert.rejects(
    () => collectPublicText("bale", "@steel_prices"),
    (error: unknown) => error instanceof CollectError && /BALE_BOT_TOKEN|توکن بازو/.test(error.message),
  );
});

test("private and loopback urls are rejected", () => {
  assert.equal(isBlockedIp("127.0.0.1"), true);
  assert.equal(isBlockedIp("10.0.0.8"), true);
  assert.equal(isBlockedIp("192.168.0.4"), true);
  assert.equal(isBlockedIp("172.16.0.2"), true);
  assert.equal(isBlockedIp("8.8.8.8"), false);
  assert.throws(() => normalizeCollectUrl("website", "http://127.0.0.1/prices"), CollectError);
  assert.throws(() => normalizeCollectUrl("website", "http://localhost/admin"), CollectError);
});

test("html tables become readable text", () => {
  const text = htmlToText("<html><script>secret()</script><table><tr><td>میلگرد ۱۴</td><td>۴۲۰۰۰</td></tr></table></html>");
  assert.match(text, /میلگرد ۱۴/);
  assert.match(text, /۴۲۰۰۰/);
  assert.doesNotMatch(text, /secret/);
});

test("captcha and login pages are not collected", () => {
  assert.match(looksLikeAccessControl("please solve recaptcha", 200) ?? "", /CAPTCHA/);
  assert.match(looksLikeAccessControl("ok", 403) ?? "", /ورود/);
  assert.equal(looksLikeAccessControl("<p>قیمت میلگرد</p>", 200), null);
});

test("html mill pages over 1.5mb are still collected", async () => {
  const html = `<html><body><h1>میلگرد ذوب آهن اصفهان</h1><p>${"a".repeat(1_800_000)}</p><table><tr><td>14 A3</td></tr></table></body></html>`;
  const page = await fetchPublicPage("https://example.com/rebar", {
    skipDns: true,
    fetchImpl: async () =>
      new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }),
  });
  assert.match(page.body, /میلگرد ذوب آهن اصفهان/);
});

test("oversized non-html downloads are rejected", async () => {
  await assert.rejects(
    () =>
      fetchPublicPage("https://example.com/file.bin", {
        skipDns: true,
        fetchImpl: async () =>
          new Response(Buffer.alloc(MAX_BYTES + 64, 1), {
            status: 200,
            headers: { "content-type": "application/octet-stream" },
          }),
      }),
    (error: unknown) => error instanceof CollectError && /حجم صفحه عمومی/.test(error.message),
  );
});
