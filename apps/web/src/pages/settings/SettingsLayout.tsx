import { NavLink, Outlet, useLocation } from "react-router-dom";

const COPY: Record<string, { kicker: string; title: string; note: string }> = {
  "/settings/manufacturers": {
    kicker: "تنظیمات کاتالوگ",
    title: "تولیدکنندگان",
    note: "کالا و برند حذف نمی‌شوند. فقط تگ محصول×برند وصل یا قطع می‌شود.",
  },
  "/settings/products": {
    kicker: "تنظیمات کاتالوگ",
    title: "محصولات",
    note: "ماتریس کالا مطابق کاتالوگ است. ستون خالی و SKU نمایش داده نمی‌شود.",
  },
  "/settings/sources": {
    kicker: "تنظیمات دریافت",
    title: "منابع",
    note: "منبع به دسته وصل می‌شود. انتشار خودکار خاموش است. اتصال زنده سایت، تلگرام و بله هنوز فعال نیست.",
  },
  "/settings/ai": {
    kicker: "تنظیمات استخراج",
    title: "هوش مصنوعی",
    note: "کلید فقط روی سرور است. خروجی مدل بدون تطبیق کاتالوگ منتشر نمی‌شود.",
  },
};

export function SettingsLayout() {
  const { pathname } = useLocation();
  const copy = COPY[pathname] ?? COPY["/settings/manufacturers"];
  return (
    <section className="desk desk-wide">
      <header className="page-head">
        <div>
          <p className="kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
        </div>
        <p className="page-head-note">{copy.note}</p>
      </header>
      <nav className="settings-tabs" aria-label="بخش‌های تنظیمات">
        <NavLink to="/settings/manufacturers">تولیدکنندگان</NavLink>
        <NavLink to="/settings/products">محصولات</NavLink>
        <NavLink to="/settings/sources">منابع</NavLink>
        <NavLink to="/settings/ai">هوش مصنوعی</NavLink>
      </nav>
      <Outlet />
    </section>
  );
}
