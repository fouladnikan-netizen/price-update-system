import { completeJson } from "./openai.ts";
import { SOURCE_IDENTITY_PROMPT_VERSION, SOURCE_IDENTITY_SYSTEM, buildSourceIdentityUserMessage } from "./prompts.ts";

export type SourceIdentityRequest = {
  name: string;
  groupLabel: string;
  categoryLabel: string;
  sourceType?: string;
};

export type SourceIdentitySuggestion = {
  promptVersion: string;
  officialName: string | null;
  officialUrl: string | null;
  note: string | null;
  confidence: number;
};

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text : null;
}

function normalizeUrl(value: string | null): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^(t\.me|telegram\.me)\//i.test(value)) return `https://${value}`;
  if (/^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(value)) return `https://${value}`;
  return null;
}

export function parseSourceIdentity(raw: unknown): Omit<SourceIdentitySuggestion, "promptVersion"> {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const confidence =
    typeof data.confidence === "number" && Number.isFinite(data.confidence) ? data.confidence : 0;
  return {
    officialName: asString(data.officialName),
    officialUrl: normalizeUrl(asString(data.officialUrl)),
    note: asString(data.note),
    confidence: Math.min(1, Math.max(0, confidence)),
  };
}

export async function suggestSourceIdentity(input: SourceIdentityRequest): Promise<SourceIdentitySuggestion> {
  const name = input.name.trim();
  if (!name) throw new Error("نام منبع خالی است.");
  const modelJson = await completeJson([
    { role: "system", content: SOURCE_IDENTITY_SYSTEM },
    {
      role: "user",
      content: buildSourceIdentityUserMessage({
        name,
        groupLabel: input.groupLabel.trim(),
        categoryLabel: input.categoryLabel.trim(),
        sourceType: input.sourceType?.trim() ?? "",
      }),
    },
  ]);
  return {
    promptVersion: SOURCE_IDENTITY_PROMPT_VERSION,
    ...parseSourceIdentity(modelJson),
  };
}
