import assert from "node:assert/strict";
import { test } from "node:test";
import { getScopeBrands } from "./catalog.ts";
import { parseMillPriceItems } from "./millPriceTable.ts";

const brands = getScopeBrands("rebar", "ribbed");

test("reads stacked ahanonline mill rows with factory prices", () => {
  const text = `میلگرد ذوب آهن اصفهان
آخرین بروزرسانی
سایز
استاندارد
محل تحویل
قیمت (تومان)
12
A3
کارخانه
78,550
14
A3
کارخانه
67,640`;
  const items = parseMillPriceItems(text, brands);
  assert.equal(items.length, 2);
  assert.equal(items[0]?.suggested_brand_name, "ذوب آهن اصفهان");
  assert.equal(items[0]?.size, "12");
  assert.equal(items[0]?.factory_price, 78550);
  assert.equal(items[1]?.size, "14");
  assert.equal(items[1]?.factory_price, 67640);
});

test("reads compact pivan mill rows and skips call-for-price", () => {
  const text = `میلگرد ذوب آهن اصفهان
آخرین بروزرسانی: امروز ۲۹ مرداد
سایز (mm) استاندارد محل تحویل واحد قیمت (تومان) نوسان قیمت نمودار قیمت
۱۲ A3 کارخانه کیلوگرم تماس بگیرید تماس بگیرید ۰.۰ %
۱۴ A3 کارخانه کیلوگرم ۷۴,۵۰۰ ۶۷,۷۰۰ ۰.۰ %
۱۶ A3 کارخانه کیلوگرم ۷۳,۵۰۰ ۶۶,۸۰۰ ۰.۰ %`;
  const items = parseMillPriceItems(text, brands);
  assert.equal(items.length, 2);
  assert.equal(items[0]?.size, "14");
  assert.equal(items[0]?.factory_price, 67700);
  assert.equal(items[0]?.suggested_brand_id, "rebar-ribbed-11");
  assert.equal(items[1]?.size, "16");
  assert.equal(items[1]?.factory_price, 66800);
});

test("reads compact row when mill name sits between grade and factory", () => {
  const items = parseMillPriceItems("۱۲ A3 ذوب آهن اصفهان کارخانه کیلوگرم ۷۸,۵۵۰", brands);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.suggested_brand_name, "ذوب آهن اصفهان");
  assert.equal(items[0]?.size, "12");
  assert.equal(items[0]?.factory_price, 78550);
});

test("glued mill name آذرفولاد امین maps to آذر امین", () => {
  const text = `آذرفولاد امین
12
A3
کارخانه
66,636
14
A3
کارخانه
66,363`;
  const items = parseMillPriceItems(text, brands);
  assert.equal(items.length, 2);
  assert.equal(items[0]?.suggested_brand_id, "rebar-ribbed-02");
  assert.equal(items[0]?.suggested_brand_name, "آذر امین");
  assert.equal(items[0]?.factory_price, 66636);
  const compact = parseMillPriceItems("۱۴ A3 آذرفولاد امین کارخانه کیلوگرم ۶۶,۳۶۳", brands);
  assert.equal(compact[0]?.suggested_brand_id, "rebar-ribbed-02");
  assert.equal(compact[0]?.factory_price, 66363);
});

test("reads ahanprice mill product rows with grade on the name line", () => {
  const text = `قیمت میلگرد آجدار آذر فولاد امین
8 قیمت میلگرد 8 آذر فولاد امین A2 4.5
۷۰٬۵۴۵
500 1405/05/29
10 قیمت میلگرد 10 A3 آذر فولاد امین A3 7
۷۰٬۲۷۲
14 قیمت میلگرد 14 آذر فولاد امین A3 14
۷۰٬۰۰۰`;
  const items = parseMillPriceItems(text, brands);
  assert.equal(items.length, 3);
  assert.equal(items[0]?.suggested_brand_id, "rebar-ribbed-02");
  assert.equal(items[0]?.size, "8");
  assert.equal(items[0]?.grade, "A2");
  assert.equal(items[0]?.factory_price, 70545);
  assert.equal(items[1]?.size, "10");
  assert.equal(items[1]?.grade, "A3");
  assert.equal(items[2]?.size, "14");
  assert.equal(items[2]?.factory_price, 70000);
});

