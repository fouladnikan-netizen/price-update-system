import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");

export function ensureEnv(): void {
  loadEnvFile();
}

function loadEnvFile(): void {
  const file = resolve(REPO_ROOT, ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export type AiConfig = {
  baseUrl: string;
  model: string;
  apiKey: string;
  port: number;
  configured: boolean;
};

export type DbConfig = {
  url: string;
  configured: boolean;
};

export type WebsiteConfig = {
  baseUrl: string;
  apiKey: string;
  publishPath: string;
  configured: boolean;
};

export type ServerConfig = {
  host: string;
  port: number;
  staticDir: string | null;
};

export function getServerConfig(): ServerConfig {
  loadEnvFile();
  const host = process.env.AI_API_HOST ?? process.env.PRICE_UPDATE_HOST ?? "127.0.0.1";
  const port = Number(process.env.AI_API_PORT ?? "8787");
  const staticDir = (process.env.PRICE_UPDATE_STATIC_DIR ?? "").trim() || null;
  return {
    host: host.trim() || "127.0.0.1",
    port: Number.isFinite(port) ? port : 8787,
    staticDir,
  };
}

export function getAiConfig(): AiConfig {
  loadEnvFile();
  const baseUrl = (process.env.AI_BASE_URL ?? "").replace(/\/$/, "");
  const model = process.env.AI_MODEL ?? "openai/gpt-5-mini";
  const apiKey = process.env.AI_API_KEY ?? "";
  const port = Number(process.env.AI_API_PORT ?? "8787");
  return {
    baseUrl,
    model,
    apiKey,
    port: Number.isFinite(port) ? port : 8787,
    configured: Boolean(baseUrl && apiKey),
  };
}

export function getDbConfig(): DbConfig {
  loadEnvFile();
  const url = process.env.DATABASE_URL ?? "";
  return { url, configured: Boolean(url) };
}

export type TelegramConfig = {
  apiId: number;
  apiHash: string;
  session: string;
  configured: boolean;
};

export function getTelegramConfig(): TelegramConfig {
  loadEnvFile();
  const apiId = Number(process.env.TELEGRAM_API_ID ?? "");
  const apiHash = process.env.TELEGRAM_API_HASH ?? "";
  const session = process.env.TELEGRAM_SESSION ?? "";
  return {
    apiId: Number.isFinite(apiId) ? apiId : 0,
    apiHash,
    session,
    configured: Boolean(apiId && apiHash && session),
  };
}

export type BaleConfig = {
  token: string;
  apiBase: string;
  configured: boolean;
};

export function getBaleConfig(): BaleConfig {
  loadEnvFile();
  const token = (process.env.BALE_BOT_TOKEN ?? "").trim();
  const apiBase = (process.env.BALE_API_BASE_URL ?? "https://tapi.bale.ai").replace(/\/$/, "");
  return {
    token,
    apiBase,
    configured: Boolean(token),
  };
}

export type TelegramBotConfig = {
  token: string;
  apiBase: string;
  configured: boolean;
};

export function getTelegramBotConfig(): TelegramBotConfig {
  loadEnvFile();
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const apiBase = (process.env.TELEGRAM_BOT_API_BASE_URL ?? "https://api.telegram.org").replace(/\/$/, "");
  return {
    token,
    apiBase,
    configured: Boolean(token),
  };
}

export type BaleUserConfig = {
  session: string;
  configured: boolean;
};

export function getBaleUserConfig(): BaleUserConfig {
  loadEnvFile();
  const session = (process.env.BALE_SESSION ?? "").trim();
  return {
    session,
    configured: /^\d+:.+$/.test(session),
  };
}

export function getWebsiteConfig(): WebsiteConfig {
  loadEnvFile();
  const baseUrl = (process.env.WEBSITE_API_BASE_URL ?? "").replace(/\/$/, "");
  const apiKey = process.env.WEBSITE_API_KEY ?? "";
  const publishPath = process.env.WEBSITE_PUBLISH_PATH ?? "/api/internal/price-update";
  return {
    baseUrl,
    apiKey,
    publishPath,
    configured: Boolean(baseUrl && apiKey),
  };
}
