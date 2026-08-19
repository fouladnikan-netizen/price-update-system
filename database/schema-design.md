# طراحی مفهومی دیتابیس سامانه قیمت

**وضعیت:** سند طراحی — Migration اجرایی، Seed، دیتابیس واقعی و کد ساخته نشده است.  
**قرارداد قفل‌شده:** `docs/product-identity-contract.md`  
**موتور پیشنهادی:** پایگاه داده رابطه‌ای (PostgreSQL)  
**تاریخ:** ۱۹ اوت ۲۰۲۶

تا دریافت `product_code` و در صورت نیاز `brand_id` رسمی از Website، هیچ ردیف محصول Seed نمی‌شود. ستون `products.product_code` در طرح الزامی است؛ خالی بودن آن یعنی هنوز نباید Insert انجام شود.

---

## قواعد طرح که در همه جداول اعمال می‌شود

1. هویت محصول Website فقط `product_code` است. سامانه آن را نمی‌سازد و حدس نمی‌زند.
2. برند محصول مستقل نیست؛ فقط از مسیر `product_brand_tags` به کالا وصل می‌شود.
3. محل قیمت برنددار: `product_id` + `brand_id`. محل قیمت بدون برند: فقط `product_id` و `brand_id` تهی.
4. برند هم‌نام با `(group_id, category_id, display_name)` از هم جدا می‌ماند.
5. `factory` و `warehouse` دو `price_type` مستقل‌اند، نه دو محصول.
6. فایل خام در Object Storage است، نه در ستون دیتابیس. جدول فقط فراداده و کلید ذخیره را نگه می‌دارد.
7. قیمت ناموجود ردیف روزانه ندارد یا مبلغ آن `NULL` است؛ **هرگز صفر ذخیره نمی‌شود**.
8. انتشار خودکار در پایلوت خاموش است (`auto_publish = false`).
9. جداول قیمت و انتشار `product_code` را به‌صورت اسنپ‌شات هم نگه می‌دارند تا Audit بدون وابستگی به Rename بعدی خوانا بماند؛ منبع حقیقت هویت همچنان Website است.
10. رمز، Session تلگرام و کلید API در دیتابیس ذخیره نمی‌شود.

نماد نوع‌ها در این سند پیشنهادی است، نه DDL اجرایی.

---

## نمودار روابط

```text
users
  │
  ├─────────────── audit_logs.actor_user_id
  ├─────────────── price_reviews.reviewer_user_id
  └─────────────── publications.requested_by_user_id

product_groups 1───N product_categories 1───N products
                                              │
brands ───────────────────────────────────────┤
  │                                           │
  └────────── N product_brand_tags N ─────────┘
                     │
                     │  تگ مجاز است، هویت قیمت نیست
                     ▼
sources 1───N raw_inputs 1───N price_observations
                                      │
                                      ├── brand_id تهی یا معتبر
                                      ├── price_reviews
                                      ▼
                               final_daily_prices
                                      │
                                      ▼
                                 publications
```

---

## جریان موجودیت‌ها

```text
محصول پایه                تگ برند                  مشاهده قیمت
products                  product_brand_tags       price_observations
product_code              product ↔ brand          raw_inputs را مصرف می‌کند
بدون برند داخل هویت       فقط مجوز اتصال           product + brand اختیاری
        │                        │                         │
        └──────────┬─────────────┘                         │
                   ▼                                       ▼
            محل قیمت مفهومی                         بررسی انسانی
            برنددار: product_code + brand_id       price_reviews
            بدون برند: product_code                تأیید / رد / اصلاح تطبیق
                   │                                       │
                   └──────────────────┬────────────────────┘
                                      ▼
                             قیمت نهایی روزانه
                             final_daily_prices
                             factory و warehouse جدا
                             مبلغ صفر ممنوع
                                      │
                                      ▼  فقط با اجازه صریح
                             انتشار کنترل‌شده
                             publications
                             پایلوت: خودکار خاموش
```

ترتیب الزامی پردازش:

