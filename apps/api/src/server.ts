import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { collectPublicText, CollectError, isCollectableType } from "./collect.ts";
import { pingBaleBot } from "./bale.ts";
import { startBaleInboxPoller } from "./botInbox.ts";
import { persistDailyPrices, readDailyPrices, importFilePricesIfDatabaseEmpty } from "./dailyPersist.ts";
import { pingDatabase } from "./db.ts";
import { getAiConfig, getBaleConfig, getBaleUserConfig, getServerConfig, getTelegramConfig, getWebsiteConfig } from "./env.ts";
import { extractPrices, extractPricesFromImage, matchDrafts } from "./extract.ts";
import { applyMigrations } from "./migrate.ts";
import { AiGatewayError } from "./openai.ts";
import {
  loadIntakesFromDb,
  loadSourcesFromDb,
  saveIntakesToDb,
  saveSourcesToDb,
} from "./opsStore.ts";
import { IMAGE_PROMPT_VERSION, PROMPT_VERSION, SOURCE_IDENTITY_PROMPT_VERSION } from "./prompts.ts";
import { PublishError, publishToWebsite, type PublishRequest } from "./publish.ts";
import { MAX_IMAGE_BYTES, listRawTexts, publicRawUrl, readRawImage, readRawText, saveRawImage, saveRawText } from "./rawFiles.ts";
import { loadPersistedSchedule, savePersistedSchedule, startSchedulePoller } from "./scheduler.ts";
import { runScheduledSourceUpdate } from "./scheduledUpdate.ts";
import { suggestSourceIdentity } from "./sourceIdentity.ts";
import { staticDirExists, tryServeStatic } from "./static.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...CORS });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const length = Number(req.headers["content-length"] ?? "0");
  if (Number.isFinite(length) && length > maxBytes) {
    throw new Error("حجم درخواست بیش از حد مجاز است.");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > maxBytes) throw new Error("حجم درخواست بیش از حد مجاز است.");
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

