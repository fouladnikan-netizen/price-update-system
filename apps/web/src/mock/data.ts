export type PriceType = "factory" | "warehouse";

export type ObservationStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "needs_more_review"
  | "unmatched"
  | "suspicious";

export type MockBrand = {
  id: string;
  name: string;
  isPreview: true;
};

export type MockProduct = {
  /** Preview-only identity. Not a Website sku. */
  previewCode: string;
  name: string;
  sizeLabel: string;
};

export type DailyPriceRow = {
  previewCode: string;
  factoryPrice: number | null;
  factorySource: string | null;
  warehousePrice: number | null;
  warehouseSource: string | null;
};

export type Observation = {
  id: string;
  previewCode: string;
  brandId: string | null;
  sourceName: string;
  receivedAt: string;
  priceType: PriceType;
  extractedPrice: number | null;
  status: ObservationStatus;
  isSelectedFinal: boolean;
};

export type HistoryPoint = {
  dateLabel: string;
  factory: number | null;
  warehouse: number | null;
};

export type ReviewItem = {
  id: string;
  kind: "suspicious" | "unmatched";
  title: string;
  detail: string;
  extractedPrice: number | null;
  sourceName: string;
  status: ObservationStatus;
};

export type ProductCategory = {
  code: string;
  nameFa: string;
  isPilot: boolean;
};

export type ProductGroup = {
  code: string;
  nameFa: string;
  isPilot: boolean;
  categories: ProductCategory[];
};

function cats(...items: Array<[string, string, boolean?]>): ProductCategory[] {
  return items.map(([code, nameFa, isPilot]) => ({ code, nameFa, isPilot: Boolean(isPilot) }));
}

/** Seven UI groups from the product identity contract. Categories from Website export. */
export const PRODUCT_GROUPS: ProductGroup[] = [
  {
    code: "rebar",
    nameFa: "میلگرد",
    isPilot: true,
    categories: cats(["ribbed", "میلگرد آجدار", true], ["plain", "میلگرد ساده"]),
  },
  {
    code: "beam",
    nameFa: "تیرآهن",
    isPilot: false,
    categories: cats(["ipe", "تیرآهن IPE"], ["h", "تیرآهن هاش"]),
  },
  {
    code: "sheet",
    nameFa: "ورق",
    isPilot: false,
    categories: cats(
      ["black", "ورق سیاه"],
      ["oiled", "ورق روغنی"],
      ["st52", "ورق ST52"],
      ["checker", "ورق آجدار"],
      ["firebox", "ورق آتشخوار"],
      ["a516", "ورق A516"],
      ["a36", "ورق A36"],
      ["galvanized", "ورق گالوانیزه"],
      ["a283", "ورق A283"],
      ["roof", "ورق شیروانی"],
      ["ck45", "ورق CK45"],
      ["pickled", "ورق اسیدشویی"],
      ["wear", "ورق ضدسایش"],
      ["deck", "ورق عرشه فولادی"],
      ["color", "ورق رنگی"],
    ),
  },
  {
    code: "angle",
    nameFa: "نبشی",
    isPilot: false,
    categories: cats(["angle", "نبشی"]),
  },
  {
    code: "channel",
    nameFa: "ناودانی",
    isPilot: false,
    categories: cats(["sabok", "ناودانی سبک"], ["sangin", "ناودانی سنگین"]),
  },
  {
    code: "profile",
    nameFa: "پروفیل",
    isPilot: false,
    categories: cats(
      ["mobli", "پروفیل مبلی"],
      ["construction", "پروفیل ساختمانی"],
      ["industrial", "پروفیل صنعتی"],
      ["galvanized", "پروفیل گالوانیره"],
      ["z", "پروفیل زد"],
      ["frame", "پروفیل چارچوب"],
    ),
  },
  {
    code: "pipe",
    nameFa: "لوله",
    isPilot: false,
    categories: cats(
      ["galvanized", "لوله گالوانیزه"],
      ["seamless", "لوله مانیسمان"],
      ["gas", "لوله تست گاز"],
      ["spiral", "لوله اسپیرال"],
      ["api", "لوله API"],
      ["casing", "لوله جدار چاه"],
      ["water", "لوله تست آب"],
      ["welded", "لوله درزدار"],
      ["greenhouse", "لوله گلخانه‌ای"],
      ["scaffold", "لوله داربستی"],
    ),
  },
];

