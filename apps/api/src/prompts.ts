export const PROMPT_VERSION = "extract.steel.v1";

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
      "unit": "toman_per_kg" | "rial_per_kg" | "unknown" | null,
      "confidence": number,
      "notes": string | null
    }
  ],
  "suspicious_reasons": string[]
}

Hard rules:
- Use only product_code values from the allowed catalog for this category. Never invent a SKU or product.
- Use only brand_id / brand names from the allowed brand list. Never invent a brand.
- If the product is uncertain, set suggested_product_code to null. Do not guess.
- If the brand is uncertain, set suggested_brand_id to null. Do not guess.
- factory_price and warehouse_price are separate. Do not copy one onto the other.
- Missing price must be null, never 0.
- Zero, blank, dash, «ناموجود», or «تماس بگیرید» means null.
- Do not convert units. If the unit is unclear, set unit to "unknown".
- Do not calculate averages or percentages.
- Do not mark anything as published.
- Prefer one item per product × brand pair.
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