test("قائم اصفهان product rows map to قائم رازی", () => {
  const items = parseMillPriceItems(
    "14 قیمت میلگرد 14 قائم اصفهان A3 14\n۷۰٬۰۰۰",
    brands,
  );
  assert.equal(items[0]?.suggested_brand_id, "rebar-ribbed-28");
  assert.equal(items[0]?.suggested_brand_name, "قائم رازی");
});

test("reads اصفهان آهن mill cards with rial VAT-inclusive prices", () => {
  const text = `قیمت میلگرد ذوب آهن اصفهان
عنوان سایز محل تحویل قیمت ریال با ٪۱۰ ارزش افزوده خرید نمودار
میلگرد 12 ذوب آهن اصفهان 12 اصـفهان
ناموجود
میلگرد 14 ذوب آهن اصفهان 14 اصـفهان
748,000
8,000 خرید
سایز : 14
محل تحویل : اصـفهان
برند : ذوب آهن اصفهان
استاندارد : A3
میلگرد 8 درپاد تبریز A2 8 کارخانه - تبریز
705,000
محل تحویل : کارخانه - تبریز
استاندارد : A2`;
  const items = parseMillPriceItems(text, brands);
  assert.equal(items.length, 2);
  assert.equal(items[0]?.suggested_brand_name, "ذوب آهن اصفهان");
  assert.equal(items[0]?.size, "14");
  assert.equal(items[0]?.warehouse_price, 748000);
  assert.equal(items[0]?.factory_price, null);
  assert.equal(items[0]?.unit, "rial_per_kg");
  assert.equal(items[1]?.suggested_brand_id, "rebar-ribbed-10");
  assert.equal(items[1]?.size, "8");
  assert.equal(items[1]?.grade, "A2");
  assert.equal(items[1]?.factory_price, 705000);
});

test("reads فولاد ایرانیان size-grade-weight-city rows", () => {
  const text = `قیمت میلگرد درپاد تبریز
آخرین بروزرسانی: ۱۴۰۵/۵/۲۹
سایز استاندارد وزن تقریبی محل تحویل قیمت نوسان نمودار
۸ A۲ ۴.۵ تبریز
۷۰,۷۰۰ ۰٪
نام محصول: میلگرد 8 درپاد تبریز آجدار A2
۱۴ A۳ ۱۴ تبریز
۷۰,۰۰۰ ۰٪`;
  const items = parseMillPriceItems(text, brands);
  assert.equal(items.length, 2);
  assert.equal(items[0]?.suggested_brand_id, "rebar-ribbed-10");
  assert.equal(items[0]?.size, "8");
  assert.equal(items[0]?.grade, "A2");
  assert.equal(items[0]?.factory_price, 70700);
  assert.equal(items[0]?.unit, "toman_per_kg");
  assert.equal(items[1]?.size, "14");
  assert.equal(items[1]?.factory_price, 70000);
});

test("reads آهن پخش mill heading plus قیمت میلگرد size rows", () => {
  const stacked = `ذوب آهن اصفهان
قیمت میلگرد 12 اصفهان
1404/12/07
12
A3
10.7
67,300
61,743
قیمت میلگرد 14 اصفهان
14
A3
14.52
تماس بگیرید`;
  const stackedItems = parseMillPriceItems(stacked, brands);
  assert.equal(stackedItems.length, 1);
  assert.equal(stackedItems[0]?.suggested_brand_name, "ذوب آهن اصفهان");
  assert.equal(stackedItems[0]?.size, "12");
  assert.equal(stackedItems[0]?.factory_price, 61743);
  const compact = parseMillPriceItems(
    "ذوب آهن اصفهان\nقیمت میلگرد 16 اصفهان 16 A3 18.96 55,900 51,284",
    brands,
  );
  assert.equal(compact[0]?.size, "16");
  assert.equal(compact[0]?.factory_price, 51284);
  const neishabur = parseMillPriceItems(
    "قیمت میلگرد نیشابور\nقیمت میلگرد 14 نیشابور 14 A3 14.52 59,500 54,587",
    brands,
  );
  assert.equal(neishabur[0]?.suggested_brand_id, "rebar-ribbed-09");
  assert.equal(neishabur[0]?.size, "14");
});