1. منبع تعریف می‌شود (`sources`)؛ `auto_publish` پیش‌فرض خاموش است.
2. ورودی خام عیناً ثبت می‌شود (`raw_inputs`) قبل از هر استخراج.
3. استخراج به مشاهده تبدیل می‌شود (`price_observations`). اگر `product_code` قطعی نباشد، مشاهده نامنطبق می‌ماند و منتشر نمی‌شود.
4. اگر دسته برنددار باشد، `brand_id` باید به تگ مجاز همان گروه/دسته برسد. حدس برند ممنوع است.
5. انسان مشاهده مشکوک یا نامنطبق را بررسی می‌کند (`price_reviews`). بررسی حق ساخت `product_code` ندارد.
6. پس از تأیید، قیمت نهایی همان روز برای همان محل قیمت و همان `price_type` نوشته می‌شود.
7. انتشار فقط با اقدام مجاز و در صورت وجود `product_code` (و `brand_id` برای کالای برنددار) انجام می‌شود.

---

## ۱) `product_groups`

### هدف

هفت گروه اصلی رابط کاربری: میلگرد، تیرآهن، ورق، نبشی، ناودانی، پروفیل، لوله.

### ستون‌ها

| ستون | نوع پیشنهادی | الزام | توضیح |
| --- | --- | --- | --- |
| `id` | uuid | بله | کلید داخلی |
| `code` | text | بله | کد پایدار انگلیسی؛ مثلاً `rebar` |
| `name_fa` | text | بله | نام فارسی نمایش |
| `sort_order` | integer | بله | ترتیب منو |
| `is_active` | boolean | بله | پیش‌فرض true |
| `created_at` | timestamptz | بله | |
| `updated_at` | timestamptz | بله | |

### کلید اصلی

`id`

### کلیدهای خارجی

ندارد.

### یکتایی

- `code` یکتا
- `name_fa` یکتا

### روابط

- یک به چند با `product_categories`
- محدوده برندهای هم‌نام از اینجا شروع می‌شود

### امنیت و Audit

تغییر نام یا غیرفعال‌سازی گروه در `audit_logs` ثبت می‌شود. حذف فیزیکی گروه دارای دسته ممنوع است (`ON DELETE RESTRICT`).

---

## ۲) `product_categories`

### هدف

دسته داخل گروه؛ مثلاً میلگرد آجدار، میلگرد ساده، ورق سیاه. نبود برند برای یک دسته خطا نیست.

### ستون‌ها

| ستون | نوع پیشنهادی | الزام | توضیح |
| --- | --- | --- | --- |
| `id` | uuid | بله | |
| `group_id` | uuid | بله | گروه والد |
| `code` | text | بله | کد پایدار داخل گروه |
| `name_fa` | text | بله | |
| `brand_mode` | text | بله | `branded` یا `unbranded` |
| `sort_order` | integer | بله | |
| `is_active` | boolean | بله | |
| `created_at` | timestamptz | بله | |
| `updated_at` | timestamptz | بله | |

`brand_mode = unbranded` یعنی قیمت فقط با `product_code` ذخیره می‌شود و نبود جدول برند خطا نیست.  
`brand_mode = branded` یعنی تگ برند برای قیمت کامل لازم است؛ قیمت بدون برند مشکوک است.

### کلید اصلی

`id`

### کلیدهای خارجی

- `group_id` → `product_groups.id` ، `ON DELETE RESTRICT`

### یکتایی

- `(group_id, code)` یکتا
- `(group_id, name_fa)` یکتا

### روابط

- چند به یک با `product_groups`
- یک به چند با `products`
- یک به چند با `brands` از طریق دامنه تگ و با `product_brand_tags`

### امنیت و Audit

تغییر `brand_mode` حساس است و باید Audit شود؛ روی اعتبار مشاهدات قبلی اثر دارد. حذف دسته دارای محصول ممنوع است.

---

## ۳) `products`

### هدف

محصول پایه Website. برند داخل این جدول نیست.

### ستون‌ها

| ستون | نوع پیشنهادی | الزام | توضیح |
| --- | --- | --- | --- |
| `id` | uuid | بله | کلید داخلی |
| `product_code` | text | **بله** | هویت Website؛ سامانه پر نمی‌کند |
| `category_id` | uuid | بله | |
| `standard_name` | text | بله | نام نمایش پایه؛ مثلاً نبشی ۴ |
| `grade` | text | خیر | مثلاً A3 |
| `size_value` | text | خیر | مقدار سایز نرمال‌شده |
| `thickness_mm` | numeric | خیر | |
| `length_label` | text | خیر | مثلاً شاخه ۱۲ متری |
| `pipe_schedule` | text | خیر | |
| `form` | text | خیر | فابریک / رول / ... |
| `approx_weight` | numeric | خیر | هویت نیست |
| `weight_unit` | text | خیر | مثلاً `kg` |
| `technical_attrs` | jsonb | خیر | مشخصات تکمیلی |
| `is_active` | boolean | بله | |
| `source_of_code` | text | بله | فقط `website` |
| `created_at` | timestamptz | بله | |
| `updated_at` | timestamptz | بله | |

