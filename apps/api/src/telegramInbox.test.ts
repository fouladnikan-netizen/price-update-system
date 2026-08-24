import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildRawRecord,
  describeOrigin,
  ingestTelegramUpdates,
  isHealthCommand,
  processTelegramInbox,
  TELEGRAM_BOT_HEALTH_REPLY,
} from "./telegramInbox.ts";
import { describeTelegramBotError, pingTelegramBot, redactSecret } from "./telegramBot.ts";

process.env.APPLIED_PRICES_DIR = mkdtempSync(join(tmpdir(), "price-update-telegram-bot-"));
process.env.TELEGRAM_BOT_TOKEN = "secret-telegram-token-do-not-leak";

const receivedAt = new Date("2026-08-24T06:00:00.000Z");

test("health command matches /health with optional bot mention", () => {
  assert.equal(isHealthCommand("/health"), true);
  assert.equal(isHealthCommand("/health@price_update_nikan_bot"), true);
  assert.equal(isHealthCommand("/start"), false);
});

test("secret token is stripped from logs and error text", () => {
  const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
  const leaked = `https://api.telegram.org/bot${token}/getUpdates unauthorized`;
  assert.equal(redactSecret(leaked, token).includes(token), false);
  assert.equal(describeTelegramBotError("Unauthorized"), "توکن ربات تلگرام نامعتبر است.");
});

test("simple private text is stored as raw input without extraction or replies", async () => {
  const saved: { fileName: string; sourceUrl: string; text: string }[] = [];
  const logs: string[] = [];
  const calls: string[] = [];
  const result = await ingestTelegramUpdates(
    [
      {
        update_id: 11,
        message: {
          message_id: 41,
          date: 1_700_000_000,
          text: "سلام. این یک پیام ساده است.",
          chat: { id: 77, type: "private", username: "operator" },
        },
      },
    ],
    {
      request: async (method) => {
        calls.push(method);
        throw new Error(method);
      },
      saveRaw: (input) => {
        saved.push(input);
        return {
          id: "raw-1",
          fileName: input.fileName,
          sourceUrl: input.sourceUrl,
          byteSize: input.text.length,
          storedName: "raw-1.txt",
          createdAt: receivedAt.toISOString(),
        };
      },
      log: (line) => logs.push(line),
      now: () => receivedAt,
      loadOffset: () => 0,
      token: process.env.TELEGRAM_BOT_TOKEN,
    },
  );

  assert.equal(result.saved, 1);
  assert.equal(result.sent, 0);
  assert.equal(calls.length, 0);
  assert.match(saved[0]?.text ?? "", /سلام\. این یک پیام ساده است/);
  assert.match(saved[0]?.text ?? "", /message_id: 41/);
  assert.match(saved[0]?.sourceUrl ?? "", /telegram:bot:chat\/77\/message\/41/);
  assert.equal((saved[0]?.sourceUrl ?? "").includes("secret-telegram-token"), false);
  assert.equal(logs.some((line) => line.includes("secret-telegram-token")), false);
  assert.match(logs[0] ?? "", /"messageId":41/);
});

test("forwarded channel message keeps origin and is stored only as raw input", async () => {
  const saved: { fileName: string; sourceUrl: string; text: string }[] = [];
  const message = {
    message_id: 42,
    date: 1_700_000_100,
    text: "میلگرد ۱۴ ذوب آهن ۷۶۵۰۰",
    chat: { id: 77, type: "private" },
    forward_from_chat: { id: -10011, username: "steel_prices", title: "فولاد", type: "channel" },
    forward_origin: {
      type: "channel",
      chat: { id: -10011, username: "steel_prices", title: "فولاد", type: "channel" },
      message_id: 900,
    },
  };
  assert.equal(describeOrigin(message), "forward:channel:@steel_prices");
  const record = buildRawRecord(message, receivedAt);
  assert.match(record.text, /origin: forward:channel:@steel_prices/);
  assert.match(record.text, /میلگرد ۱۴ ذوب آهن ۷۶۵۰۰/);

  const result = await ingestTelegramUpdates([{ update_id: 12, message }], {
    request: async () => {
      throw new Error("sendMessage must not run for ordinary forwards");
    },
    saveRaw: (input) => {
      saved.push(input);
      return {
        id: "raw-2",
        fileName: input.fileName,
        sourceUrl: input.sourceUrl,
        byteSize: input.text.length,
        storedName: "raw-2.txt",
        createdAt: receivedAt.toISOString(),
      };
    },
    log: () => undefined,
    now: () => receivedAt,
    loadOffset: () => 0,
    token: process.env.TELEGRAM_BOT_TOKEN,
  });

  assert.equal(result.saved, 1);
  assert.equal(result.sent, 0);
  assert.match(saved[0]?.text ?? "", /forward:channel:@steel_prices/);
  assert.match(saved[0]?.text ?? "", /message_id: 42/);
});

