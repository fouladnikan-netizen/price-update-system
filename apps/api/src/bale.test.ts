import assert from "node:assert/strict";
import { test } from "node:test";
import { CollectError } from "./collectError.ts";
import { baleChatId, baleFetchedUrl, balePreviewUrl, parseBaleChannel } from "./baleChannel.ts";
import { collectBaleChannel, pingBaleBot } from "./bale.ts";
import { collectBaleChannelAsUser } from "./bale-user.ts";

test("bale usernames and public links parse", () => {
  assert.deepEqual(parseBaleChannel("@steel_prices"), { kind: "username", username: "steel_prices" });
  assert.deepEqual(parseBaleChannel("https://ble.ir/steel_prices"), { kind: "username", username: "steel_prices" });
  assert.equal(baleFetchedUrl({ kind: "username", username: "steel_prices" }), "https://ble.ir/steel_prices");
  assert.equal(balePreviewUrl({ kind: "username", username: "steel_prices" }), "https://ble.ir/steel_prices");
  assert.equal(baleChatId({ kind: "username", username: "steel_prices" }), "@steel_prices");
});

test("bale invite links stay rejected", () => {
  assert.throws(() => parseBaleChannel("https://ble.ir/join/abc"), CollectError);
  assert.throws(() => parseBaleChannel("https://ble.ir/+invite"), CollectError);
});

test("numeric bale chat ids stay internal", () => {
  const ref = parseBaleChannel("-1001234567890");
  assert.deepEqual(ref, { kind: "chatId", chatId: "-1001234567890" });
  assert.throws(() => balePreviewUrl(ref), CollectError);
});

test("bot inbox reads forwarded channel messages without admin", async () => {
  process.env.BALE_BOT_TOKEN = "token";
  const result = await collectBaleChannel("@steel_prices", async (method) => {
    if (method === "getMe") return { username: "nikan_price_collector_bot" };
    if (method === "getWebhookInfo") return { url: "" };
    if (method === "getUpdates") {
      return [
        {
          update_id: 1,
          message: {
            date: 1_700_000_000,
            text: "میلگرد ۱۴ ذوب آهن ۷۶۵۰۰",
            chat: { id: 99, type: "private" },
            forward_from_chat: { id: 11, username: "steel_prices", type: "channel" },
          },
        },
        {
          update_id: 2,
          message: {
            date: 1_700_000_100,
            caption: "جدول امروز",
            photo: [{}],
            chat: { id: 99, type: "private" },
            forward_from_chat: { id: 11, username: "steel_prices", type: "channel" },
          },
        },
      ];
    }
    throw new Error(method);
  });
  assert.equal(result.fetchedUrl, "https://ble.ir/steel_prices");
  assert.match(result.text, /میلگرد ۱۴ ذوب آهن ۷۶۵۰۰/);
  assert.match(result.text, /جدول امروز/);
  assert.match(result.text, /فایل یا تصویر کانال/);
});

test("bot username source reads every private inbox message", async () => {
  process.env.BALE_BOT_TOKEN = "token";
  const result = await collectBaleChannel("@nikan_price_collector_bot", async (method) => {
    if (method === "getMe") return { username: "nikan_price_collector_bot" };
    if (method === "getWebhookInfo") return { url: "" };
    if (method === "getUpdates") {
      return [
        {
          update_id: 3,
          message: {
            date: 1_700_000_200,
            text: "میلگرد ۱۶ نیشابور ۷۸۰۰۰",
            chat: { id: 99, type: "private" },
          },
        },
      ];
    }
    throw new Error(method);
  });
  assert.match(result.text, /میلگرد ۱۶ نیشابور ۷۸۰۰۰/);
});

test("member user account reads recent channel messages", async () => {
  process.env.BALE_SESSION = "1:session";
  const result = await collectBaleChannelAsUser("@steel_prices", async () => ({
    connect: async () => undefined,
    search_username: async () => ({ group: { id: "11|3", username: "steel_prices" } }),
    get_chat: async () => ({ id: "11|3", username: "steel_prices" }),
    load_history: async () => [
      { date: 1_700_000_000, content: "میلگرد ۱۴ ذوب آهن ۷۶۵۰۰" },
      { date: 1_700_000_100, caption: "جدول امروز" },
    ],
  }));
  assert.equal(result.fetchedUrl, "https://ble.ir/steel_prices");
  assert.match(result.text, /میلگرد ۱۴ ذوب آهن ۷۶۵۰۰/);
  assert.match(result.text, /جدول امروز/);
});

test("bale ping reports the official bot username", async () => {
  process.env.BALE_BOT_TOKEN = "token";
  const ping = await pingBaleBot(async (method) => {
    assert.equal(method, "getMe");
    return { username: "org_price_bot", first_name: "org" };
  });
  assert.equal(ping.ok, true);
  assert.equal(ping.username, "org_price_bot");
});
