const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function normalizeDigits(value: string): string {
  return [...value]
    .map((char) => {
      const persian = PERSIAN_DIGITS.indexOf(char);
      if (persian >= 0) return String(persian);
      const arabic = ARABIC_DIGITS.indexOf(char);
      if (arabic >= 0) return String(arabic);
      return char;
    })
    .join("");
}

export function parsePriceNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value === 0) return null;
    return value;
  }
  const text = normalizeDigits(String(value))
    .replace(/[٬,]/g, "")
    .replace(/[٫]/g, ".")
    .trim();
  if (!text || text === "-" || text === "—") return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n === 0) return null;
  return n;
}

export function normalizeSize(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = normalizeDigits(value).replace(/[^\d.]/g, "");
  return text || null;
}

export function normalizeGrade(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = normalizeDigits(value).trim().toUpperCase().replace(/\s+/g, "");
  const match = text.match(/A[234]/);
  return match?.[0] ?? null;
}

export function parseGradeFromText(value: string | null | undefined): string | null {
  if (!value) return null;
  const matches = [...normalizeDigits(value).toUpperCase().matchAll(/A[234]/g)].map((item) => item[0]);
  return new Set(matches).size === 1 ? matches[0] : null;
}

export function parseSizeFromText(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = normalizeDigits(value);
  const found = new Set<string>();
  const patterns = [
    /(?:سایز|قطر)\s*(\d{1,2}(?:\.\d+)?)/g,
    /(\d{1,2}(?:\.\d+)?)\s*میل(?!گرد)/g,
    /میلگرد\s*(?:آجدار|ساده)?\s*(?:A[234])?\s*(\d{1,2}(?:\.\d+)?)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (match[1]) found.add(match[1]);
    }
  }
  if (found.size === 1) return [...found][0];
  if (text.trim().length > 180) return found.size === 1 ? [...found][0] : null;
  const compact = [...text.matchAll(/\b(\d{1,2})\b/g)].map((item) => item[1]);
  const typical = compact.filter((item) => /^(8|10|12|14|16|18|20|22|25|28|32|36|40)$/.test(item));
  return new Set(typical).size === 1 ? typical[0] : null;
}
