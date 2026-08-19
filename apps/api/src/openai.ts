import { getAiConfig } from "./env.ts";

export class AiGatewayError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AiGatewayError";
  }
}

export async function completeJson(messages: Array<{ role: "system" | "user"; content: string }>): Promise<unknown> {
  const config = getAiConfig();
  if (!config.configured) {
    throw new AiGatewayError("کلید یا آدرس سرویس هوش مصنوعی تنظیم نشده است.");
  }

  const requestBody = {
    model: config.model,
    temperature: 0,
    messages,
  };

  let response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...requestBody, response_format: { type: "json_object" } }),
  });

  if (response.status === 400) {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
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
