import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { getBaleUserConfig } from "./env.ts";

const existing = getBaleUserConfig();
if (existing.configured) {
  console.log("نشست کاربری بله از قبل در .env هست. اگر منقضی شده، BALE_SESSION را پاک کنید و دوباره وارد شوید.");
}

const rl = createInterface({ input, output });
const phone =
  (process.env.BALE_PHONE ?? "").trim() ||
  (await rl.question("شماره اکانت سازمانی بله با کد کشور (مثلاً +98912…): ")).trim();
rl.close();

if (!/^\+?\d{10,15}$/.test(phone.replace(/\s/g, ""))) {
  console.error("شماره معتبر نیست.");
  process.exit(1);
}

const sessionDir = await mkdtemp(join(tmpdir(), "price-update-bale-"));
const { Client } = (await import("balejs")) as {
  Client: new (auth: string, options?: { sessionDir?: string; sessionName?: string }) => {
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
  };
};

const client = new Client(phone, { sessionDir, sessionName: "org" });
await client.connect();
const session = (await readFile(join(sessionDir, "org.session"), "utf8")).trim();
await client.disconnect();

if (!/^\d+:.+$/.test(session)) {
  console.error("نشست ساخته نشد.");
  process.exit(1);
}

console.log("\nاین مقدار را در .env بگذارید. فایل را commit نکنید:\n");
console.log(`BALE_SESSION=${session}`);
console.log("\nبازو کانال دیگران را نمی‌خواند. جمع‌آوری با همین اکانت کاربری است که عضو کانال‌هاست.");