محدودیت‌های ستونی:

- `product_code` خالی، فاصله‌فقط، یا ساخته‌شده محلی ممنوع است.
- `source_of_code` فقط `website` است تا مسیر حدس بسته بماند.
- Insert بدون `product_code` رسمی Website از نظر این طرح نامعتبر است؛ بنابراین Seed فعلی مجاز نیست.

### کلید اصلی

`id`

هویت کسب‌وکار: `product_code`

### کلیدهای خارجی

- `category_id` → `product_categories.id` ، `ON DELETE RESTRICT`

### یکتایی

- `product_code` یکتا

### روابط

- چند به یک با `product_categories` (و از آنجا با گروه)
- یک به چند با `product_brand_tags`
- یک به چند با `price_observations` و `final_daily_prices`

### امنیت و Audit

ایجاد، تغییر کد (نباید رخ دهد مگر اصلاح اعلام‌شده Website)، فعال/غیرفعال‌سازی و تغییر دسته همگی Audit می‌شوند. کاربر یا Worker حق Insert با کد تولیدی ندارد. API محصول باید نقش مدیر داشته باشد.

---

## ۴) `brands`

### هدف

تگ کارخانه/تولیدکننده. به‌تنهایی محصول و قیمت نیست.

### ستون‌ها

| ستون | نوع پیشنهادی | الزام | توضیح |
| --- | --- | --- | --- |
| `id` | uuid | بله | کلید داخلی سامانه |
| `website_brand_id` | text | خیر تا دریافت رسمی | هویت تگ Website وقتی موجود باشد |
| `group_id` | uuid | بله | گروه تفکیک هم‌نام |
| `category_id` | uuid | بله | دسته تفکیک هم‌نام |
| `display_name` | text | بله | نام سایت؛ مثلاً شکفته |
| `legal_name` | text | خیر | نام حقوقی |
| `aliases` | jsonb | خیر | آرایه نام جایگزین؛ هویت نیست |
| `is_active` | boolean | بله | |
| `created_at` | timestamptz | بله | |
| `updated_at` | timestamptz | بله | |

«یزد» تیرآهن و «یزد» نبشی دو ردیف جدا هستند چون `group_id` و `category_id` فرق دارد.  
ادغام فقط اگر Website یک `website_brand_id` واحد بدهد.

اگر Website بعداً یک تگ را بین چند دسته مشترک بداند، همان `website_brand_id` روی چند ردیف تکرار نمی‌شود؛ اشتراک از مسیر تگ‌ها و اعلام Website مدیریت می‌شود، نه از روی شباهت نام.

### کلید اصلی

`id`

### کلیدهای خارجی

- `group_id` → `product_groups.id` ، `ON DELETE RESTRICT`
- `category_id` → `product_categories.id` ، `ON DELETE RESTRICT`
- بررسی سازگاری: `brands.group_id` باید با گروهِ `category_id` یکی باشد

### یکتایی

- `(group_id, category_id, display_name)` یکتا — تفکیک هم‌نام
- `website_brand_id` یکتا وقتی مقدار دارد (unique جزئی)

`display_name` در کل سامانه یکتا نیست.

### روابط

- چند به یک با گروه و دسته
- یک به چند با `product_brand_tags`
- یک به چند با مشاهدات و قیمت نهایی، فقط وقتی تگ مجاز وجود داشته باشد

### امنیت و Audit

ساخت خودکار برند از متن منبع ممنوع است. ایجاد/ادغام/تغییر نام Audit می‌شود. `website_brand_id` را سامانه تولید نمی‌کند.

---

## ۵) `product_brand_tags`

### هدف

ارتباط مجاز محصول پایه ↔ برند. این جدول هویت قیمت نیست؛ فقط می‌گوید این تگ روی این کالا یا این دسته مجاز است.

### ستون‌ها

