import { Link } from "react-router-dom";
import { useDailyPrices } from "../intake/DailyPriceState";
import { tehranJalaliKey, tehranJalaliLabel } from "../intake/dates";
import { countGroupProducts } from "../mock/catalog";
import { PRODUCT_GROUPS } from "../mock/data";
import { useSourceState } from "../settings/SourceState";

export function DashboardPage() {
  const { sources } = useSourceState();
  const { prices } = useDailyPrices();
  const activeSources = sources.filter((item) => item.isActive).length;
  const today = tehranJalaliKey();
  const todayCount = prices.filter((item) => item.date === today).length;
  const latest = prices[0];

  return (
    <section className="desk">
      <header className="page-head">
        <div>
          <p className="kicker">میز کار امروز</p>
          <h1>{tehranJalaliLabel()}</h1>
        </div>
        <p className="page-head-note">یک دکمه قیمت را از منابع می‌گیرد و در جدول همان روز می‌نویسد. سلول خالی یعنی ناموجود، نه صفر.</p>
      </header>

      <div className="desk-hero">
        <div className="desk-hero-copy">
          <p className="kicker">وضعیت</p>
          <h2>{todayCount ? `${todayCount.toLocaleString("fa-IR")} قیمت امروز ثبت شده` : "هنوز قیمت امروز ثبت نشده"}</h2>
          <p>
            به‌روزرسانی قیمت را بزنید. ورود دستی برای متن یا تصویری است که منبع زنده ندارد. انتشار به وب‌سایت خودکار نیست.
          </p>
        </div>
        <dl className="desk-facts">
          <div>
            <dt>آخرین ثبت</dt>
            <dd>{latest ? latest.productCode : "—"}</dd>
            <dd className="muted">{latest ? new Date(latest.updatedAt).toLocaleString("fa-IR") : "هنوز به‌روزرسانی نشده"}</dd>
          </div>
          <div>
            <dt>منابع فعال</dt>
            <dd>{activeSources.toLocaleString("fa-IR")} منبع</dd>
            <dd className="muted">از تنظیمات منابع</dd>
          </div>
        </dl>
      </div>

      <ul className="group-index">
        {PRODUCT_GROUPS.map((group) => (
          <li key={group.code}>
            <Link to={`/category/${group.code}`}>
              <strong>{group.nameFa}</strong>
              <span>{countGroupProducts(group.code).toLocaleString("fa-IR")} کالا</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
