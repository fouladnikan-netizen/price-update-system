export const PROMPT_VERSION = "extract.steel.v3";
export const IMAGE_PROMPT_VERSION = "extract.steel.image.v1";
export const SOURCE_IDENTITY_PROMPT_VERSION = "source.identity.v1";

export const SOURCE_IDENTITY_SYSTEM = `You suggest a public official identity for a steel-product price source (a mill, trader, competitor website, or public channel).

Return ONLY valid JSON:
{
  "officialName": string | null,
  "officialUrl": string | null,
  "note": string | null,
  "confidence": number
}

Hard rules:
- This is a suggestion for a human to confirm. Do not claim the identity is verified.
- Never invent product codes, SKUs, products, or brands.
- Never invent a company or website if you are not reasonably sure it is a real public entity.
- officialUrl must be a public homepage or public channel URL only.
- Do not suggest login pages, CAPTCHA gates, paywalls, private dashboards, or any bypass of access controls.
- If unsure, set officialName and officialUrl to null. Explain briefly in Persian in note.
- note should be short Persian text for the reviewer.
- confidence is 0 to 1.`;

export function buildSourceIdentityUserMessage(input: {
  name: string;
  groupLabel: string;
  categoryLabel: string;
  sourceType: string;
}): string {
  return `Source display name: ${input.name}
Source type: ${input.sourceType || "unknown"}
Product group: ${input.groupLabel || "unspecified"}
Product category: ${input.categoryLabel || "unspecified"}

Suggest the public official name and public URL for this price source, if you can. Do not invent products, brands, or SKUs.`;
}

export const EXTRACT_STEEL_SYSTEM = `You extract steel-product prices from Persian or English source text for the given catalog category (rebar, beam, sheet, angle, channel, profile, or pipe).

Return ONLY valid JSON matching this schema:
{
  "is_price_message": boolean,
  "message_kind": "price_list" | "other" | "unclear",
  "items": [
    {
      "raw_text": string,
      "suggested_product_code": string | null,
      "suggested_brand_id": string | null,
      "suggested_brand_name": string | null,
      "grade": string | null,
      "size": string | null,
      "factory_price": number | null,
      "warehouse_price": number | null,
      "unit": "toman_per_kg" | "rial_per_kg" | "toman_per_bar" | "unknown" | null,
      "confidence": number,
      "notes": string | null
    }
  ],
  "suspicious_reasons": string[]
}

Hard rules:
- Use only product_code values from the allowed catalog for this category. Never invent a SKU or product.
- Use only brand_id / brand names from the allowed brand list. Never invent a brand.
- Website wording varies. «ذوب آهن»، «اصفهان»، or «میلگرد ذوب آهن اصفهان» all map to the catalog mill if that mill is on the allowed list. Do not create a new mill because a word is missing or extra.
- Match our catalog rows only. Extra products on the source stay in items with suggested_product_code null so they can be archived. Never ask to add them to our catalog.
- If the product is uncertain, set suggested_product_code to null. Do not guess a new product.
- If the mill is uncertain, set suggested_brand_id to null. Prefer suggested_brand_name from the allowed list when the wording is a known variant.
- factory_price and warehouse_price are separate. Do not copy one onto the other.
- Missing price must be null, never 0.
- Zero, blank, dash, «ناموجود», or «تماس بگیرید» means null.
- Do not convert units and do not invent bar weights.
- If the unit is unclear, set unit to "unknown".
- Pipe factory quotes are per kilogram (toman_per_kg).
- Pipe warehouse quotes may be per kilogram (toman_per_kg) or per bar (toman_per_bar). Record the source unit; do not convert to kg.
- Website display for pipe is kilogram; conversion is done later by deterministic code, not by you.
- Do not calculate averages or percentages.
- Do not mark anything as published.
- If the source is an image, read visible printed and handwritten prices, tables, and labels. Transcribe uncertain cells into raw_text. Do not invent rows that are not visible.
- size may be diameter, thickness, section, or inch depending on the category.
- grade is for rebar (A2/A3/A4) when present; otherwise null.
- confidence is 0 to 1.
- suspicious_reasons is an array of short Persian phrases when the message looks incomplete, mixed, or inconsistent.`;

export function buildExtractUserMessage(input: {
  groupLabel: string;
  categoryLabel: string;
  groupCode: string;
  categoryCode: string;
  text: string;
  products: Array<{ product_code: string; name: string; size: string }>;
  brands: Array<{ brand_id: string; name: string }>;
}): string {
  const products = input.products
    .map((item) => `- ${item.product_code} | ${item.name} | size=${item.size}`)
    .join("\n");
  const brands = input.brands.length
    ? input.brands.map((item) => `- ${item.brand_id} | ${item.name}`).join("\n")
    : "(this category has no brand list; leave brand fields null)";
  return `Category: ${input.groupCode} / ${input.categoryCode} (${input.groupLabel} · ${input.categoryLabel}).

Allowed products (product_code is the only identity):
${products}

Allowed brands (do not invent):
${brands}

Source text:
"""
${input.text}
"""`;
}

export function buildExtractImageUserMessage(input: {
  groupLabel: string;
  categoryLabel: string;
  groupCode: string;
  categoryCode: string;
  fileName: string;
  products: Array<{ product_code: string; name: string; size: string }>;
  brands: Array<{ brand_id: string; name: string }>;
}): string {
  const products = input.products
    .map((item) => `- ${item.product_code} | ${item.name} | size=${item.size}`)
    .join("\n");
  const brands = input.brands.length
    ? input.brands.map((item) => `- ${item.brand_id} | ${item.name}`).join("\n")
    : "(this category has no brand list; leave brand fields null)";
  return `Category: ${input.groupCode} / ${input.categoryCode} (${input.groupLabel} · ${input.categoryLabel}).
Source kind: image (${input.fileName}).
Read the attached image as the raw source. Do not invent products or brands.

Allowed products (product_code is the only identity):
${products}

Allowed brands (do not invent):
${brands}`;
}
