import { NavLink, Outlet, useLocation } from "react-router-dom";

const COPY: Record<string, { kicker: string; title: string; note: string }> = {
  "/settings/manufacturers": {
    kicker: "تنظیمات",
    title: "تولیدکنندگان",
    note: "کالا و برند حذف نمی‌شوند. فقط تگ محصول×برند وصل یا قطع می‌شود.",
  },
  "/settings/products": {
    kicker: "تنظیمات",
    title: "محصولات",
    note: "گروه را از تب بالا انتخاب کنید. ستون‌ها فقط داده همان گروه را نشان می‌دهند.",
  },
  "/settings/sources": {
    kicker: "تنظیمات",
    title: "منابع",
    note: "اول گروه، بعد دسته را انتخاب کنید. جدول فقط منابع همان دسته را نشان می‌دهد.",
  },
  "/settings/keys": {
    kicker: "تنظیمات",
    title: "کلیدها و زمان‌بندی",
    note: "کلیدها روی سرور می‌مانند. ساعت و روز به‌روزرسانی خودکار را اینجا بگذارید.",
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
        <NavLink to="/settings/keys">کلیدها و زمان‌بندی</NavLink>
      </nav>
      <Outlet />
    </section>
  );
}
