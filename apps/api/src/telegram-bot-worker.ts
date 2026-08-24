import { runTelegramBotWorker } from "./telegramInbox.ts";

const controller = new AbortController();
const stop = () => controller.abort();
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

await runTelegramBotWorker({ signal: controller.signal });
