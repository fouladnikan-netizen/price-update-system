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
  return match?.[0] ?? (text || null);
}
