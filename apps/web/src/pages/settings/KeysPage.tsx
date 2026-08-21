import { useEffect, useState, type FormEvent } from "react";
import {
  WEEKDAYS,
  loadSchedule,
  saveSchedule,
  type UpdateSchedule,
} from "../../settings/scheduleStore";

type Health = {
  ok: boolean;
  configured: boolean;
  model: string;
  promptVersion: string;
  websiteConfigured?: boolean;
  telegramConfigured?: boolean;
  baleConfigured?: boolean;
  baleConnected?: boolean;
  baleBotUsername?: string;
  baleUserConfigured?: boolean;
  database?: { ok: boolean; configured?: boolean; database?: string; error?: string };
};

export function KeysPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<UpdateSchedule>(() => loadSchedule());
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then(async (res) => {
        if (!res.ok) throw new Error("سرویس در دسترس نیست.");
        return res.json() as Promise<Health>;
      })
      .then((next) => {
        if (cancelled) return;
        setHealth(next);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "اتصال به API برقرار نشد.");
      });
    fetch("/api/schedule")
      .then(async (res) => (res.ok ? ((await res.json()) as { schedule?: UpdateSchedule }) : null))
      .then((body) => {
        if (cancelled || !body?.schedule) return;
        setSchedule(body.schedule);
        saveSchedule(body.schedule);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleDay(id: number) {
    setSchedule((current) => ({
      ...current,
      days: current.days.includes(id) ? current.days.filter((day) => day !== id) : [...current.days, id],
    }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    saveSchedule(schedule);
    void fetch("/api/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedule }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("زمان‌بندی روی سرور ذخیره نشد.");
        setSaved("زمان‌بندی روی سرور ذخیره شد. حتی اگر مرورگر بسته باشد، در همان ساعت تهران اجرا می‌شود.");
      })
      .catch((err: unknown) => {
        setSaved(err instanceof Error ? err.message : "زمان‌بندی روی سرور ذخیره نشد.");
      });
  }

  return (
    <>
      {error ? <p className="settings-error">{error} کلیدها فقط روی سرور هستند و اینجا نشان داده نمی‌شوند.</p> : null}
      <div className="sheet table-wrap">
        <table className="price-table settings-table">
          <tbody>
            <tr>
              <th>کلید هوش مصنوعی</th>
              <td>
                {health ? (
                  <span className={`badge ${health.configured ? "success" : "warning"}`}>
                    {health.configured ? "روی سرور تنظیم شده" : "تنظیم نشده"}
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
            <tr>
              <th>مدل</th>
              <td>{health?.model ?? "—"}</td>
            </tr>
            <tr>
              <th>کلید وب‌سایت</th>
              <td>
                {health ? (
                  <span className={`badge ${health.websiteConfigured ? "success" : "warning"}`}>
                    {health.websiteConfigured ? "روی سرور است" : "تنظیم نشده — صف محلی"}
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
            <tr>
              <th>اکانت سازمانی تلگرام</th>
              <td>
                {health ? (
                  <span className={`badge ${health.telegramConfigured ? "success" : "warning"}`}>
                    {health.telegramConfigured
                      ? "نشست روی سرور است — فعلاً جمع‌آوری تلگرام متوقف است"
                      : "فعلاً متوقف — خطای تلگرام بعداً رفع می‌شود"}
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
            <tr>
              <th>بازوی سازمانی بله</th>
              <td>
                {health ? (
                  <span className={`badge ${health.baleConnected ? "success" : "warning"}`}>
                    {health.baleConnected
                      ? `وصل است${health.baleBotUsername ? ` — @${health.baleBotUsername}` : ""} — پیام‌های ارسالی به بازو خوانده می‌شود`
                      : health.baleConfigured
                        ? "توکن هست ولی اتصال برقرار نشد"
                        : "تنظیم نشده"}
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
            <tr>
              <th>اکانت کاربری بله</th>
              <td>
                {health ? (
                  <span className={`badge ${health.baleUserConfigured ? "success" : "warning"}`}>
                    {health.baleUserConfigured
                      ? "نشست روی سرور است — کانال‌های عضو خوانده می‌شوند"
                      : "تنظیم نشده — npm run bale:login"}
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
            <tr>
              <th>دیتابیس Postgres</th>
              <td>
                {health ? (
                  <span className={`badge ${health.database?.ok ? "success" : "warning"}`}>
                    {health.database?.ok
                      ? `وصل است${health.database.database ? ` — ${health.database.database}` : ""} — منابع، متن خام و قیمت روز`
                      : health.database?.configured
                        ? "تنظیم شده ولی وصل نشد"
                        : "تنظیم نشده"}
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
            <tr>
              <th>انتشار خودکار به وب‌سایت</th>
              <td>
                <span className="badge warning">خاموش</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted">
        کلیدها در فایل محلی سرور می‌مانند و از این صفحه کپی نمی‌شوند. منابع، متن خام، قیمت روز و زمان‌بندی در Postgres
        هستند. زمان‌بند روی سرور با ساعت تهران اجرا می‌شود؛ مرورگر لازم نیست باز باشد. انتشار به وب‌سایت خاموش است.
      </p>

      <form className="sheet settings-form" style={{ marginTop: 20 }} onSubmit={submit}>
        <p className="kicker">زمان‌بندی به‌روزرسانی</p>
        <label className="check-row">
          <input
            type="checkbox"
            checked={schedule.enabled}
            onChange={(event) => setSchedule((current) => ({ ...current, enabled: event.target.checked }))}
          />
            به‌روزرسانی خودکار در ساعت مشخص (روی سرور)
        </label>
        <label>
          ساعت
          <input
            type="time"
            value={schedule.time}
            onChange={(event) => setSchedule((current) => ({ ...current, time: event.target.value }))}
          />
        </label>
        <fieldset className="day-picks">
          <legend>روزها</legend>
          {WEEKDAYS.map((day) => (
            <label key={day.id} className="check-row">
              <input type="checkbox" checked={schedule.days.includes(day.id)} onChange={() => toggleDay(day.id)} />
              {day.label}
            </label>
          ))}
        </fieldset>
        {saved ? <p className="settings-banner">{saved}</p> : null}
        <div className="btn-row">
          <button className="btn primary" type="submit">
            ذخیره زمان‌بندی
          </button>
        </div>
      </form>
    </>
  );
}