| ستون | نوع پیشنهادی | الزام | توضیح |
| --- | --- | --- | --- |
| `id` | uuid | بله | |
| `product_id` | uuid | شرطی | تگ روی یک محصول مشخص |
| `category_id` | uuid | بله | همیشه مشخص است؛ محدوده دسته |
| `brand_id` | uuid | بله | |
| `scope` | text | بله | `product` یا `category` |
| `is_active` | boolean | بله | |
| `created_at` | timestamptz | بله | |
| `updated_at` | timestamptz | بله | |

قواعد:

- `scope = product` → `product_id` الزامی؛ تگ فقط همان کالا.
- `scope = category` → `product_id` تهی؛ تگ برای همه محصولات آن دسته.
- `brand_id.category_id` باید با `category_id` این ردیف یکی باشد.
- افزودن تگ، `product_code` جدید نمی‌سازد.

### کلید اصلی

`id`

### کلیدهای خارجی

- `product_id` → `products.id` ، `ON DELETE CASCADE` فقط برای خود تگ
- `category_id` → `product_categories.id` ، `ON DELETE RESTRICT`
- `brand_id` → `brands.id` ، `ON DELETE RESTRICT`

### یکتایی

- اگر `scope = product`: `(product_id, brand_id)` یکتا
- اگر `scope = category`: `(category_id, brand_id)` یکتا جایی که `product_id IS NULL`

### روابط

- پل بین `products` و `brands`
- مرجع اعتبارسنجی `price_observations.brand_id` و `final_daily_prices.brand_id`

### امنیت و Audit

حذف تگ قیمت‌های تاریخی را پاک نمی‌کند؛ فقط مجوز اتصال بعدی را می‌بندد (`is_active = false` ترجیح دارد). تغییر تگ Audit می‌شود.

---

## ۶) `sources`

### هدف

تعریف منبع دریافت قیمت. منبع زیرمجموعه محصول نیست؛ می‌تواند به گروه، دسته، یا چند کالا مربوط باشد.

### ستون‌ها

| ستون | نوع پیشنهادی | الزام | توضیح |
| --- | --- | --- | --- |
| `id` | uuid | بله | |
| `name` | text | بله | |
| `source_type` | text | بله | `website`، `telegram`، `excel`، `csv`، `pdf`، `image`، `manual` |
| `address` | text | خیر | URL یا شناسه کانال عمومی/مجاز |
| `connector_key` | text | بله | کدام رابط ساختاری |
| `scope_group_id` | uuid | خیر | دامنه اختیاری |
| `scope_category_id` | uuid | خیر | |
| `schedule_cron` | text | خیر | |
| `is_active` | boolean | بله | |
| `auto_publish` | boolean | بله | **پیش‌فرض false**؛ در پایلوت باید false بماند |
| `secret_ref` | text | خیر | ارجاع به Secret Manager، نه خود راز |
| `created_at` | timestamptz | بله | |
| `updated_at` | timestamptz | بله | |

`source_type` فقط مقادیر بالا. دور زدن CAPTCHA، Paywall یا فضای خصوصی در مدل مجاز نیست.

### کلید اصلی

`id`

### کلیدهای خارجی

- `scope_group_id` → `product_groups.id` ، اختیاری
- `scope_category_id` → `product_categories.id` ، اختیاری

### یکتایی

- `(source_type, address, connector_key)` یکتا وقتی `address` مقدار دارد

### روابط

- یک به چند با `raw_inputs`

### امنیت و Audit

Session تلگرام، کوکی و API key در این جدول نیست. تغییر `auto_publish` به true در پایلوت باید نقش مدیر + Audit اجباری داشته باشد. Worker بدون این فلگ حق ساخت `publications` ندارد.

---

## ۷) `raw_inputs`

### هدف

حفظ ورودی خام **قبل از پردازش**. بدون این ردیف، استخراج و مشاهده قیمت مجاز نیست.

### ستون‌ها

| ستون | نوع پیشنهادی | الزام | توضیح |
| --- | --- | --- | --- |
| `id` | uuid | بله | |
| `source_id` | uuid | بله | |
| `received_at` | timestamptz | بله | زمان دریافت |
| `external_message_id` | text | خیر | شناسه پیام برای جلوگیری از تکرار |
| `source_url` | text | خیر | |
| `message_link` | text | خیر | |
| `storage_key` | text | خیر | کلید Object Storage برای فایل/تصویر/PDF |
| `content_type` | text | خیر | |
| `raw_text` | text | خیر | متن عمومی/مجاز؛ نه راز |
| `checksum` | text | خیر | هش محتوا |
| `parser_version` | text | خیر | نسخهٔ بعدی پردازش |
| `fetch_status` | text | بله | `stored`، `ignored`، `failed` |
| `created_at` | timestamptz | بله | |

