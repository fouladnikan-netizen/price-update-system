export type CategoryBrand = {
  id: string;
  name: string;
};

/** Display names from Website export. Not product_code. Not invented. */
export const CATEGORY_BRANDS: Record<string, CategoryBrand[]> = {
  "angle/angle": [
    { id: "angle-angle-01", name: "آریان فولاد" },
    { id: "angle-angle-02", name: "آونگان" },
    { id: "angle-angle-03", name: "اسپیرال" },
    { id: "angle-angle-04", name: "اشتهارد" },
    { id: "angle-angle-05", name: "زنجان" },
    { id: "angle-angle-06", name: "شکفته مشهد" },
    { id: "angle-angle-07", name: "ظهوریان مشهد" },
    { id: "angle-angle-08", name: "منظومه" },
    { id: "angle-angle-09", name: "ناب تبریز" },
    { id: "angle-angle-10", name: "یزد" },
  ],
  "beam/ipe": [
    { id: "beam-ipe-01", name: "آریان فولاد" },
    { id: "beam-ipe-02", name: "اصفهان" },
    { id: "beam-ipe-03", name: "اطلس" },
    { id: "beam-ipe-04", name: "اهواز" },
    { id: "beam-ipe-05", name: "خیام نیشابور" },
    { id: "beam-ipe-06", name: "ظفر بناب" },
    { id: "beam-ipe-07", name: "فایکو" },
    { id: "beam-ipe-08", name: "ماهان" },
    { id: "beam-ipe-09", name: "کرمانشاه" },
    { id: "beam-ipe-10", name: "یزد" },
  ],
  "beam/h": [
  ],
  "channel/sabok": [
    { id: "channel-sabok-01", name: "آریان فولاد" },
    { id: "channel-sabok-02", name: "اسپیرال" },
    { id: "channel-sabok-03", name: "شکفته مشهد" },
    { id: "channel-sabok-04", name: "صبا فولاد منظومه" },
    { id: "channel-sabok-05", name: "فولاد تهران" },
    { id: "channel-sabok-06", name: "فولاد سپهر ایرانیان" },
    { id: "channel-sabok-07", name: "ماهان" },
  ],
  "channel/sangin": [
    { id: "channel-sangin-01", name: "البرز غرب ابهر" },
    { id: "channel-sangin-02", name: "صبا فولاد سمنان" },
    { id: "channel-sangin-03", name: "فایکو" },
    { id: "channel-sangin-04", name: "ناب تبریز" },
  ],
  "pipe/api": [
    { id: "pipe-api-01", name: "سپاهان" },
    { id: "pipe-api-02", name: "سپنتا" },
  ],
  "pipe/spiral": [
    { id: "pipe-spiral-01", name: "نیزار" },
    { id: "pipe-spiral-02", name: "کالوپ" },
  ],
  "pipe/water": [
    { id: "pipe-water-01", name: "ساوه" },
    { id: "pipe-water-02", name: "سپاهان" },
    { id: "pipe-water-03", name: "سپنتا" },
  ],
  "pipe/gas": [
    { id: "pipe-gas-01", name: "ساوه" },
    { id: "pipe-gas-02", name: "سپاهان" },
    { id: "pipe-gas-03", name: "سپنتا" },
  ],
  "pipe/casing": [
    { id: "pipe-casing-01", name: "تهران شرق" },
    { id: "pipe-casing-02", name: "کالوپ" },
    { id: "pipe-casing-03", name: "کیان پرشیا" },
  ],
  "pipe/scaffold": [
  ],
  "pipe/welded": [
  ],
  "pipe/seamless": [
    { id: "pipe-seamless-01", name: "آرتا" },
    { id: "pipe-seamless-02", name: "آسین ابهر" },
    { id: "pipe-seamless-03", name: "اهواز" },
    { id: "pipe-seamless-04", name: "واردات چین" },
    { id: "pipe-seamless-05", name: "پاسارگاد" },
    { id: "pipe-seamless-06", name: "کاوه" },
  ],
  "pipe/galvanized": [
    { id: "pipe-galvanized-01", name: "ساوه" },
    { id: "pipe-galvanized-02", name: "سپاهان" },
    { id: "pipe-galvanized-03", name: "سپنتا" },
  ],
  "pipe/greenhouse": [
  ],
  "profile/mobli": [
  ],
  "profile/construction": [
  ],
  "profile/industrial": [
  ],
  "profile/galvanized": [
  ],
  "profile/z": [
  ],
  "profile/frame": [
  ],
  "rebar/ribbed": [
    { id: "rebar-ribbed-01", name: "آتیه خلیج فارس" },
    { id: "rebar-ribbed-02", name: "آذر امین" },
    { id: "rebar-ribbed-03", name: "آریان فولاد" },
    { id: "rebar-ribbed-04", name: "آناهیتا" },
    { id: "rebar-ribbed-05", name: "ارگ تبریز" },
    { id: "rebar-ribbed-06", name: "امیرکبیر خزر" },
    { id: "rebar-ribbed-07", name: "جهان فولاد سیرجان" },
    { id: "rebar-ribbed-08", name: "حدید سیرجان" },
    { id: "rebar-ribbed-09", name: "نیشابور" },
    { id: "rebar-ribbed-10", name: "درپاد تبریز" },
    { id: "rebar-ribbed-11", name: "ذوب آهن اصفهان" },
    { id: "rebar-ribbed-12", name: "راد همدان" },
    { id: "rebar-ribbed-13", name: "روهینا" },
    { id: "rebar-ribbed-14", name: "شاهین بناب" },
    { id: "rebar-ribbed-15", name: "ظفر بناب" },
    { id: "rebar-ribbed-16", name: "فایکو" },
    { id: "rebar-ribbed-17", name: "فولاد ابرکوه" },
    { id: "rebar-ribbed-18", name: "فولاد ابهر" },
    { id: "rebar-ribbed-19", name: "فولاد بافق" },
    { id: "rebar-ribbed-20", name: "فولاد بردسیر کرمان" },
    { id: "rebar-ribbed-21", name: "فولاد بناب" },
    { id: "rebar-ribbed-22", name: "فولاد زاگرس" },
    { id: "rebar-ribbed-23", name: "فولاد شاهرود" },
    { id: "rebar-ribbed-24", name: "فولاد میانه" },
    { id: "rebar-ribbed-25", name: "فولاد نطنز" },
    { id: "rebar-ribbed-26", name: "فولاد کوثر اهواز" },
    { id: "rebar-ribbed-27", name: "فولاد یزد" },
    { id: "rebar-ribbed-28", name: "قائم رازی" },
    { id: "rebar-ribbed-29", name: "هیربد" },
    { id: "rebar-ribbed-30", name: "پردیس" },
    { id: "rebar-ribbed-31", name: "پرشین فولاد" },
    { id: "rebar-ribbed-32", name: "کاوه اروند" },
    { id: "rebar-ribbed-33", name: "کاوه تیکمه داش" },
    { id: "rebar-ribbed-34", name: "کویر کاشان" },
    { id: "rebar-ribbed-35", name: "گروه ملی فولاد" },
  ],
  "rebar/plain": [
    { id: "rebar-plain-01", name: "آذر گستر سدید" },
    { id: "rebar-plain-02", name: "آیین صنعت" },
    { id: "rebar-plain-03", name: "خلیج فارس" },
    { id: "rebar-plain-04", name: "فولاد یزد" },
    { id: "rebar-plain-05", name: "نوین متین" },
    { id: "rebar-plain-06", name: "کویر کاشان" },
  ],
  "sheet/a283": [
    { id: "sheet-a283-01", name: "اکسین اهواز" },
    { id: "sheet-a283-02", name: "فولاد مبارکه" },
  ],
  "sheet/a36": [
    { id: "sheet-a36-01", name: "اکسین اهواز" },
    { id: "sheet-a36-02", name: "فولاد مبارکه" },
  ],
  "sheet/a516": [
    { id: "sheet-a516-01", name: "اکسین اهواز" },
    { id: "sheet-a516-02", name: "فولاد مبارکه" },
  ],
  "sheet/ck45": [
    { id: "sheet-ck45-01", name: "اکسین اهواز" },
    { id: "sheet-ck45-02", name: "نورد و تولید قطعات" },
  ],
  "sheet/st52": [
    { id: "sheet-st52-01", name: "اکسین اهواز" },
    { id: "sheet-st52-02", name: "فولاد مبارکه" },
  ],
  "sheet/firebox": [
    { id: "sheet-firebox-01", name: "اکسین اهواز" },
    { id: "sheet-firebox-02", name: "فولاد مبارکه" },
  ],
  "sheet/checker": [
    { id: "sheet-checker-01", name: "فولاد مبارکه" },
  ],
  "sheet/pickled": [
    { id: "sheet-pickled-01", name: "فولاد غرب" },
    { id: "sheet-pickled-02", name: "فولاد مبارکه" },
  ],
  "sheet/color": [
    { id: "sheet-color-01", name: "فولاد غرب" },
    { id: "sheet-color-02", name: "فولاد مبارکه" },
    { id: "sheet-color-03", name: "هفت الماس" },
  ],
  "sheet/oiled": [
    { id: "sheet-oiled-01", name: "فولاد غرب" },
    { id: "sheet-oiled-02", name: "فولاد مبارکه" },
    { id: "sheet-oiled-03", name: "هفت الماس" },
  ],
  "sheet/black": [
    { id: "sheet-black-01", name: "اکسین اهواز" },
    { id: "sheet-black-02", name: "فولاد خرم‌آباد" },
    { id: "sheet-black-03", name: "فولاد مبارکه" },
    { id: "sheet-black-04", name: "فولاد کاویان" },
    { id: "sheet-black-05", name: "فولاد گیلان" },
    { id: "sheet-black-06", name: "نورد و تولید قطعات" },
  ],
  "sheet/roof": [
    { id: "sheet-roof-01", name: "تاراز" },
    { id: "sheet-roof-02", name: "دشتستان" },
    { id: "sheet-roof-03", name: "شهریار تبریز" },
    { id: "sheet-roof-04", name: "فولاد غرب" },
    { id: "sheet-roof-05", name: "فولاد مبارکه" },
    { id: "sheet-roof-06", name: "هفت الماس" },
    { id: "sheet-roof-07", name: "ورق خودرو شهرکرد" },
    { id: "sheet-roof-08", name: "کاشان" },
  ],
  "sheet/wear": [
    { id: "sheet-wear-01", name: "NM" },
    { id: "sheet-wear-02", name: "هاردوکس" },
    { id: "sheet-wear-03", name: "واردات هند" },
    { id: "sheet-wear-04", name: "واردات چین" },
  ],
  "sheet/deck": [
    { id: "sheet-deck-01", name: "تاراز" },
    { id: "sheet-deck-02", name: "دشتستان" },
    { id: "sheet-deck-03", name: "شهریار تبریز" },
    { id: "sheet-deck-04", name: "فولاد غرب" },
    { id: "sheet-deck-05", name: "فولاد مبارکه" },
    { id: "sheet-deck-06", name: "هفت الماس" },
    { id: "sheet-deck-07", name: "ورق خودرو شهرکرد" },
    { id: "sheet-deck-08", name: "کاشان" },
  ],
  "sheet/galvanized": [
    { id: "sheet-galvanized-01", name: "تاراز" },
    { id: "sheet-galvanized-02", name: "دشتستان" },
    { id: "sheet-galvanized-03", name: "شهریار تبریز" },
    { id: "sheet-galvanized-04", name: "فولاد مبارکه" },
    { id: "sheet-galvanized-05", name: "هفت الماس" },
    { id: "sheet-galvanized-06", name: "ورق خودرو شهرکرد" },
    { id: "sheet-galvanized-07", name: "کاشان" },
  ],
};

import generatedBrands from "./category-brands.generated.json" with { type: "json" };

export function getCategoryBrands(groupCode: string | undefined, categoryCode: string | undefined): CategoryBrand[] {
  if (!groupCode || !categoryCode) return [];
  const key = `${groupCode}/${categoryCode}`;
  const generated = (generatedBrands as Record<string, CategoryBrand[]>)[key];
  if (generated?.length) return generated;
  return CATEGORY_BRANDS[key] ?? [];
}