export function getProductGroup(code: string | undefined): ProductGroup | undefined {
  return PRODUCT_GROUPS.find((group) => group.code === code);
}

export function getProductCategory(
  groupCode: string | undefined,
  categoryCode: string | undefined,
): ProductCategory | undefined {
  if (!categoryCode) return undefined;
  return getProductGroup(groupCode)?.categories.find((category) => category.code === categoryCode);
}

export const MOCK_NOTICE =
  "پیش‌نمایش با داده نمایشی است. به دیتابیس، CSV وب‌سایت و Import واقعی وصل نیست.";

export const MOCK_BRANDS: MockBrand[] = [
  { id: "preview-brand-north", name: "برند نمایشی شمال", isPreview: true },
  { id: "preview-brand-center", name: "برند نمایشی مرکز", isPreview: true },
  { id: "preview-brand-south", name: "برند نمایشی جنوب", isPreview: true },
];

export const MOCK_PRODUCTS: MockProduct[] = [
  { previewCode: "PREVIEW-SIZE-08", name: "میلگرد نمایشی سایز ۸", sizeLabel: "۸" },
  { previewCode: "PREVIEW-SIZE-10", name: "میلگرد نمایشی سایز ۱۰", sizeLabel: "۱۰" },
  { previewCode: "PREVIEW-SIZE-12", name: "میلگرد نمایشی سایز ۱۲", sizeLabel: "۱۲" },
  { previewCode: "PREVIEW-SIZE-14", name: "میلگرد نمایشی سایز ۱۴", sizeLabel: "۱۴" },
  { previewCode: "PREVIEW-SIZE-16", name: "میلگرد نمایشی سایز ۱۶", sizeLabel: "۱۶" },
  { previewCode: "PREVIEW-SIZE-20", name: "میلگرد نمایشی سایز ۲۰", sizeLabel: "۲۰" },
  { previewCode: "PREVIEW-SIZE-25", name: "میلگرد نمایشی سایز ۲۵", sizeLabel: "۲۵" },
];

export const MOCK_DATES = [
  "۱۴۰۵/۰۵/۲۴",
  "۱۴۰۵/۰۵/۲۵",
  "۱۴۰۵/۰۵/۲۶",
  "۱۴۰۵/۰۵/۲۷",
  "۱۴۰۵/۰۵/۲۸",
];

export const MOCK_DASHBOARD = {
  productCount: 7,
  sourceCount: 3,
  pendingReviewCount: 4,
  suspiciousCount: 2,
  lastIngestAt: "۱۴۰۵/۰۵/۲۸ — ساعت ۱۰:۱۸",
  lastIngestSource: "کانال نمایشی الف",
};

const factoryByBrand: Record<string, Array<number | null>> = {
  all: [null, 311_000, 318_500, 325_000, 329_000, 341_000, null],
  "preview-brand-north": [null, 312_000, 319_000, 326_000, 330_000, 342_000, null],
  "preview-brand-center": [308_000, 310_000, 316_000, 322_000, 327_000, 338_000, 351_000],
  "preview-brand-south": [null, null, 315_000, 321_000, 328_000, 340_000, 353_000],
};

const warehouseByBrand: Record<string, Array<number | null>> = {
  all: [null, 318_000, 324_000, 331_000, 336_000, 348_000, null],
  "preview-brand-north": [null, 319_000, 325_000, 332_000, 337_000, 349_000, null],
  "preview-brand-center": [314_000, 317_000, 323_000, 328_000, 334_000, 345_000, 358_000],
  "preview-brand-south": [null, null, 322_000, 327_000, 335_000, 347_000, 360_000],
};

