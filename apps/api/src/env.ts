import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");

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
