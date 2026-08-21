import { getScopeBrands, getScopeProducts, isKnownScope, scopeLabel } from "./catalog.ts";
import { clipSourceText } from "./htmlText.ts";
import { matchExtractResult } from "./match.ts";
import { parseMillPriceItems } from "./millPriceTable.ts";
import { completeJson } from "./openai.ts";
import {
  EXTRACT_STEEL_SYSTEM,
  IMAGE_PROMPT_VERSION,
  PROMPT_VERSION,
  buildExtractImageUserMessage,
  buildExtractUserMessage,
} from "./prompts.ts";
import { parseModelExtract } from "./schema.ts";

/** Short messages (Telegram, notes) still use the model. Large mill pages must not block the queue. */
export const MODEL_FALLBACK_MAX_CHARS = 16_000;
export const LARGE_PAGE_SKIP_MODEL =
  "جدول این صفحه با خوانندهٔ قاعده‌مند شناخته نشد. استخراج مدل برای صفحهٔ بزرگ انجام نشد تا بقیهٔ منابع معطل نشوند.";

export function shouldUseModelFallback(text: string, tableItemCount: number): boolean {
  if (tableItemCount >= 2) return false;
  return text.length <= MODEL_FALLBACK_MAX_CHARS;
}

export type ExtractRequest = {
  text: string;
  groupCode: string;
  categoryCode: string;
};

export type ExtractImageRequest = {
  groupCode: string;
  categoryCode: string;
  fileName: string;
  mimeType: string;
  imageBase64: string;
};

function catalogContext(groupCode: string, categoryCode: string) {
  if (!isKnownScope(groupCode, categoryCode)) {
    throw new Error("دسته انتخاب‌شده در کاتالوگ نیست.");
  }
  const products = getScopeProducts(groupCode, categoryCode);
  if (!products.length) {
    throw new Error("برای این دسته کالایی در کاتالوگ نیست. کالا ساخته نمی‌شود.");
  }
  const brands = getScopeBrands(groupCode, categoryCode);
  const labels = scopeLabel(groupCode, categoryCode);
  return { products, brands, labels };
}

function compactCatalog(
  products: ReturnType<typeof getScopeProducts>,
  brands: ReturnType<typeof getScopeBrands>,
) {
  return {
    products: products.map((item) => ({
      product_code: item.sku,
      name: item.name,
      size: item.sizeLabel,
    })),
    brands: brands.map((item) => ({ brand_id: item.id, name: item.name })),
  };
}

export async function extractPrices(input: ExtractRequest) {
  const text = clipSourceText(input.text.trim());
  if (!text) {
    throw new Error("متن خام خالی است.");
  }
  const { products, brands, labels } = catalogContext(input.groupCode, input.categoryCode);
  const tableItems = parseMillPriceItems(text, brands);
  let extracted = parseModelExtract({
    is_price_message: tableItems.length > 0,
    message_kind: tableItems.length ? "price_list" : "unclear",
    items: tableItems,
    suspicious_reasons: [],
  });

  if (tableItems.length < 2 && shouldUseModelFallback(text, tableItems.length)) {
    const catalog = compactCatalog(products, brands);
    const modelJson = await completeJson(
      [
        { role: "system", content: EXTRACT_STEEL_SYSTEM },
        {
          role: "user",
          content: buildExtractUserMessage({
            ...labels,
            groupCode: input.groupCode,
            categoryCode: input.categoryCode,
            text,
            ...catalog,
          }),
        },
      ],
      45_000,
    );
    const ai = parseModelExtract(modelJson);
    extracted = {
      ...ai,
      items: [...tableItems, ...ai.items],
    };
  } else if (tableItems.length === 0) {
    console.log(`extract skip model page=${text.length} chars`);
    throw new Error(LARGE_PAGE_SKIP_MODEL);
  } else if (tableItems.length < 2) {
    console.log(`extract skip model keep=${tableItems.length} page=${text.length} chars`);
    extracted = parseModelExtract({
      is_price_message: true,
      message_kind: "price_list",
      items: tableItems,
      suspicious_reasons: [LARGE_PAGE_SKIP_MODEL],
    });
  }

  const observations = matchExtractResult(extracted, products, brands);
  return {
    promptVersion: PROMPT_VERSION,
    canPublish: false as const,
    extracted,
    observations,
  };
}

export async function extractPricesFromImage(input: ExtractImageRequest) {
  const { products, brands, labels } = catalogContext(input.groupCode, input.categoryCode);
  const catalog = compactCatalog(products, brands);
  const dataUrl = `data:${input.mimeType};base64,${input.imageBase64}`;
  const modelJson = await completeJson([
    { role: "system", content: EXTRACT_STEEL_SYSTEM },
    {
      role: "user",
      content: [
        {
          type: "text" as const,
          text: buildExtractImageUserMessage({
            ...labels,
            groupCode: input.groupCode,
            categoryCode: input.categoryCode,
            fileName: input.fileName,
            ...catalog,
          }),
        },
        { type: "image_url" as const, image_url: { url: dataUrl } },
      ],
    },
  ]);

  const extracted = parseModelExtract(modelJson);
  const observations = matchExtractResult(extracted, products, brands);
  return {
    promptVersion: IMAGE_PROMPT_VERSION,
    canPublish: false as const,
    extracted,
    observations,
  };
}

export function matchDrafts(input: { groupCode: string; categoryCode: string; items: unknown }) {
  const { products, brands } = catalogContext(input.groupCode, input.categoryCode);
  const extracted = parseModelExtract({
    is_price_message: true,
    message_kind: "price_list",
    items: Array.isArray(input.items) ? input.items : [],
    suspicious_reasons: [],
  });
  return {
    canPublish: false as const,
    observations: matchExtractResult(extracted, products, brands),
  };
}
