import { getBaleConfig } from "./env.ts";
import { pingBaleBot } from "./bale.ts";

const bot = getBaleConfig();
if (!bot.configured) {
  console.error("BALE_BOT_TOKEN را در فایل .env بگذارید. توکن را در گیت نگذارید.");
  process.exit(1);
}

const ping = await pingBaleBot();
if (!ping.ok) {
  console.error(ping.error ?? "اتصال بازوی بله برقرار نشد.");
  process.exit(1);
}

console.log(ping.username ? `بازوی بله وصل است: @${ping.username}` : "بازوی بله وصل است.");
console.log("ادمین کانال دیگران لازم نیست. پیام را برای همین بازو Forward کنید تا در به‌روزرسانی خوانده شود.");
