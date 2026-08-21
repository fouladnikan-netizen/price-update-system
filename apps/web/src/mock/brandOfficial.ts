import brandTables from "./brand-official-tables.json";

type BrandOfficialRow = {
  brandName: string;
  officialName: string;
};

const TABLES = new Map(
  brandTables.tables.map((table) => [table.name, table.rows as BrandOfficialRow[]]),
);

/** Brand.numbers table → Website category keys. Unmapped categories stay without official name. */
const TABLE_TO_CATEGORIES: Record<string, string[]> = {
  میلگرد: ["rebar/ribbed"],
  "میلگرد ساده": ["rebar/plain"],
  تیرآهن: ["beam/ipe"],
  نبشی: ["angle/angle"],
  ناودانی: ["channel/sabok", "channel/sangin"],
  "ورق سیاه": ["sheet/black"],
  "ورق روغنی": ["sheet/oiled"],
  "ورق گالوانیزه": ["sheet/galvanized"],
  "ورق آلیاژی": ["sheet/a283", "sheet/a36", "sheet/a516", "sheet/st52", "sheet/firebox"],
  "ورق CK45": ["sheet/ck45"],
  "ورق ضدسایش": ["sheet/wear"],
  "ورق اسیدشویی": ["sheet/pickled"],
  "ورق آجدار": ["sheet/checker"],
  "ورق رنگی": ["sheet/color"],
  "ورق عرشه فولادی": ["sheet/deck"],
  "ورق شیروانی": ["sheet/roof"],
  "لوله مانیسمان": ["pipe/seamless"],
};

const CATEGORY_ROWS = (() => {
  const map = new Map<string, BrandOfficialRow[]>();
  for (const [tableName, categories] of Object.entries(TABLE_TO_CATEGORIES)) {
    const rows = TABLES.get(tableName) ?? [];
    for (const key of categories) map.set(key, rows);
  }
  return map;
})();

const PREFIXES = ["میلگرد", "تیرآهن", "نبشی", "ناودانی", "ورق", "لوله"];
const STOP = new Set([
  "فولاد",
  "میلگرد",
  "تیرآهن",
  "نبشی",
  "ناودانی",
  "ورق",
  "لوله",
  "شرکت",
  "مجتمع",
  "صنایع",
  "نورد",
  "تولید",
  "صنعت",
  "گروه",
  "ایرانیان",
]);

function normalize(value: string): string {
  return value
    .replace(/\u200c/g, " ")
    .replace(/\u200d/g, "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/آ/g, "ا")
    .replace(/أ/g, "ا")
    .replace(/إ/g, "ا")
    .replace(/\s+/g, " ")
    .trim();
}

function stripPrefix(value: string): string {
  const text = normalize(value);
  for (const prefix of PREFIXES) {
    if (text.startsWith(`${prefix} `)) return text.slice(prefix.length + 1).trim();
  }
  return text;
}

function tokens(value: string): string[] {
  return stripPrefix(value)
    .replace(/[()]/g, " ")
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !STOP.has(part));
}

function uniqueRow(hits: BrandOfficialRow[]): BrandOfficialRow | undefined {
  if (hits.length !== 1) return undefined;
  return hits[0];
}

function officialFromRows(rows: BrandOfficialRow[], websiteName: string): string {
  const websiteNorm = normalize(websiteName);
  const websiteShort = stripPrefix(websiteName);

  const exact = uniqueRow(
    rows.filter((row) => {
      const brandNorm = normalize(row.brandName);
      const brandShort = stripPrefix(row.brandName);
      return (
        websiteNorm === brandNorm ||
        websiteNorm === brandShort ||
        websiteShort === brandNorm ||
        websiteShort === brandShort
      );
    }),
  );
  if (exact) return exact.officialName;

  const contained = uniqueRow(
    rows.filter((row) => {
      const brandShort = stripPrefix(row.brandName);
      if (!websiteShort || !brandShort) return false;
      if (Math.min(websiteShort.length, brandShort.length) < 3) return false;
      return websiteShort.includes(brandShort) || brandShort.includes(websiteShort);
    }),
  );
  if (contained) return contained.officialName;

  const websiteTokens = tokens(websiteName);
  if (!websiteTokens.length) return "";
  const byToken = uniqueRow(
    rows.filter((row) => {
      const haystack = `${stripPrefix(row.brandName)} ${normalize(row.officialName)}`;
      return websiteTokens.every((token) => haystack.includes(token));
    }),
  );
  return byToken?.officialName ?? "";
}

export function officialNameFromBrandFile(
  groupCode: string,
  categoryCode: string,
  brandName: string,
): string {
  const rows = CATEGORY_ROWS.get(`${groupCode}/${categoryCode}`);
  if (!rows?.length) return "";
  return officialFromRows(rows, brandName);
}