function stripBase64(value: string): string {
  const match = value.trim().match(/^data:[^;]+;base64,(.+)$/s);
  return (match ? match[1] : value).replace(/\s/g, "");
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      const config = getAiConfig();
      const db = await pingDatabase();
      const website = getWebsiteConfig();
      const bale = getBaleConfig();
      const balePing = bale.configured ? await pingBaleBot() : { ok: false };
      json(res, 200, {
        ok: true,
        configured: config.configured,
        model: config.model,
        promptVersion: PROMPT_VERSION,
        imagePromptVersion: IMAGE_PROMPT_VERSION,
        autoPublish: false,
        websiteConfigured: website.configured,
        telegramConfigured: getTelegramConfig().configured,
        baleConfigured: bale.configured,
        baleConnected: balePing.ok,
        baleBotUsername: balePing.ok ? balePing.username : undefined,
        baleUserConfigured: getBaleUserConfig().configured,
        database: db,
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/applied-prices") {
      json(res, 200, { prices: await readDailyPrices(), autoPublish: false });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/daily-prices") {
      json(res, 200, { prices: await readDailyPrices(), autoPublish: false });
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/daily-prices") {
      const payload = JSON.parse((await readBody(req, 8 * 1024 * 1024)).toString("utf8") || "{}") as {
        prices?: unknown;
      };
      if (!Array.isArray(payload.prices)) throw new Error("فهرست قیمت روز نامعتبر است.");
      const prices = await persistDailyPrices(payload.prices as Parameters<typeof persistDailyPrices>[0]);
      json(res, 200, { prices, autoPublish: false });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/sources") {
      const fromDb = await loadSourcesFromDb();
      json(res, 200, fromDb ?? { store: "unavailable", sources: [] });
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/sources") {
      const payload = JSON.parse((await readBody(req, 2 * 1024 * 1024)).toString("utf8") || "{}") as {
        sources?: unknown;
      };
      if (!Array.isArray(payload.sources)) throw new Error("فهرست منابع نامعتبر است.");
      const ok = await saveSourcesToDb(payload.sources as Parameters<typeof saveSourcesToDb>[0]);
      if (!ok) {
        json(res, 503, { error: "دیتابیس در دسترس نیست.", store: "unavailable" });
        return;
      }
      json(res, 200, { ok: true, store: "postgres", autoPublish: false });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/intakes") {
      const fromDb = await loadIntakesFromDb();
      json(res, 200, fromDb ?? { store: "unavailable", intakes: [] });
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/intakes") {
      const payload = JSON.parse((await readBody(req, 8 * 1024 * 1024)).toString("utf8") || "{}") as {
        intakes?: unknown;
      };
      if (!Array.isArray(payload.intakes)) throw new Error("فهرست ورودی خام نامعتبر است.");
      const ok = await saveIntakesToDb(payload.intakes as Parameters<typeof saveIntakesToDb>[0]);
      if (!ok) {
        json(res, 503, { error: "دیتابیس در دسترس نیست.", store: "unavailable" });
        return;
      }
      json(res, 200, { ok: true, store: "postgres", canPublish: false });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/prompts") {
      json(res, 200, {
        active: PROMPT_VERSION,
        prompts: [
          {
            id: PROMPT_VERSION,
            purpose: "طبقه‌بندی و استخراج قیمت از متن برای همه دسته‌های کاتالوگ",
            canPublish: false,
          },
          {
            id: IMAGE_PROMPT_VERSION,
            purpose: "استخراج قیمت از تصویر لیست برای همه دسته‌های کاتالوگ",
            canPublish: false,
          },
          {
            id: SOURCE_IDENTITY_PROMPT_VERSION,
            purpose: "پیشنهاد هویت رسمی عمومی منبع قیمت؛ تأیید انسانی لازم است و ورود قیمت را مسدود نمی‌کند",
            canPublish: false,
          },
        ],
      });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/raw/")) {
      const id = url.pathname.slice("/api/raw/".length);
      const image = readRawImage(id);
      if (image) {
        res.writeHead(200, {
          "Content-Type": image.meta.mimeType,
          "Content-Length": image.bytes.length,
          "Cache-Control": "private, max-age=86400",
          ...CORS,
        });
        res.end(image.bytes);
        return;
      }
      const text = readRawText(id);
      if (text) {
        res.writeHead(200, {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Length": text.bytes.length,
          "Cache-Control": "private, max-age=86400",
          ...CORS,
        });
        res.end(text.bytes);
        return;
      }
      json(res, 404, { error: "not_found" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/raw-recent") {
      json(res, 200, {
        items: listRawTexts(10).map((item) => ({
          id: item.id,
          sourceUrl: item.sourceUrl,
          fileName: item.fileName,
          createdAt: item.createdAt,
          byteSize: item.byteSize,
          url: publicRawUrl(item.id),
        })),
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/extract") {
      const payload = JSON.parse((await readBody(req, 8 * 1024 * 1024)).toString("utf8") || "{}") as {
        text?: string;
        groupCode?: string;
        categoryCode?: string;
      };
      console.log(`extract start ${payload.groupCode}/${payload.categoryCode} ${(payload.text ?? "").length} chars`);
      const result = await extractPrices({
        text: payload.text ?? "",
        groupCode: payload.groupCode ?? "",
        categoryCode: payload.categoryCode ?? "",
      });
      console.log(`extract done observations=${result.observations.length}`);
      json(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/match") {
      const payload = JSON.parse((await readBody(req, 2 * 1024 * 1024)).toString("utf8") || "{}") as {
        groupCode?: string;
        categoryCode?: string;
        items?: unknown;
      };
      const result = matchDrafts({
        groupCode: payload.groupCode ?? "",
        categoryCode: payload.categoryCode ?? "",
        items: payload.items,
      });
      json(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/source-identity") {
      const payload = JSON.parse((await readBody(req, 32 * 1024)).toString("utf8") || "{}") as {
        name?: string;
        groupLabel?: string;
        categoryLabel?: string;
        sourceType?: string;
      };
      const result = await suggestSourceIdentity({
        name: payload.name ?? "",
        groupLabel: payload.groupLabel ?? "",
        categoryLabel: payload.categoryLabel ?? "",
        sourceType: payload.sourceType ?? "",
      });
      json(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/extract-image") {
      const payload = JSON.parse((await readBody(req, MAX_IMAGE_BYTES * 2)).toString("utf8") || "{}") as {
        groupCode?: string;
        categoryCode?: string;
        fileName?: string;
        mimeType?: string;
        imageBase64?: string;
      };
      const mimeType = payload.mimeType ?? "";
      const imageBase64 = stripBase64(payload.imageBase64 ?? "");
      if (!imageBase64) throw new Error("تصویر خام خالی است.");
      const bytes = Buffer.from(imageBase64, "base64");
      const meta = saveRawImage({
        fileName: payload.fileName ?? "image",
        mimeType,
        bytes,
      });
      const rawFile = {
        id: meta.id,
        fileName: meta.fileName,
        mimeType: meta.mimeType,
        url: publicRawUrl(meta.id),
      };
      try {
        const result = await extractPricesFromImage({
          groupCode: payload.groupCode ?? "",
          categoryCode: payload.categoryCode ?? "",
          fileName: meta.fileName,
          mimeType: meta.mimeType,
          imageBase64,
        });
        json(res, 200, { ...result, rawFile });
      } catch (error) {
        const message = error instanceof Error ? error.message : "استخراج تصویر انجام نشد.";
        json(res, error instanceof AiGatewayError ? 502 : 400, {
          error: message,
          canPublish: false,
          rawFile,
        });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/collect") {
      const payload = JSON.parse((await readBody(req, 32 * 1024)).toString("utf8") || "{}") as {
        sourceType?: string;
        address?: string;
        groupCode?: string;
        categoryCode?: string;
      };
      const sourceType = payload.sourceType ?? "";
      if (!isCollectableType(sourceType)) {
        throw new CollectError("فقط سایت، تلگرام و بله عمومی قابل دریافت زنده‌اند.");
      }
      const collected = await collectPublicText(sourceType, payload.address ?? "");
      const meta = saveRawText({
        fileName: `${sourceType}.txt`,
        sourceUrl: collected.fetchedUrl,
        text: collected.text,
      });
      console.log(`collect ${sourceType} ${collected.fetchedUrl} ${collected.text.length} chars`);
      json(res, 200, {
        rawText: collected.text,
        fetchedUrl: collected.fetchedUrl,
        needsExtract: true,
        canPublish: false,
        rawFile: {
          id: meta.id,
          fileName: meta.fileName,
          sourceUrl: meta.sourceUrl,
          url: publicRawUrl(meta.id),
        },
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/publish") {
      const payload = JSON.parse((await readBody(req, 64 * 1024)).toString("utf8") || "{}") as PublishRequest;
      const result = await publishToWebsite(payload);
      json(res, 200, { ...result, canPublish: false, autoPublish: false });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/schedule") {
      json(res, 200, { schedule: await loadPersistedSchedule(), store: "postgres", autoPublish: false });
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/schedule") {
      const payload = JSON.parse((await readBody(req, 32 * 1024)).toString("utf8") || "{}") as {
        schedule?: unknown;
      };
      const ok = await savePersistedSchedule(payload.schedule as Parameters<typeof savePersistedSchedule>[0]);
      if (!ok) {
        json(res, 503, { error: "دیتابیس در دسترس نیست.", store: "unavailable" });
        return;
      }
      json(res, 200, { schedule: await loadPersistedSchedule(), store: "postgres", autoPublish: false });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/scheduled-update") {
      const result = await runScheduledSourceUpdate();
      json(res, 200, result);
      return;
    }

    const files = getServerConfig();
    if (staticDirExists(files.staticDir) && tryServeStatic(files.staticDir, req, res, CORS)) return;

    json(res, 404, { error: "not_found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطای ناشناخته";
    const status =
      error instanceof CollectError || error instanceof PublishError
        ? 400
        : error instanceof AiGatewayError && error.status === 401
          ? 502
          : 400;
    json(res, status, { error: message, canPublish: false });
  }
});

const config = getAiConfig();
const website = getWebsiteConfig();
const listen = getServerConfig();
server.listen(listen.port, listen.host, () => {
  console.log(`price-update api on http://${listen.host}:${listen.port}`);
  console.log(`AI configured: ${config.configured ? "yes" : "no"} model=${config.model}`);
  console.log(`Website publish: ${website.configured ? "configured" : "queued locally"}`);
  if (staticDirExists(listen.staticDir)) {
    console.log(`static ui: ${listen.staticDir}`);
  }
  void applyMigrations()
    .then((migrated) => {
      if (migrated.ok) console.log(`migrations: ${migrated.applied.join(", ") || "up to date"}`);
      else console.error(`migrations failed: ${migrated.error}`);
      return importFilePricesIfDatabaseEmpty();
    })
    .then(() => pingDatabase())
    .then((db) => {
      console.log(`Database: ${db.ok ? db.database : db.error ?? "unavailable"}`);
    })
    .catch(() => undefined);
  startSchedulePoller();
  console.log("schedule poller: Tehran clock on the server; website auto-publish stays off");
  if (getBaleConfig().configured) {
    startBaleInboxPoller();
    console.log("Bale inbox: messages to the org bot are applied automatically; website publish stays off");
  }
});
