export function tehranJalaliKey(): string {
  const parts = new Intl.DateTimeFormat("en-u-ca-persian", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const year = digits(parts.find((part) => part.type === "year")?.value);
  const month = digits(parts.find((part) => part.type === "month")?.value).padStart(2, "0");
  const day = digits(parts.find((part) => part.type === "day")?.value).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

export function tehranJalaliLabel(): string {
  return tehranJalaliKey().replace(/\d/g, (char) => "۰۱۲۳۴۵۶۷۸۹"[Number(char)] ?? char);
}

function digits(value: string | undefined): string {
  if (!value) return "";
  return [...value]
    .map((char) => {
      const persian = "۰۱۲۳۴۵۶۷۸۹".indexOf(char);
      if (persian >= 0) return String(persian);
      const arabic = "٠١٢٣٤٥٦٧٨٩".indexOf(char);
      if (arabic >= 0) return String(arabic);
      return /\d/.test(char) ? char : "";
    })
    .join("");
}

export function parseJalaliDate(text: string): string | null {
  const normalized = [...text]
    .map((char) => {
      const persian = "۰۱۲۳۴۵۶۷۸۹".indexOf(char);
      if (persian >= 0) return String(persian);
      const arabic = "٠١٢٣٤٥٦٧٨٩".indexOf(char);
      if (arabic >= 0) return String(arabic);
      return char;
    })
    .join("");
  const match = normalized.match(/(14\d{2})\s*[/.ـ\-]\s*(\d{1,2})\s*[/.ـ\-]\s*(\d{1,2})/);
  if (!match) return null;
  const year = match[1];
  const month = match[2].padStart(2, "0");
  const day = match[3].padStart(2, "0");
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${year}/${month}/${day}`;
}

export function jalaliOrdinal(key: string): number | null {
  const match = key.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 366 + Number(match[2]) * 31 + Number(match[3]);
}

export function isStaleDate(sourceDate: string | null, today = tehranJalaliKey()): boolean {
  if (!sourceDate) return false;
  const source = jalaliOrdinal(sourceDate);
  const current = jalaliOrdinal(today);
  if (source == null || current == null) return false;
  return current - source >= 2;
}

export function extractTextForRematch(rawText: string, result: unknown): string {
  if (result && typeof result === "object" && "rawText" in result) {
    const fromResult = (result as { rawText?: unknown }).rawText;
    if (typeof fromResult === "string" && fromResult.trim()) return fromResult.trim();
  }
  return rawText.replace(/^منبع:.*\n+/, "").trim();
}
