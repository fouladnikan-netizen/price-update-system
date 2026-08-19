import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { getAiConfig } from "./env.ts";
import { extractPrices } from "./extract.ts";
import { AiGatewayError } from "./openai.ts";
import { PROMPT_VERSION } from "./prompts.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...CORS });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
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
      json(res, 200, {
        ok: true,
        configured: config.configured,
        model: config.model,
        promptVersion: PROMPT_VERSION,
        autoPublish: false,
      });
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
        ],
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/extract") {
      const payload = JSON.parse((await readBody(req)) || "{}") as {
        text?: string;
        groupCode?: string;
        categoryCode?: string;
      };
      const result = await extractPrices({
        text: payload.text ?? "",
        groupCode: payload.groupCode ?? "",
        categoryCode: payload.categoryCode ?? "",
      });
      json(res, 200, result);
      return;
    }

    json(res, 404, { error: "not_found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطای ناشناخته";
    const status = error instanceof AiGatewayError && error.status === 401 ? 502 : 400;
    json(res, status, { error: message, canPublish: false });
  }
});

const config = getAiConfig();
server.listen(config.port, "127.0.0.1", () => {
  console.log(`price-update api on http://127.0.0.1:${config.port}`);
  console.log(`AI configured: ${config.configured ? "yes" : "no"} model=${config.model}`);
});
