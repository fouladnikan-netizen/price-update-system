import { getScopeBrands, getScopeProducts, isKnownScope, scopeLabel } from "./catalog.ts";
import { matchExtractResult } from "./match.ts";
import { completeJson } from "./openai.ts";
import { PROMPT_VERSION, EXTRACT_STEEL_SYSTEM, buildExtractUserMessage } from "./prompts.ts";
import { parseModelExtract } from "./schema.ts";

export type ExtractRequest = {
  text: string;
  groupCode: string;
  categoryCode: string;
};

export async function extractPrices(input: ExtractRequest) {
  const text = input.text.trim();
  if (!text) {
    throw new Error("متن خام خالی است.");
  }
  if (!isKnownScope(input.groupCode, input.categoryCode)) {
    throw new Error("دسته انتخاب‌شده در کاتالوگ نیست.");
  }

  const products = getScopeProducts(input.groupCode, input.categoryCode);
  if (!products.length) {
    throw new Error("برای این دسته کالایی در کاتالوگ نیست. کالا ساخته نمی‌شود.");
  }
  const brands = getScopeBrands(input.groupCode, input.categoryCode);
  const labels = scopeLabel(input.groupCode, input.categoryCode);
  const modelJson = await completeJson([
    { role: "system", content: EXTRACT_STEEL_SYSTEM },
    {
      role: "user",
      content: buildExtractUserMessage({
        ...labels,
        groupCode: input.groupCode,
        categoryCode: input.categoryCode,
        text,
        products: products.map((item) => ({
          product_code: item.sku,
          name: item.name,
          size: item.sizeLabel,
        })),
        brands: brands.map((item) => ({ brand_id: item.id, name: item.name })),
      }),
    },
  ]);

  const extracted = parseModelExtract(modelJson);
  const observations = matchExtractResult(extracted, products, brands);
  return {
    promptVersion: PROMPT_VERSION,
    canPublish: false,
    extracted,
    observations,
  };
}