const factorySourceByBrand: Record<string, Array<string | null>> = {
  all: [null, "کانال نمایشی الف", "سایت نمایشی ب", "کانال نمایشی الف", "ورود دستی نمایشی", "سایت نمایشی ب", null],
  "preview-brand-north": [null, "کانال نمایشی الف", "کانال نمایشی الف", "سایت نمایشی ب", "کانال نمایشی الف", "سایت نمایشی ب", null],
  "preview-brand-center": [
    "ورود دستی نمایشی",
    "سایت نمایشی ب",
    "کانال نمایشی الف",
    "سایت نمایشی ب",
    "ورود دستی نمایشی",
    "کانال نمایشی الف",
    "سایت نمایشی ب",
  ],
  "preview-brand-south": [null, null, "کانال نمایشی الف", "ورود دستی نمایشی", "سایت نمایشی ب", "کانال نمایشی الف", "سایت نمایشی ب"],
};

const warehouseSourceByBrand: Record<string, Array<string | null>> = {
  all: [null, "انبار نمایشی", "سایت نمایشی ب", "انبار نمایشی", "ورود دستی نمایشی", "انبار نمایشی", null],
  "preview-brand-north": [null, "انبار نمایشی", "انبار نمایشی", "سایت نمایشی ب", "انبار نمایشی", "ورود دستی نمایشی", null],
  "preview-brand-center": [
    "انبار نمایشی",
    "سایت نمایشی ب",
    "انبار نمایشی",
    "ورود دستی نمایشی",
    "انبار نمایشی",
    "سایت نمایشی ب",
    "انبار نمایشی",
  ],
  "preview-brand-south": [null, null, "انبار نمایشی", "سایت نمایشی ب", "انبار نمایشی", "ورود دستی نمایشی", "انبار نمایشی"],
};

export function getDailyRows(brandId: string | "all"): DailyPriceRow[] {
  const factory = factoryByBrand[brandId] ?? factoryByBrand.all;
  const warehouse = warehouseByBrand[brandId] ?? warehouseByBrand.all;
  const fSrc = factorySourceByBrand[brandId] ?? factorySourceByBrand.all;
  const wSrc = warehouseSourceByBrand[brandId] ?? warehouseSourceByBrand.all;
  return MOCK_PRODUCTS.map((product, index) => ({
    previewCode: product.previewCode,
    factoryPrice: factory[index] ?? null,
    factorySource: fSrc[index] ?? null,
    warehousePrice: warehouse[index] ?? null,
    warehouseSource: wSrc[index] ?? null,
  }));
}

export const MOCK_OBSERVATIONS: Observation[] = [
  {
    id: "obs-1",
    previewCode: "PREVIEW-SIZE-14",
    brandId: "preview-brand-north",
    sourceName: "کانال نمایشی الف",
    receivedAt: "۱۴۰۵/۰۵/۲۸ — ۰۹:۴۱",
    priceType: "factory",
    extractedPrice: 326_000,
    status: "approved",
    isSelectedFinal: true,
  },
  {
    id: "obs-2",
    previewCode: "PREVIEW-SIZE-14",
    brandId: "preview-brand-north",
    sourceName: "سایت نمایشی ب",
    receivedAt: "۱۴۰۵/۰۵/۲۸ — ۰۸:۱۲",
    priceType: "factory",
    extractedPrice: 329_500,
    status: "pending_review",
    isSelectedFinal: false,
  },
  {
    id: "obs-3",
    previewCode: "PREVIEW-SIZE-14",
    brandId: "preview-brand-north",
    sourceName: "انبار نمایشی",
    receivedAt: "۱۴۰۵/۰۵/۲۸ — ۱۰:۰۵",
    priceType: "warehouse",
    extractedPrice: 332_000,
    status: "approved",
    isSelectedFinal: true,
  },
  {
    id: "obs-4",
    previewCode: "PREVIEW-SIZE-14",
    brandId: "preview-brand-center",
    sourceName: "کانال نمایشی الف",
    receivedAt: "۱۴۰۵/۰۵/۲۸ — ۰۷:۵۰",
    priceType: "factory",
    extractedPrice: 348_000,
    status: "suspicious",
    isSelectedFinal: false,
  },
  {
    id: "obs-5",
    previewCode: "PREVIEW-SIZE-08",
    brandId: null,
    sourceName: "ورود دستی نمایشی",
    receivedAt: "۱۴۰۵/۰۵/۲۸ — ۰۶:۲۰",
    priceType: "factory",
    extractedPrice: null,
    status: "unmatched",
    isSelectedFinal: false,
  },
];

