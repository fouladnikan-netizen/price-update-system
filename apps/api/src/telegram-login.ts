import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { getTelegramConfig } from "./env.ts";

const config = getTelegramConfig();
if (!config.apiId || !config.apiHash) {
  console.error("TELEGRAM_API_ID و TELEGRAM_API_HASH را در فایل .env بگذارید. نشست را در گیت نگذارید.");
  process.exit(1);
}

const { TelegramClient } = await import("telegram");
const { StringSession } = await import("telegram/sessions/index.js");
const rl = createInterface({ input, output });

const client = new TelegramClient(new StringSession(""), config.apiId, config.apiHash, {
  connectionRetries: 5,
});

await client.start({
  phoneNumber: async () => (await rl.question("شماره اکانت سازمانی با کد کشور: ")).trim(),
  phoneCode: async () => (await rl.question("کد ورود تلگرام: ")).trim(),
  password: async () => (await rl.question("رمز دو مرحله‌ای اگر هست (وگرنه خالی): ")).trim(),
  onError: (error) => console.error(error.message),
});

const session = client.session.save();
if (typeof session !== "string" || !session) {
  console.error("نشست ساخته نشد.");
  process.exit(1);
}

console.log("\nاین مقدار را در .env بگذارید. فایل را commit نکنید:\n");
console.log(`TELEGRAM_SESSION=${session}`);
await client.disconnect();
rl.close();