test("private /health replies locally and never sends to channels", async () => {
  const sent: { chat_id?: unknown; text?: unknown }[] = [];
  const saved: string[] = [];
  const result = await processTelegramInbox({
    request: async (method, body) => {
      if (method === "getUpdates") {
        return [
          {
            update_id: 21,
            message: {
              message_id: 8,
              text: "/health",
              chat: { id: 77, type: "private" },
            },
          },
          {
            update_id: 22,
            message: {
              message_id: 9,
              text: "/health",
              chat: { id: -10099, type: "channel", title: "قیمت‌ها" },
            },
          },
        ];
      }
      if (method === "sendMessage") {
        sent.push(body ?? {});
        return { message_id: 1 };
      }
      throw new Error(method);
    },
    saveRaw: (input) => {
      saved.push(input.text);
      return {
        id: String(saved.length),
        fileName: input.fileName,
        sourceUrl: input.sourceUrl,
        byteSize: input.text.length,
        storedName: `${saved.length}.txt`,
        createdAt: receivedAt.toISOString(),
      };
    },
    log: () => undefined,
    now: () => receivedAt,
    loadOffset: () => 0,
    saveOffset: () => undefined,
    token: process.env.TELEGRAM_BOT_TOKEN,
  });

  assert.equal(result.saved, 2);
  assert.equal(result.sent, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.chat_id, 77);
  assert.equal(sent[0]?.text, TELEGRAM_BOT_HEALTH_REPLY);
  assert.equal(JSON.stringify(sent).includes("secret-telegram-token"), false);
});

test("getUpdates long-poll path stores both a simple message and a forward", async () => {
  const saved: string[] = [];
  const methods: string[] = [];
  const result = await processTelegramInbox({
    request: async (method, body) => {
      methods.push(method);
      if (method === "getUpdates") {
        assert.deepEqual(body?.allowed_updates, ["message", "edited_message"]);
        return [
          {
            update_id: 31,
            message: {
              message_id: 1,
              text: "پیام ساده آزمایشی",
              chat: { id: 5, type: "private" },
            },
          },
          {
            update_id: 32,
            message: {
              message_id: 2,
              text: "پیام فورواردشده آزمایشی",
              chat: { id: 5, type: "private" },
              forward_from_chat: { username: "mill_channel", type: "channel" },
            },
          },
        ];
      }
      throw new Error(method);
    },
    saveRaw: (input) => {
      saved.push(input.text);
      return {
        id: String(saved.length),
        fileName: input.fileName,
        sourceUrl: input.sourceUrl,
        byteSize: input.text.length,
        storedName: `${saved.length}.txt`,
        createdAt: receivedAt.toISOString(),
      };
    },
    log: () => undefined,
    now: () => receivedAt,
    loadOffset: () => 0,
    saveOffset: () => undefined,
    token: process.env.TELEGRAM_BOT_TOKEN,
  });

  assert.equal(methods.join(","), "getUpdates");
  assert.equal(result.saved, 2);
  assert.equal(result.sent, 0);
  assert.match(saved[0] ?? "", /پیام ساده آزمایشی/);
  assert.match(saved[1] ?? "", /پیام فورواردشده آزمایشی/);
  assert.match(saved[1] ?? "", /forward:@mill_channel/);
});

test("pingTelegramBot does not echo the token on failure", async () => {
  const ping = await pingTelegramBot(async () => {
    throw new Error(`Unauthorized token=secret-telegram-token-do-not-leak`);
  });
  assert.equal(ping.ok, false);
  assert.equal((ping.error ?? "").includes("secret-telegram-token-do-not-leak"), false);
});
