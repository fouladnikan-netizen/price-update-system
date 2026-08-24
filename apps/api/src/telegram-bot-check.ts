import { getTelegramBotConfig } from "./env.ts";
import { pingTelegramBot } from "./telegramBot.ts";

const bot = getTelegramBotConfig();
if (!bot.configured) {
  console.error("TELEGRAM_BOT_TOKEN را در فایل .env بگذارید. توکن را در گیت نگذارید.");
  process.exit(1);
}

const ping = await pingTelegramBot();
if (!ping.ok) {
  console.error(ping.error ?? "اتصال ربات تلگرام برقرار نشد.");
  process.exit(1);
}

console.log(ping.username ? `ربات تلگرام وصل است: @${ping.username}` : "ربات تلگرام وصل است.");
console.log("حالت: long polling محلی. استخراج قیمت و انتشار وب‌سایت خاموش است.");
