import { tehranJalaliKey } from "../../web/src/intake/dates.ts";
import { roundRialToThousands } from "../../web/src/intake/rial.ts";
import { PRODUCT_GROUPS } from "../../web/src/mock/data.ts";
import {
  loadAppliedPrices,
  upsertAppliedPrices,
  type AppliedDailyPrice,
} from "./appliedPrices.ts";
import {
  findBrandInText,
  getScopeBrands,
  getScopeProducts,
  PRODUCTS,
  type CatalogProduct,
} from "./catalog.ts";
import { normalizeDigits, normalizeSize } from "./numbers.ts";

const POLICY_SOURCE = "سیاست بازو";

export const BOT_POLICY_HELP = [
  "سیاست را مستقیم برای بازو بنویسید. ساعت ۱۱ لیست قیمت، ساعت ۱۴ افزایش — هر پیام روی قیمت همان روز اعمال می‌شود.",
  "نمونه افزایش: تمام دسته میلگرد آجدار مثبت ۱۰۰۰ ریال",
  "نمونه حذف: ورق مبارکه ۱۵۰۰*۶۰۰۰ تمام شد",
  "حساب قطعی است. قیمت تمام‌شده خالی می‌شود، صفر نوشته نمی‌شود. محصول جدید ساخته نمی‌شود. انتشار به وب‌سایت خاموش است.",
].join("\n");

export type AdjustCategoryPolicy = {
  kind: "adjust_category";
  groupCode: string;
  categoryCode: string;
  groupLabel: string;
  categoryLabel: string;
  deltaRial: number;
};

export type ClearItemPolicy = {
  kind: "clear_item";
  groupCode: string | null;
  categoryCode: string | null;
  brandQuery: string | null;
  width: string | null;
  length: string | null;
  size: string | null;
};

export type PricePolicy = AdjustCategoryPolicy | ClearItemPolicy;

export type PolicyOutcome = {
  changed: number;
  reply: string;
  rows: AppliedDailyPrice[];
};

function normalizePolicyText(text: string): string {
  return normalizeDigits(text)
    .replace(/\u200c/g, " ")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[×✕xXｘ]/g, "*")
    .replace(/\s+/g, " ")
    .trim();
}