محتوای باینری در دیتابیس ذخیره نمی‌شود.

### کلید اصلی

`id`

### کلیدهای خارجی

- `source_id` → `sources.id` ، `ON DELETE RESTRICT`

### یکتایی

- `(source_id, external_message_id)` یکتا وقتی شناسه پیام موجود است
- در نبود شناسه: `(source_id, checksum, received_at)` برای کاهش تکرار

### روابط

- چند به یک با `sources`
- یک به چند با `price_observations`

### امنیت و Audit

دسترسی به `raw_text` و فایل باید نقش محدود داشته باشد. ردیف خام به‌خاطر Audit پاک نمی‌شود؛ حداکثر آرشیو می‌شود. Insert این جدول خودش رویداد مهم است و در `audit_logs` یا با trace پردازش ثبت می‌شود.

---

## ۸) `price_observations`

### هدف

یک قیمت استخراج‌شده، جدا از هویت محصول. تا بررسی/انتخاب، قیمت نهایی روز نیست.

### ستون‌ها

| ستون | نوع پیشنهادی | الزام | توضیح |
| --- | --- | --- | --- |
| `id` | uuid | بله | |
| `raw_input_id` | uuid | بله | منبع خام |
| `source_id` | uuid | بله | تکرار کنترل‌شده برای پرس‌وجو |
| `product_id` | uuid | خیر | تهی = هنوز نامنطبق |
| `product_code_snapshot` | text | خیر | اگر تطبیق قطعی شده باشد |
| `brand_id` | uuid | خیر | تهی برای کالای بدون‌برند یا برند نامشخص |
| `price_type` | text | بله | `factory` یا `warehouse` |
| `amount` | numeric | خیر | استخراج‌شده؛ صفر ممنوع |
| `unit` | text | خیر | مثلاً `kg` |
| `price_date` | date | خیر | تاریخ اعتبار ادعا‌شده منبع |
| `match_status` | text | بله | `unmatched`، `suggested`، `matched`، `rejected` |
| `match_confidence` | numeric | خیر | فقط پیشنهاد؛ انتشار نمی‌آورد |
| `is_suspicious` | boolean | بله | پیش‌فرض false |
| `suspicious_reason` | text | خیر | |
| `extracted_payload` | jsonb | خیر | خروجی اعتبارسنجی‌شده استخراج |
| `parser_version` | text | بله | |
| `model_name` | text | خیر | مدل AI اگر استفاده شده |
| `created_at` | timestamptz | بله | |
| `updated_at` | timestamptz | بله | |

قواعد ستونی:

- `price_type IN ('factory', 'warehouse')`
- `amount IS NULL OR amount > 0`
- اگر `match_status = matched` آنگاه `product_id` و `product_code_snapshot` الزامی است
- اگر دسته محصول `branded` و تطبیق قطعی است، `brand_id` الزامی است
- اگر دسته `unbranded` است، `brand_id` باید تهی بماند
- `brand_id` فقط وقتی مجاز است که تگ فعال در `product_brand_tags` برای آن محصول یا دسته‌اش وجود داشته باشد
- AI حق Set کردن `match_status = matched` قطعی بدون قاعده تعیین‌گرا/انسان را ندارد؛ پیشنهاد در `suggested` می‌ماند

### کلید اصلی

`id`

### کلیدهای خارجی

- `raw_input_id` → `raw_inputs.id` ، `ON DELETE RESTRICT`
- `source_id` → `sources.id`
- `product_id` → `products.id` ، `ON DELETE RESTRICT`
- `brand_id` → `brands.id` ، `ON DELETE RESTRICT`

### یکتایی

تکرار کامل همان استخراج نباید دوباره Insert شود:

- `(raw_input_id, product_id, brand_id, price_type, price_date)` با ایندکس جزئی متناسب با `brand_id` تهی

چند مشاهده از چند منبع برای یک محل قیمت در یک روز مجاز است.

### روابط

- از `raw_inputs` می‌آید
- به محصول پایه و برند اختیاری وصل است
- یک به چند با `price_reviews`
- می‌تواند منبع انتخاب‌شده `final_daily_prices` باشد

### امنیت و Audit

