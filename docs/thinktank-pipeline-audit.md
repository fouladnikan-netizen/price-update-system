# گزارش وضعیت موجود — جریان قیمت (اتاق فکر)

تاریخ: ۲۰۲۶-۰۸-۲۵  
منبع حقیقت هویت: `Website.sku = PriceSystem.product_code`

## معماری فعلی

```
collect → extract (mill/AI) → match (catalog JSON) → review/ceiling → ops_daily_prices → publish
```

- `apps/api`: extract، match، publish، schedule، Bale inbox
- `apps/web`: پنل منابع، صف بررسی، جدول روزانه
- کاتالوگ runtime: `apps/web/src/mock/category-products.json` (نه جدول `products` در Postgres)

## قابلیت‌های موجود

- استخراج جدول میلگرد + fallback AI
- تطبیق با SKU موجود؛ رد کد ساختگی
- سقف قیمت (MAX) بین منابع
- ریال/تومان + VAT در مسیر ثبت/انتشار
- جداسازی کارخانه/انبار
- publish با idempotency key
- بات بله (inbox داخل app) و worker تلگرام (compose)

## قابلیت‌های ناقص نسبت به سند اتاق فکر

| نیاز | وضعیت |
|------|--------|
| قفل کاتالوگ روی SKU وب‌سایت | شکسته — کاتالوگ فعلی از Final Product (۱۲۳۵ SKU compositional) |
| وضعیت `AMBIGUOUS` | نیست |
| منابع YAML دسته‌ای | فقط allowlist آهن‌آنلاین/پرایس |
| موتور فرمول ورق | نیست |
| Override دستی با اعتبار | جزئی (بات/پنل) |
| شبیه‌سازی قبل از انتشار | ناقص |
| Rollback انتشار | نیست |
| تأیید انسانی اجباری قبل از schedule publish | دور زده می‌شود |

## مسیرهای خطرناک ایجاد محصول/دسته

| مسیر | خطر | ایزوله |
|------|-----|--------|
| `scripts/sync-catalog-from-final-product.mjs` | تولید SKU جدید | نباید runtime را تغذیه کند؛ فقط آرشیو |
| `scripts/sync-catalog-from-website.mjs` | امن — کپی SKU سایت | مسیر رسمی |
| AI / match / bot | محصول نمی‌سازند | حفظ شود |
| `001_init.sql` products | schema خالی | seed نشود |

## تفاوت کلیدی الان

کاتالوگ لوکال/سرور با وب‌سایت **۰ تطابق** دارد. تا sync مجدد از وب‌سایت، publish واقعی بی‌معنی است.

## تصمیم اجرا (فاز ۰ به بعد)

1. بازگردانی کاتالوگ از `website-sku-catalog.prod.json`
2. Seed منابع تأییدشده (URLهای اتاق فکر)
3. افزودن `ambiguous` به match
4. سخت‌گیری publish فقط روی SKU وب‌سایت
5. اسکلت موتور قواعد + تست publish واقعی