export function isHelpCommand(text: string): boolean {
  const n = normalizePolicyText(text).replace(/^\//, "");
  return /^(help|start|راهنما|سیاست|دستور)$/i.test(n);
}

function looksLikeClear(text: string): boolean {
  if (/تمام\s*دسته/.test(text)) return false;
  return /تمام\s*شد|ناموجود|موجود\s*نیست|قیمت\s*(را|رو)\s*(کامل\s*)?بردار|حذف\s*قیمت/.test(text);
}

function looksLikeAdjust(text: string): boolean {
  if (looksLikeClear(text)) return false;
  const hasScopeHint = /تمام\s*دسته|همه(?:‌| )?دسته|کل\s*دسته/.test(text);
  const hasDelta = /(?:مثبت|منفی|\+|−|–|افزایش|کاهش)\s*\d+/.test(text);
  return hasScopeHint || (hasDelta && /ریال|تومان/.test(text) && text.length <= 180);
}

export function findScopeInText(text: string): {
  groupCode: string;
  categoryCode: string;
  groupLabel: string;
  categoryLabel: string;
} | null {
  const n = normalizePolicyText(text);
  const hits: Array<{
    groupCode: string;
    categoryCode: string;
    groupLabel: string;
    categoryLabel: string;
    score: number;
  }> = [];
  for (const group of PRODUCT_GROUPS) {
    for (const category of group.categories) {
      if (!n.includes(category.nameFa)) continue;
      hits.push({
        groupCode: group.code,
        categoryCode: category.code,
        groupLabel: group.nameFa,
        categoryLabel: category.nameFa,
        score: category.nameFa.length + (n.includes(group.nameFa) ? 2 : 0),
      });
    }
  }
  if (!hits.length) return null;
  hits.sort((a, b) => b.score - a.score);
  const best = hits[0];
  if (hits.filter((item) => item.score === best.score).length !== 1) return null;
  return {
    groupCode: best.groupCode,
    categoryCode: best.categoryCode,
    groupLabel: best.groupLabel,
    categoryLabel: best.categoryLabel,
  };
}

export function parseDeltaRial(text: string): number | null {
  const n = normalizePolicyText(text);
  const toman = /تومان/.test(n) && !/ریال/.test(n);
  const positive = n.match(/(?:مثبت|\+|افزایش|پلاس)\s*([0-9]{1,12})/);
  const negative = n.match(/(?:منفی|−|–|کاهش)\s*([0-9]{1,12})/);
  const signed = n.match(/(?:^|[^\d])([+-])\s*([0-9]{1,12})/);
  let amount: number | null = null;
  let sign = 1;
  if (positive) {
    amount = Number(positive[1]);
    sign = 1;
  } else if (negative) {
    amount = Number(negative[1]);
    sign = -1;
  } else if (signed) {
    amount = Number(signed[2]);
    sign = signed[1] === "-" ? -1 : 1;
  }
  if (amount == null || !Number.isFinite(amount) || amount === 0) return null;
  const rial = toman ? amount * 10 : amount;
  return sign * rial;
}

function parseDimensions(text: string): { width: string; length: string } | null {
  const n = normalizePolicyText(text);
  const match = n.match(/(\d{3,5})\s*\*\s*(\d{3,5})/);
  if (!match) return null;
  return { width: match[1], length: match[2] };
}

function inferGroupCode(text: string): string | null {
  const n = normalizePolicyText(text);
  const hits = PRODUCT_GROUPS.filter((group) => n.includes(group.nameFa));
  return hits.length === 1 ? hits[0].code : null;
}

function parseBrandQuery(text: string, groupCode: string | null, categoryCode: string | null): string | null {
  if (groupCode && categoryCode) {
    const brand = findBrandInText(getScopeBrands(groupCode, categoryCode), text);
    if (brand) return brand.name;
  }
  const n = normalizePolicyText(text)
    .replace(/تمام\s*شد|ناموجود|موجود\s*نیست|قیمت\s*(را|رو)\s*(کامل\s*)?بردار|حذف\s*قیمت/g, " ")
    .replace(/\d+\s*\*\s*\d+/g, " ")
    .replace(/\d+(?:\.\d+)?\s*میل/g, " ")
    .replace(/ریال|تومان|دسته|تمام|همه|کامل/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const leftover = n
    .replace(/^(ورق|میلگرد|تیرآهن|نبشی|ناودانی|لوله|پروفیل)\s+/, "")
    .trim();
  return leftover.length >= 3 ? leftover.split(" ")[0] ?? null : null;
}

export function parsePricePolicy(text: string): PricePolicy | null {
  const n = normalizePolicyText(text);
  if (!n || n.length > 400) return null;
  if (looksLikeClear(n)) {
    const scope = findScopeInText(n);
    const dims = parseDimensions(n);
    const groupCode = scope?.groupCode ?? inferGroupCode(n);
    return {
      kind: "clear_item",
      groupCode,
      categoryCode: scope?.categoryCode ?? null,
      brandQuery: parseBrandQuery(n, groupCode, scope?.categoryCode ?? null),
      width: dims?.width ?? null,
      length: dims?.length ?? null,
      size: dims ? null : normalizeSize(n.match(/(?:سایز|قطر)\s*(\d{1,2}(?:\.\d+)?)/)?.[1] ?? null),
    };
  }
  if (!looksLikeAdjust(n)) return null;
  const scope = findScopeInText(n);
  const deltaRial = parseDeltaRial(n);
  if (!scope || deltaRial == null) return null;
  return {
    kind: "adjust_category",
    groupCode: scope.groupCode,
    categoryCode: scope.categoryCode,
    groupLabel: scope.groupLabel,
    categoryLabel: scope.categoryLabel,
    deltaRial,
  };
}

function productHasDimensions(product: CatalogProduct, width: string, length: string): boolean {
  const hay = normalizeDigits(`${product.name} ${product.sku}`).replace(/[×✕xX*]/g, "*");
  return new RegExp(`${width}\\s*\\*\\s*${length}`).test(hay) || hay.includes(`${width}-${length}`);
}

function matchingClearProducts(policy: ClearItemPolicy): CatalogProduct[] {
  return PRODUCTS.filter((product) => {
    if (policy.groupCode && product.groupCode !== policy.groupCode) return false;
    if (policy.categoryCode && product.categoryCode !== policy.categoryCode) return false;
    if (policy.width && policy.length && !productHasDimensions(product, policy.width, policy.length)) return false;
    if (policy.size && normalizeSize(product.sizeLabel) !== policy.size) return false;
    return Boolean((policy.width && policy.length) || policy.size);
  });
}

function brandTextMatches(brandName: string | null, query: string | null): boolean {
  if (!query) return true;
  if (!brandName) return false;
  const hay = normalizePolicyText(brandName);
  const needle = normalizePolicyText(query);
  return hay.includes(needle) || needle.includes(hay);
}

function shiftPrice(current: number | null, deltaRial: number): number | null {
  if (current == null) return null;
  const next = roundRialToThousands(current + deltaRial);
  if (!Number.isFinite(next) || next <= 0) return null;
  return next;
}

function applyAdjust(policy: AdjustCategoryPolicy, date: string, now: string): PolicyOutcome {
  const skus = new Set(getScopeProducts(policy.groupCode, policy.categoryCode).map((item) => item.sku));
  const targets = loadAppliedPrices().filter((row) => row.date === date && skus.has(row.productCode));
  if (!targets.length) {
    return {
      changed: 0,
      rows: [],
      reply: `برای ${policy.categoryLabel} امروز قیمتی نبود. اول لیست قیمت را بفرستید، بعد افزایش یا کاهش را.`,
    };
  }
  const signed = policy.deltaRial > 0 ? `مثبت ${policy.deltaRial.toLocaleString("fa-IR")}` : `منفی ${Math.abs(policy.deltaRial).toLocaleString("fa-IR")}`;
  const rows: AppliedDailyPrice[] = targets.map((row) => {
    const factoryPrice = shiftPrice(row.factoryPrice, policy.deltaRial);
    const warehousePrice = shiftPrice(row.warehousePrice, policy.deltaRial);
    return {
      ...row,
      factoryPrice,
      warehousePrice,
      factorySource: factoryPrice != null ? POLICY_SOURCE : null,
      warehouseSource: warehousePrice != null ? POLICY_SOURCE : null,
      updatedAt: now,
    };
  });
  upsertAppliedPrices(rows);
  return {
    changed: rows.length,
    rows,
    reply: `${rows.length.toLocaleString("fa-IR")} قیمت ${policy.categoryLabel} ${signed} ریال شد. انتشار به وب‌سایت خاموش است.`,
  };
}

function applyClear(policy: ClearItemPolicy, date: string, now: string): PolicyOutcome {
  if (!policy.width && !policy.length && !policy.size) {
    return {
      changed: 0,
      rows: [],
      reply: "اندازه کالا مشخص نبود. مثلاً: ورق مبارکه ۱۵۰۰*۶۰۰۰ تمام شد",
    };
  }
  const products = matchingClearProducts(policy);
  if (!products.length) {
    return {
      changed: 0,
      rows: [],
      reply: "این کالا در کاتالوگ با این اندازه پیدا نشد. محصول جدید ساخته نمی‌شود.",
    };
  }
  const skus = new Set(products.map((item) => item.sku));
  const targets = loadAppliedPrices().filter((row) => {
    if (row.date !== date || !skus.has(row.productCode)) return false;
    return brandTextMatches(row.brandName, policy.brandQuery);
  });
  if (!targets.length) {
    return {
      changed: 0,
      rows: [],
      reply: "برای این کالا امروز قیمتی نبود؛ چیزی صفر نشد. قیمت غایب خالی می‌ماند.",
    };
  }
  const rows: AppliedDailyPrice[] = targets.map((row) => ({
    ...row,
    factoryPrice: null,
    warehousePrice: null,
    factorySource: null,
    warehouseSource: null,
    updatedAt: now,
  }));
  upsertAppliedPrices(rows);
  return {
    changed: rows.length,
    rows,
    reply: `${rows.length.toLocaleString("fa-IR")} قیمت برداشته شد و خالی ماند. صفر نوشته نشد. انتشار به وب‌سایت خاموش است.`,
  };
}

export function applyPricePolicy(policy: PricePolicy, date = tehranJalaliKey()): PolicyOutcome {
  const now = new Date().toISOString();
  return policy.kind === "adjust_category" ? applyAdjust(policy, date, now) : applyClear(policy, date, now);
}
