# منبع رسمی محصولات و `product_code` در پروژه Website

**وضعیت:** بررسی فقط‌خواندنی — هیچ فایل، دیتابیس، API، Seed یا کدی تغییر نکرده است.  
**مسیر پروژه Website بررسی‌شده:** `/Users/ehsanmohammadi/website`  
**تاریخ بررسی:** ۱۹ اوت ۲۰۲۶

---

## نتیجه قطعی درباره `product_code`

**فیلد یا ستون با نام `product_code` در پروژه Website پیدا نشد.**

جستجو در مدل‌ها، Seedها، مسیرهای `app/api`، اسکریپت‌های export و کد ادمین هیچ تعریف، ایندکس، یا قرارداد API با نام `product_code` / `productCode` برنگرداند.

بنابراین در وضعیت فعلی، **منبع رسمی با نام `product_code` در Website وجود ندارد.**

تا وقتی Website فیلدی با همین نام معرفی نکند، سامانه قیمت مجاز به حدس یا ساخت `product_code` نیست.

---

## ۱) مدل / جدول محصولات

موتور داده: MongoDB (Mongoose).  
مدل: `models/Product.js`  
نام مجموعه: `products`

محصول پایه است. برند داخل هویت محصول نیست؛ به‌صورت آرایه تگ روی همان سند ذخیره می‌شود.

فیلدهای مرتبط با هویت و طبقه‌بندی:

| فیلد مدل | نقش مشاهده‌شده |
| --- | --- |
| `_id` | شناسه داخلی MongoDB |
| `name` | نام محصول پایه (الزامی) |
| `sku` | رشته کد کالا؛ در فرم ادمین الزامی است |
| `categoryId` | دسته اصلی |
| `categoryIds` | چند دسته؛ اولی معمولاً همان دسته اصلی |
| `brandId` | سازگاری قدیمی؛ اولین تگ برند |
| `brandIds` | تگ‌های برند روی محصول پایه |
| `brandOffers` | قیمت و فعال/غیرفعال به‌ازای هر برند روی همین محصول |
| `tagIds` | تگ‌های عمومی `ProductTag` (جدا از برند) |
| `warehouseOffer` | تگ/قیمت انبار روی همان محصول پایه |
| مشخصات فنی | ضخامت، طول، وزن و ارجاع به نوع، واحد، استاندارد و … |

دسته: `models/ProductCategory.js` — درخت با `parentId`، `titleFa`، `slug`.  
برند کارخانه: `models/Brand.js` — `titleFa`، `officialNameFa`، `slug`، `categoryIds`.  
تگ عمومی: `models/ProductTag.js` — `titleFa`، `slug`.

هیچ‌کدام فیلد `product_code` ندارند.

---

## ۲) Seed و داده اولیه

Seed محصولات فولادی از Excel ورودی `Final Product.xlsx` در ریشه Website استخراج می‌شود، سپس JSON میانی در `seeders/data/` ساخته می‌شود و Seed با `updateOne({ sku }, { $set }, { upsert: true })` محصول را می‌نویسد.

| Seed | الگوی `sku` ساخته‌شده داخل Seed |
| --- | --- |
| `seed-rebar-products.seed.js` | `RBR-{grade}-{size}` مثلاً `RBR-A3-14` |
| `seed-rebar-plain-products.seed.js` | `RBRP-{size}` |
| `seed-beam-hash-products.seed.js` | `BEAM-{size}` و `HASH-{cluster}-{size}` |
| `seed-angle-products.seed.js` | `ANG-…` |
| `seed-channel-products.seed.js` | `CHN-…` |
| `seed-profile-products.seed.js` | `PRF-…` |
| `seed-sheet-products.seed.js` | `sht-…` |
| `seed-lule-products.seed.js` | `pip-…` |

JSON استخراج میلگرد (`seeders/data/rebar-from-final.json`) فقط نام، سایز، گرید، طول و وزن دارد؛ **کد محصول در JSON استخراج نیست.** کد در خود فایل Seed ساخته می‌شود.

