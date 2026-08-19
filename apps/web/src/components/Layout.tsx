import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { MOCK_DASHBOARD, MOCK_NOTICE, PRODUCT_GROUPS } from "../mock/data";

const pending = MOCK_DASHBOARD.pendingReviewCount.toLocaleString("fa-IR");

function groupFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/category\/([^/]+)/);
  return match?.[1] ?? null;
}

export function Layout() {
  const { pathname } = useLocation();
  const activeGroup = groupFromPath(pathname);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PRODUCT_GROUPS.map((group) => [group.code, group.code === activeGroup])),
  );

  useEffect(() => {
    if (!activeGroup) return;
    setOpenGroups((current) => ({ ...current, [activeGroup]: true }));
  }, [activeGroup]);

  function toggleGroup(code: string) {
    setOpenGroups((current) => ({ ...current, [code]: !current[code] }));
  }

  return (
    <div className="app">
      <aside className="rail">
        <div className="rail-brand">
          <span className="rail-kicker">میز قیمت</span>
          <strong>به‌روزرسانی روزانه</strong>
          <p>هفت گروه اصلی — منبع و استخراج برای همه دسته‌ها</p>
        </div>

        <nav className="rail-nav" aria-label="میز کار">
          <NavLink to="/" end>
            میز کار
          </NavLink>
        </nav>

        <nav className="rail-nav" aria-label="گروه‌ها و دسته‌ها">
          <p className="rail-label">گروه‌ها</p>
          {PRODUCT_GROUPS.map((group) => {
            const open = Boolean(openGroups[group.code]);
            return (
              <div className={`rail-group ${open ? "is-open" : ""}`} key={group.code}>
                <button
                  type="button"
                  className={`rail-group-toggle ${activeGroup === group.code ? "active" : ""}`}
                  aria-expanded={open}
                  aria-controls={`group-cats-${group.code}`}
                  onClick={() => toggleGroup(group.code)}
                >
                  <span>{group.nameFa}</span>
                  <span className="rail-group-meta">
                    <span className="rail-chevron" aria-hidden />
                  </span>
                </button>
                {open ? (
                  <div className="rail-subnav" id={`group-cats-${group.code}`}>
                    {group.categories.map((category) => (
                      <NavLink key={category.code} to={`/category/${group.code}/${category.code}`}>
                        {category.nameFa}
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <nav className="rail-nav" aria-label="بررسی">
          <NavLink to="/intake">ورود متن</NavLink>
          <NavLink to="/review">
            صف بررسی
            <span className="rail-count">{pending}</span>
          </NavLink>
        </nav>

        <nav className="rail-nav" aria-label="تنظیمات">
          <p className="rail-label">تنظیمات</p>
          <NavLink to="/settings/manufacturers">تولیدکنندگان</NavLink>
          <NavLink to="/settings/products">محصولات</NavLink>
          <NavLink to="/settings/sources">منابع</NavLink>
          <NavLink to="/settings/ai">هوش مصنوعی</NavLink>
        </nav>

        <div className="rail-foot">
          <span className="rail-status">وب‌سایت مصرف‌کننده نیست</span>
          <span>هویت کالا از وب‌سایت می‌آید</span>
        </div>
      </aside>

      <div className="workspace">
        <p className="preview-strip">{MOCK_NOTICE}</p>
        <Outlet />
      </div>
    </div>
  );
}