export const MOCK_HISTORY: HistoryPoint[] = [
  { dateLabel: "۲۲", factory: 318_000, warehouse: 324_000 },
  { dateLabel: "۲۳", factory: 320_000, warehouse: 326_000 },
  { dateLabel: "۲۴", factory: null, warehouse: null },
  { dateLabel: "۲۵", factory: 323_000, warehouse: 329_000 },
  { dateLabel: "۲۶", factory: 325_000, warehouse: 331_000 },
  { dateLabel: "۲۷", factory: null, warehouse: null },
  { dateLabel: "۲۸", factory: 326_000, warehouse: 332_000 },
];

export const MOCK_REVIEWS: ReviewItem[] = [
  {
    id: "rev-1",
    kind: "suspicious",
    title: "میلگرد نمایشی سایز ۱۴ — برند نمایشی مرکز",
    detail: "اختلاف غیرعادی با میانگین همان روز. حدس برند انجام نشده است.",
    extractedPrice: 348_000,
    sourceName: "کانال نمایشی الف",
    status: "suspicious",
  },
  {
    id: "rev-2",
    kind: "suspicious",
    title: "میلگرد نمایشی سایز ۲۰ — برند نمایشی جنوب",
    detail: "مبلغ استخراج‌شده نسبت به روز قبل جهش زیاد دارد.",
    extractedPrice: 401_000,
    sourceName: "سایت نمایشی ب",
    status: "suspicious",
  },
  {
    id: "rev-3",
    kind: "unmatched",
    title: "متن نمایشی بدون تطبیق کالا",
    detail: "sku وب‌سایت مشخص نشد. محصول جدید ساخته نشده است.",
    extractedPrice: 275_000,
    sourceName: "کانال نمایشی الف",
    status: "unmatched",
  },
  {
    id: "rev-4",
    kind: "unmatched",
    title: "تصویر نمایشی بدون کد کالا",
    detail: "نام کالا مبهم است و تطبیق قطعی انجام نشد.",
    extractedPrice: null,
    sourceName: "ورود دستی نمایشی",
    status: "unmatched",
  },
];

export function formatToman(value: number | null): string {
  if (value == null) return "—";
  return `${value.toLocaleString("fa-IR")} تومان`;
}

export function statusLabel(status: ObservationStatus): string {
  switch (status) {
    case "pending_review":
      return "منتظر بررسی";
    case "approved":
      return "تأییدشده";
    case "rejected":
      return "ردشده";
    case "needs_more_review":
      return "نیازمند بررسی بیشتر";
    case "unmatched":
      return "تطبیق‌نیافته";
    case "suspicious":
      return "مشکوک";
    default:
      return status;
  }
}

export function statusTone(status: ObservationStatus): "neutral" | "success" | "warning" | "danger" {
  switch (status) {
    case "approved":
      return "success";
    case "pending_review":
    case "needs_more_review":
      return "warning";
    case "rejected":
    case "suspicious":
    case "unmatched":
      return "danger";
    default:
      return "neutral";
  }
}