این ساخت `sku` داخل Website است، نه فیلد `product_code`. برای سامانه قیمت منبع رسمی `product_code` محسوب نمی‌شود.

فایل خروجی موجود در ریشه Website:

- `product-list-by-menu.csv` (تاریخ فایل: ۱۸ اوت ۲۰۲۶)
- ۱٬۲۶۱ ردیف
- ستون اول با عنوان فارسی «کد یکتا محصول» از فیلد `sku` پر شده است
- ۱۶ کد میلگرد آجدار با الگوی `RBR-…` و ۱۳ کد میلگرد ساده `RBRP-…`

در همین CSV شش مقدار تکراری در ستون کد دیده شد. ایندکس Mongoose روی `sku` است، اما در اسکیما `unique: true` اعلام نشده است.

---

## ۳) API دریافت محصولات

API عمومی JSON برای کاتالوگ کامل محصولات پیدا نشد.

آنچه هست:

| مسیر | نوع | محتوا |
| --- | --- | --- |
| صفحه ادمین `/admin/products` | Server Component | فهرست صفحه‌بندی‌شده از Mongo؛ فیلتر `sku` و نام |
| Server Actions در `product-actions.js` | نوشتن/خواندن ادمین | ایجاد و ویرایش محصول با فیلد `sku` |
| `GET /api/admin/products/csv` | CSV ادمین؛ نیاز به `admin.products.read` | تا ۵۰۰۰ ردیف؛ ستون «شماره یکتا» = `sku` |
| `GET /api/admin/products/prices/csv` | CSV ادمین قیمت | همان ساختار فهرست؛ مرتب بر `sku` |
| `GET /api/admin/products/[id]/brand-offers/csv` | CSV تگ برند یک محصول | کلید ردیف: `sku` + `brandSlug` |
| `GET /api/public/daily-prices/export` | CSV عمومی قیمت روز | جدول قیمت صفحات سایت، نه کاتالوگ هویت |
| `POST /api/admin/content-publish/price-page` | انتشار محتوا | مقاله/FAQ صفحه قیمت؛ کاتالوگ محصول نیست |

شناسه مسیر ادمین معمولاً `_id` Mongo است، نه `product_code`.

---

## ۴) فیلد `product_code`

| محل | وضعیت |
| --- | --- |
| مدل `Product` | وجود ندارد |
| مدل‌های Category / Brand / ProductTag | وجود ندارد |
| اعتبارسنجی Zod ایجاد محصول | فیلد الزامی `sku` است، نه `product_code` |
| CSV ادمین | هدر «شماره یکتا» از `sku` |
| اسکریپت `scripts/export-product-brand-list.mjs` | هدر «کد یکتا محصول» از `sku` |
| JSON-LD صفحه قیمت | ویژگی schema.org با نام `sku` |

**منبع رسمی با نام `product_code` یافت نشد.**

---

## ۵) نام محصول پایه

فیلد: `Product.name` (رشته الزامی).

نمونه‌های Seed میلگرد:

- `میلگرد آجدار A3 سایز 14`
- قالب استخراج Excel: `میلگرد آجدار A3 قطر 14 میل`

نام برند داخل `name` نیست. نمایش «نبشی ۴ شکفته» از نام پایه + تگ برند ساخته می‌شود، نه از محصول جدا.

---

## ۶) دسته و گروه محصول

گروه اصلی جدول جدا ندارد. دسته‌ها درخت `ProductCategory` هستند (`parentId`).

در اسکریپت export، گروه منو از `slug` نیاکان دسته حدس زده می‌شود:

| `slug` دسته | گروه نمایش export |
| --- | --- |
| `rebar`، `round-bar` | میلگرد |
| `i-beam`، `h-beam` | تیرآهن |
| `angle-bar`، `u-channel`، … | نبشی و ناودانی |
| `steel-profile` | پروفیل |
| `steel-sheet` | ورق |
| `pipe` / `lule` | لوله |

