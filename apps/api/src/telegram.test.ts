import assert from "node:assert/strict";
import { test } from "node:test";
import { CollectError } from "./collectError.ts";
import { parseTelegramChannel, telegramEntity, telegramFetchedUrl } from "./telegramChannel.ts";
import { collectTelegramChannel } from "./telegram.ts";

test("telegram usernames and public links parse", () => {
  assert.deepEqual(parseTelegramChannel("@ahantoday"), { kind: "username", username: "ahantoday" });
  assert.deepEqual(parseTelegramChannel("https://t.me/s/ahantoday"), { kind: "username", username: "ahantoday" });
  assert.equal(telegramFetchedUrl({ kind: "username", username: "ahantoday" }), "https://t.me/ahantoday");
});

test("telegram invite links stay rejected", () => {
  assert.throws(() => parseTelegramChannel("https://t.me/+invite"), CollectError);
  assert.throws(() => parseTelegramChannel("https://t.me/joinchat/abc"), CollectError);
});

test("member channel ids map to the official entity form", () => {
  const ref = parseTelegramChannel("https://t.me/c/1234567890");
  assert.deepEqual(ref, { kind: "channelId", channelId: "1234567890" });
  assert.equal(telegramEntity(ref), "-1001234567890");
});

test("authorized account reads recent channel messages without public preview", async () => {
  process.env.TELEGRAM_API_ID = "1";
  process.env.TELEGRAM_API_HASH = "hash";
  process.env.TELEGRAM_SESSION = "session";
  const result = await collectTelegramChannel("@ahantoday", async () => ({
    connect: async () => undefined,
    checkAuthorization: async () => true,
    getMessages: async () => [
      { date: 1_700_000_000, message: "میلگرد ۱۴ ذوب آهن ۷۶۵۰۰" },
      { date: 1_700_000_100, photo: {}, caption: "جدول امروز" },
    ],
  }));
  assert.equal(result.fetchedUrl, "https://t.me/ahantoday");
  assert.match(result.text, /میلگرد ۱۴ ذوب آهن ۷۶۵۰۰/);
  assert.match(result.text, /جدول امروز/);
  assert.match(result.text, /فایل یا تصویر کانال/);
});
