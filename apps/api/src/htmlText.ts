const BLOCK_TAGS = /<(script|style|noscript|iframe|svg)[\s\S]*?<\/\1>/gi;
const IN_TAX = /<[^>]*\bin-tax\b[^>]*>[\s\S]*?<\/(?:span|div|p|td)>/gi;

export function htmlToText(html: string): string {
  const withoutTax = html.replace(IN_TAX, " ");
  const withoutBlocks = withoutTax.replace(BLOCK_TAGS, " ");
  const withBreaks = withoutBlocks.replace(/<(br|p|div|li|tr|h[1-6]|blockquote)[^>]*>/gi, "\n");
  const withoutTags = withBreaks.replace(/<[^>]+>/g, " ");
  return decodeEntities(withoutTags)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)));
}

export function looksLikeAccessControl(html: string, status: number): string | null {
  if (status === 401 || status === 403) {
    return "صفحه عمومی نیست یا ورود می‌خواهد. از کنترل دسترسی عبور نمی‌شود.";
  }
  const sample = html.slice(0, 8000).toLowerCase();
  if (
    sample.includes("captcha") ||
    sample.includes("recaptcha") ||
    sample.includes("hcaptcha") ||
    sample.includes("cf-challenge") ||
    sample.includes("just a moment")
  ) {
    return "صفحه CAPTCHA یا چالش دسترسی دارد. عبور از آن انجام نمی‌شود.";
  }
  return null;
}

export const MAX_SOURCE_CHARS = 160_000;

export function clipSourceText(text: string, maxChars = MAX_SOURCE_CHARS): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  const markers = [
    "قیمت (تومان)",
    "سایز مشخصات محصول",
    "محل تحویل",
    "آخرین بروزرسانی",
    "میلگرد ذوب",
    "قیمت میلگرد",
    "نام محصول:",
    "عنوان سایز",
    "قیمت ریال",
    "قيمت بدون ارزش افزوده",
  ];
  let start = 0;
  let earliest = Number.POSITIVE_INFINITY;
  for (const marker of markers) {
    const index = trimmed.indexOf(marker);
    if (index >= 0 && index < earliest) earliest = index;
  }
  if (Number.isFinite(earliest)) start = Math.max(0, earliest - 400);
  return trimmed.slice(start, start + maxChars);
}