دسته قابل اتصال به محصول با `productAssignable` مشخص می‌شود. برخی گره‌ها فقط صفحه SEO قیمت‌اند (سایز/برند/منطقه)، نه دسته کاتالوگ کالا.

در CSV export موجود، توزیع گروه تقریباً این است: ورق ۴۵۷، پروفیل ۳۶۳، لوله ۳۱۸، تیرآهن ۵۴، نبشی و ناودانی ۴۰، میلگرد ۲۹.

---

## ۷) تگ‌ها و ارتباط با محصول

دو سازوکار جدا:

**برند (تگ کارخانه روی محصول پایه)**

- `brandIds[]`
- `brandOffers[]`: `{ brandId, priceToman, isActive }`
- `brandId` = اولین تگ برای سازگاری
- مدل `Brand` علاوه بر نام، `categoryIds` دارد (دسته‌های مجاز صفحه قیمت)

این همان مدل «محصول پایه + تگ برند» است. برند سند محصول جدید نمی‌سازد.

**تگ عمومی**

- `tagIds[]` → `ProductTag`
- برای برچسب‌های غیرکارخانه
- هویت قیمت برند نیست

تگ انبار: `warehouseOffer` روی همان محصول پایه.

شناسه برند در Website فیلد `brand_id` نام‌گذاری نشده؛ `_id` Mongo و `slug` برند است.

---

## ۸) استخراج فهرست به Excel یا JSON

امکان‌های موجود (بدون اجرای آن‌ها در این بررسی):

| خروجی | مسیر | فرمت | کلید کالا |
| --- | --- | --- | --- |
| فهرست ادمین | `GET /api/admin/products/csv` | CSV (قابل باز شدن در Excel) | ستون «شماره یکتا» = `sku` |
| فهرست قیمت ادمین | `GET /api/admin/products/prices/csv` | CSV | `sku` |
| برندهای یک کالا | `GET /api/admin/products/[id]/brand-offers/csv` | CSV | `sku` + `brandSlug` |
| فهرست منویی | اسکریپت `scripts/export-product-brand-list.mjs` | CSV در `product-list-by-menu.csv` | «کد یکتا محصول» = `sku` |
| قیمت روز عمومی | `GET /api/public/daily-prices/export` | CSV با Content-Type اکسل | هویت کاتالوگ نیست |

خروجی JSON اختصاصی کاتالوگ محصول پیدا نشد. اسکریپت export فقط خلاصه شمارش را JSON در stdout چاپ می‌کند و فایل را CSV می‌نویسد.

Excel ورودی `Final Product.xlsx` برای Seed است، نه export هویت.

---

## جمع‌بندی برای سامانه قیمت

1. Website محصول پایه دارد و برند را تگ می‌کند؛ این با قرارداد هویت سامانه قیمت هم‌خوان است.
2. **نام فیلد رسمی Website برای هویت کالا `sku` است، نه `product_code`.**
3. تا تعریف صریح فیلد یا قرارداد `product_code` از سوی Website، منبع رسمی با این نام وجود ندارد.
4. Seed محصول در سامانه قیمت همچنان باید متوقف بماند.

---

## مشاهده غیر اجرایی (پیشنهاد منبع جایگزین نیست)

این بند اجرای Seed یا نگاشت خودکار نیست. فقط آنچه در کد Website دیده شد:

اگر بعداً Website اعلام کند هویت مشترک همان مقدار `Product.sku` است، آن مقدار در exportها با عنوان «کد یکتا محصول» / «شماره یکتا» آمده و برای میلگرد پایلوت الگوهایی مثل `RBR-A3-14` دارد. این مشاهده جایگزین تعریف `product_code` نمی‌شود، مگر Website صریحاً همان را `product_code` بنامد.

کارهای این مرحله: هیچ اتصال دیتابیس زنده‌ای برقرار نشد، هیچ Seed/API/فایلی تغییر نکرد، و هیچ `product_code` ساخته نشد.
