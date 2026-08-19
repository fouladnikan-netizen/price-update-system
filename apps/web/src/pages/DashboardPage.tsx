import { Link } from "react-router-dom";
import { countGroupProducts } from "../mock/catalog";
import { MOCK_DASHBOARD, PRODUCT_GROUPS } from "../mock/data";

export function DashboardPage() {
  const pending = MOCK_DASHBOARD.pendingReviewCount.toLocaleString("fa-IR");

  return (
    <section className="desk">
      <header className="page-head">
        <div>
          <p className="kicker">میز کار امروز</p>
          <h1>{MOCK_DASHBOARD.lastIngestAt.split(" — ")[0]}</h1>
        </div>
        <p className="page-head-note">کالاها از خروجی وب‌سایت‌اند · قیمت روزانه هنوز غایب است و صفر نیست</p>
      </header>

      <div className="desk-hero">
        <div className="desk-hero-copy">
          <p className="kicker">کار باقی‌مانده</p>
          <h2>
            {pending} مورد در صف بررسی است
          </h2>
          <p>
            قیمت مشکوک بدون تأیید انسان منتشر نمی‌شود. تطبیق‌نیافته‌ها محصول جدید نمی‌سازند.
          </p>
          <div className="btn-row">
            <Link className="btn primary" to="/review">
              باز کردن صف بررسی
            </Link>
            <Link className="btn" to="/settings/sources">
              تعریف منبع
            </Link>
          </div>
        </div>
        <dl className="desk-facts">
          <div>
            <dt>آخرین ورود</dt>
            <dd>{MOCK_DASHBOARD.lastIngestSource}</dd>
            <dd className="muted">{MOCK_DASHBOARD.lastIngestAt}</dd>
          </div>
          <div>
            <dt>انتشار خودکار</dt>
            <dd>خاموش</dd>
            <dd className="muted">فقط پس از تأیید انسان</dd>
          </div>
          <div>
            <dt>منابع فعال</dt>
            <dd>{MOCK_DASHBOARD.sourceCount.toLocaleString("fa-IR")} منبع نمایشی</dd>
            <dd className="muted">سایت، تلگرام، بله، فایل، ورود دستی</dd>
          </div>
        </dl>
      </div>

      <article className="category-strip">
        <div>
          <p className="kicker">منابع</p>
          <h2>همه دسته‌های کاتالوگ</h2>
          <p className="muted">لوله، تیرآهن، ورق و بقیه گروه‌ها منبع جدا دارند. کانال بله هم قابل تعریف است.</p>
        </div>
        <Link className="btn" to="/settings/sources">
          رفتن به منابع
        </Link>
      </article>

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