تغییر تطبیق، برند، مبلغ و پرچم مشکوک Audit می‌شود. مشاهده مشکوک مسیر انتشار را می‌بندد تا بررسی انسان تمام شود.

---

## ۹) `price_reviews`

### هدف

تصمیم انسان روی مشاهده یا انتخاب قیمت روز. بدون این مرحله، قیمت مشکوک منتشر نمی‌شود.

### ستون‌ها

| ستون | نوع پیشنهادی | الزام | توضیح |
| --- | --- | --- | --- |
| `id` | uuid | بله | |
| `observation_id` | uuid | بله | |
| `reviewer_user_id` | uuid | بله | |
| `decision` | text | بله | `approve_match`، `reject_match`، `approve_as_daily`، `reject_price`، `needs_info` |
| `override_product_id` | uuid | خیر | فقط محصول موجود؛ کد جدید ساخته نمی‌شود |
| `override_brand_id` | uuid | خیر | فقط تگ مجاز موجود |
| `note` | text | خیر | |
| `created_at` | timestamptz | بله | |

`updated_at` ندارد؛ اصلاح یعنی ردیف تصمیم جدید (تاریخچه کامل).

### کلید اصلی

`id`

### کلیدهای خارجی

- `observation_id` → `price_observations.id` ، `ON DELETE RESTRICT`
- `reviewer_user_id` → `users.id`
- `override_product_id` → `products.id`
- `override_brand_id` → `brands.id`

### یکتایی

یکتایی سخت روی مشاهده لازم نیست؛ آخرین تصمیم معتبر از روی `created_at` خوانده می‌شود. می‌توان آخرین تصمیم را در مشاهده هم cache کرد، اما منبع حقیقت همین جدول است.

### روابط

- به مشاهده و کاربر بررسی‌کننده
- پیش‌نیاز نوشتن یا انتشار `final_daily_prices` وقتی `is_suspicious` یا `match_status != matched`

### امنیت و Audit

فقط نقش `reviewer` یا `admin`. خود ردیف رویداد Audit است؛ علاوه بر آن خلاصه تصمیم در `audit_logs` تکرار می‌شود. Override نمی‌تواند محصول بدون `product_code` بسازد.

---

## ۱۰) `final_daily_prices`

### هدف

قیمت نهایی یک روز برای یک محل قیمت و یک نوع قیمت. مبنای جدول UI، نمودار و انتشار.

### ستون‌ها

| ستون | نوع پیشنهادی | الزام | توضیح |
| --- | --- | --- | --- |
| `id` | uuid | بله | |
| `product_id` | uuid | بله | |
| `product_code_snapshot` | text | بله | کد پایه Website |
| `brand_id` | uuid | خیر | تهی = کالای بدون‌برند |
| `price_type` | text | بله | `factory` یا `warehouse` |
| `price_date` | date | بله | |
| `amount` | numeric | بله | باید `> 0` |
| `unit` | text | بله | |
| `selected_observation_id` | uuid | خیر | مشاهده مبنای انتخاب |
| `final_source_id` | uuid | بله | منبع نهایی نمایش داده‌شده |
| `status` | text | بله | `draft`، `approved`، `blocked` |
| `approved_by_user_id` | uuid | خیر | برای `approved` الزامی |
| `approved_at` | timestamptz | خیر | |
| `created_at` | timestamptz | بله | |
| `updated_at` | timestamptz | بله | |

قواعد:

- روز بدون قیمت = **نبود ردیف**. نمودار این روز را شکاف می‌بیند، نه صفر.
- `CHECK (amount > 0)` — صفر و منفی رد می‌شوند.
- کالای `unbranded`: `brand_id IS NULL`
- کالای `branded`: `brand_id IS NOT NULL` و تگ فعال دارد
- `factory` و `warehouse` دو ردیف جدا با همین محصول/برند/تاریخ‌اند
- `status = approved` پیش‌نیاز انتشار است
- پایلوت: حتی `approved` به‌صورت خودکار `publications` نمی‌سازد

### کلید اصلی

`id`

### کلیدهای خارجی

- `product_id` → `products.id` ، `ON DELETE RESTRICT`
- `brand_id` → `brands.id` ، `ON DELETE RESTRICT`
- `selected_observation_id` → `price_observations.id`
- `final_source_id` → `sources.id`
- `approved_by_user_id` → `users.id`

### یکتایی

به‌خاطر `NULL` در SQL، دو ایندکس جزئی:

