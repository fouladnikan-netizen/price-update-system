import { getAiConfig } from "./env.ts";

export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: "system" | "user";
  content: string | ChatContentPart[];
};

export class AiGatewayError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AiGatewayError";
  }
}

const AI_TIMEOUT_MS = 180_000;

export async function completeJson(messages: ChatMessage[], timeoutMs = AI_TIMEOUT_MS): Promise<unknown> {
  const config = getAiConfig();
  if (!config.configured) {
    throw new AiGatewayError("کلید یا آدرس سرویس هوش مصنوعی تنظیم نشده است.");
  }

  const requestBody = {
    model: config.model,
    temperature: 0,
    messages,
  };

  async function post(body: unknown): Promise<Response> {
    try {
      return await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        throw new AiGatewayError("پاسخ هوش مصنوعی بیش از حد طول کشید.");
      }
      throw error;
    }
  }

  let response = await post({ ...requestBody, response_format: { type: "json_object" } });

  if (response.status === 400) {
    response = await post(requestBody);
  }

  const text = await response.text();
  if (!response.ok) {
    throw new AiGatewayError(`سرویس هوش مصنوعی پاسخ ${response.status} داد.`, response.status);
  }

  let parsed: { choices?: Array<{ message?: { content?: string } }> };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new AiGatewayError("پاسخ سرویس هوش مصنوعی JSON نبود.");
  }

  const content = parsed.choices?.[0]?.message?.content;
  if (!content) throw new AiGatewayError("پاسخ مدل خالی بود.");
  const jsonText = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(jsonText) as unknown;
  } catch {
    throw new AiGatewayError("خروجی مدل JSON معتبر نبود.");
  }
}
