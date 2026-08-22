import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthState";
import { ManualIntakeModal } from "../intake/ManualIntakeModal";
import { usePriceUpdate } from "../intake/PriceUpdateState";
import { MOCK_NOTICE, PRODUCT_GROUPS } from "../mock/data";
import { IdentityNoticeBar } from "../settings/IdentityState";
import { ApiHealthBar, useApiHealth } from "./ApiHealthBar";

function categoryScopeFromPath(pathname: string): { groupCode?: string; categoryCode?: string } | undefined {
  const match = pathname.match(/^\/category\/([^/]+)(?:\/([^/]+))?/);
  if (!match) return undefined;
  return { groupCode: match[1], categoryCode: match[2] };
}

export function Layout() {
  const { pathname } = useLocation();
  const { busy, note, error, report, runUpdate } = usePriceUpdate();
  const { username, logout } = useAuth();
  const apiOk = useApiHealth();
  const [manualOpen, setManualOpen] = useState(false);
  const activeGroup = categoryScopeFromPath(pathname)?.groupCode ?? null;
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
          <p>محصولات، وضعیت و قیمت روز</p>
        </div>

        <nav className="rail-nav" aria-label="میز کار">
          <NavLink to="/" end>
            میز کار
          </NavLink>
        </nav>

        <nav className="rail-nav" aria-label="تنظیمات">
          <p className="rail-label">تنظیمات</p>
          <NavLink to="/settings/manufacturers">تولیدکنندگان</NavLink>
          <NavLink to="/settings/products">محصولات</NavLink>
          <NavLink to="/settings/sources">منابع</NavLink>
          <NavLink to="/settings/keys">کلیدها و زمان‌بندی</NavLink>
        </nav>

        <nav className="rail-nav rail-groups" aria-label="گروه‌ها و دسته‌ها">
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

        <div className="rail-foot">
          {username ? <span className="rail-status">ورود: {username}</span> : null}
          <button className="btn" type="button" onClick={() => void logout()}>
            خروج
          </button>
          <span className="rail-status">انتشار خودکار خاموش</span>
          <span className={apiOk === false ? "rail-status is-down" : "rail-status"}>
            {apiOk === false ? "پشت‌صحنه خاموش است" : apiOk ? "پشت‌صحنه روشن است" : "در حال بررسی پشت‌صحنه…"}
          </span>
          <span>قیمت روز با دکمه به‌روزرسانی پر می‌شود</span>
        </div>
      </aside>

      <div className="workspace">
        <p className="preview-strip">{MOCK_NOTICE}</p>
        <ApiHealthBar ok={apiOk} />
        <IdentityNoticeBar />
        <div className="workspace-bar">
          <button
            className="btn primary"
            type="button"
            disabled={busy || apiOk === false}
            onClick={() => void runUpdate(categoryScopeFromPath(pathname))}
          >
            {busy ? "در حال به‌روزرسانی…" : "به‌روزرسانی قیمت"}
          </button>
          <button className="btn" type="button" disabled={busy || apiOk === false} onClick={() => setManualOpen(true)}>
            ورود دستی
          </button>
          {note ? <p className="workspace-bar-note">{note}</p> : null}
          {error ? <p className="workspace-bar-error">{error}</p> : null}
          {report.length ? (
            <ul className="workspace-bar-report">
              {report.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <Outlet />
      </div>
      {manualOpen ? <ManualIntakeModal onClose={() => setManualOpen(false)} /> : null}
    </div>
  );
}