- یکتا روی `(product_id, brand_id, price_type, price_date)` جایی که `brand_id IS NOT NULL`
- یکتا روی `(product_id, price_type, price_date)` جایی که `brand_id IS NULL`

این همان `DailyPriceKey` قرارداد است.

### روابط

- از محصول پایه و برند اختیاری
- به منبع نهایی و مشاهده انتخاب‌شده
- یک به چند با `publications`

### امنیت و Audit

هر تأیید، تغییر مبلغ، عوض شدن منبع نهایی و برگشت از `approved` Audit اجباری دارد. Update مبلغ بدون ردیف بررسی برای مشاهده مشکوک ممنوع است.

---

## ۱۱) `publications`

### هدف

ارسال کنترل‌شده قیمت تأییدشده به API Website. پایلوت بدون انتشار خودکار.

### ستون‌ها

| ستون | نوع پیشنهادی | الزام | توضیح |
| --- | --- | --- | --- |
| `id` | uuid | بله | |
| `final_daily_price_id` | uuid | بله | |
| `product_code` | text | بله | اسنپ‌شات کد پایه |
| `brand_id` | uuid | خیر | اسنپ‌شات؛ برای برنددار الزامی |
| `website_brand_id` | text | خیر | اگر Website تگ جدا دارد |
| `price_type` | text | بله | |
| `amount` | numeric | بله | باید `> 0` |
| `unit` | text | بله | |
| `price_date` | date | بله | |
| `idempotency_key` | text | بله | تکرار درخواست اثر دوبار ندارد |
| `status` | text | بله | `queued`، `sent`، `accepted`، `rejected`، `failed`، `cancelled` |
| `auto_generated` | boolean | بله | در پایلوت باید false باشد |
| `requested_by_user_id` | uuid | بله | انتشار بدون کاربر مجاز نیست |
| `requested_at` | timestamptz | بله | |
| `sent_at` | timestamptz | خیر | |
| `website_operation_id` | text | خیر | شناسه عملیات سمت Website |
| `response_payload` | jsonb | خیر | پاسخ بدون راز |
| `error_message` | text | خیر | |

اگر Website `product_code` را نشناسد، وضعیت `rejected` می‌شود و قیمت محلی عوض نمی‌شود.

### کلید اصلی

`id`

### کلیدهای خارجی

- `final_daily_price_id` → `final_daily_prices.id` ، `ON DELETE RESTRICT`
- `brand_id` → `brands.id`
- `requested_by_user_id` → `users.id`

### یکتایی

- `idempotency_key` یکتا
- پیشنهاد کلید: `final_daily_price_id + price_type + price_date + amount` یا معادل `DailyPriceKey` به‌علاوه نسخه مبلغ

### روابط

- از قیمت نهایی تأییدشده
- به کاربر درخواست‌کننده

### امنیت و Audit

نقش `publisher` یا `admin`. Worker زمان‌بند در پایلوت حق Insert با `auto_generated = true` ندارد. هر تلاش ارسال Audit می‌شود. پاسخ Website در لاگ فنی می‌ماند، توکن در آن نوشته نمی‌شود.

---

## ۱۲) `audit_logs`

### هدف

سابقه تغییرهای مهم. فقط افزودنی است.

### ستون‌ها

| ستون | نوع پیشنهادی | الزام | توضیح |
| --- | --- | --- | --- |
| `id` | uuid | بله | |
| `occurred_at` | timestamptz | بله | |
| `actor_user_id` | uuid | خیر | تهی = سیستم/Worker |
| `actor_type` | text | بله | `user`، `worker`، `system` |
| `action` | text | بله | مثلاً `product.update`، `daily_price.approve`، `publication.send` |
| `entity_type` | text | بله | نام جدول منطقی |
| `entity_id` | uuid | خیر | |
| `product_code` | text | خیر | اگر به کالا مربوط باشد |
| `before_state` | jsonb | خیر | |
| `after_state` | jsonb | خیر | |
| `request_id` | text | خیر | ردگیری درخواست |
| `ip` | inet | خیر | |

Update و Delete روی این جدول در طرح مجاز نیست.

### کلید اصلی

`id`

### کلیدهای خارجی

- `actor_user_id` → `users.id` ، `ON DELETE SET NULL`

بدون FK اجباری به همه موجودیت‌ها تا حذف منطقی موجودیت لاگ را نشکند.

### یکتایی

لازم نیست؛ ایندکس روی `(entity_type, entity_id, occurred_at)` و `(product_code, occurred_at)`.

### روابط

- به کاربر عامل
- به همه موجودیت‌های حساس به‌صورت ارجاع نرم

### امنیت و Audit

خود این جدول Audit است. دسترسی خواندن محدود به مدیر. محتوای راز و Session در `before_state` / `after_state` ذخیره نمی‌شود.

رویدادهای حداقل اجباری: ایجاد/تغییر محصول، برند، تگ، منبع، `auto_publish`، تطبیق مشاهده، بررسی انسان، تأیید قیمت روزانه، درخواست/نتیجه انتشار، تغییر نقش کاربر.

---

## ۱۳) `users`

### هدف

عامل انسانی برای بررسی، تأیید و انتشار.

### ستون‌ها

| ستون | نوع پیشنهادی | الزام | توضیح |
| --- | --- | --- | --- |
| `id` | uuid | بله | |
| `email` | text | بله | |
| `full_name` | text | بله | |
| `role` | text | بله | `admin`، `reviewer`، `publisher`، `operator` |
| `status` | text | بله | `active`، `disabled` |
| `password_hash` | text | شرطی | اگر احراز هویت محلی باشد |
| `last_login_at` | timestamptz | خیر | |
| `created_at` | timestamptz | بله | |
| `updated_at` | timestamptz | بله | |

نقش‌ها در پایلوت:

| نقش | محصول/برند | بررسی قیمت | انتشار |
| --- | --- | --- | --- |
| `operator` | خواندن | خیر | خیر |
| `reviewer` | خواندن | بله | خیر |
| `publisher` | خواندن | در صورت اعطا | بله، دستی |
| `admin` | مدیریت | بله | بله؛ تنها نقش مجاز برای روشن کردن `auto_publish` بعد از پایلوت |

### کلید اصلی

`id`

### کلیدهای خارجی

ندارد.

### یکتایی

- `email` یکتا

### روابط

- بررسی‌ها، انتشارها، Audit

### امنیت و Audit

`password_hash` لاگ نمی‌شود. تغییر نقش و غیرفعال‌سازی Audit اجباری است. کاربر `disabled` نمی‌تواند بررسی یا انتشار کند.

---

## محدودیت‌های سراسری قیمت و هویت

| موضوع | اعمال در |
| --- | --- |
| `product_code` الزامی و غیرقابل تولید | `products.product_code` + `source_of_code = website` |
| برند ≠ محصول | نبود برند داخل `products`؛ فقط `product_brand_tags` |
| قیمت برنددار | `brand_id NOT NULL` + وجود تگ فعال |
| قیمت بدون برند | `brand_id NULL` + دسته `unbranded` |
| تفکیک هم‌نام | یکتایی `(group_id, category_id, display_name)` در `brands` |
| دو نوع قیمت | `price_type` جدا در مشاهده و قیمت نهایی |
| حفظ خام | `raw_inputs` قبل از `price_observations` |
| صفر ممنوع | `CHECK (amount > 0)` ؛ روز خالی = نبود ردیف |
| انتشار خودکار خاموش | `sources.auto_publish` پیش‌فرض false ؛ `publications.auto_generated` در پایلوت false |
| Seed ممنوع تا کد Website | هیچ Insert در `products` بدون کد رسمی |

---

## آنچه در این طرح نیست

این جداول عمداً به فهرست اصلی اضافه نشده‌اند و در این مرحله ساخته نمی‌شوند:

- جدول محل قیمت فیزیکی (`price_slots`) — محل قیمت از `product_id` + `brand_id` اختیاری مشتق می‌شود
- صف Job جدا — می‌تواند جدول عملیاتی Worker باشد، نه هویت دامنه
- کاتالوگ موقت بدون `product_code` — طبق قرارداد داخل دیتابیس محصول نمی‌آید

وزن برند×سایز تیرآهن موجودیت قیمت نیست و در این سیزده جدول جایی ندارد.

---

## کارهای انجام‌نشده

طبق دستور این مرحله:

- Migration اجرایی نوشته نشده است
- دیتابیس ساخته نشده است
- Seed انجام نشده است
- فایل Excel، Numbers، کاتالوگ و کد برنامه تغییر نکرده‌اند

پس از تأیید این سند می‌توان DDL/Migration را نوشت؛ باز هم تا دریافت `product_code` رسمی Website نباید Seed محصول اجرا شود.
