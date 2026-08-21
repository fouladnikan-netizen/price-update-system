import { useEffect, useState } from "react";

type Health = {
  ok: boolean;
  configured: boolean;
  model: string;
  promptVersion: string;
  autoPublish: boolean;
  websiteConfigured?: boolean;
};

type PromptInfo = {
  active: string;
  prompts: Array<{ id: string; purpose: string; canPublish: boolean }>;
};

export function AiSettingsPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [prompts, setPrompts] = useState<PromptInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/health").then(async (res) => {
        if (!res.ok) throw new Error("سرویس استخراج در دسترس نیست.");
        return res.json() as Promise<Health>;
      }),
      fetch("/api/prompts").then(async (res) => {
        if (!res.ok) throw new Error("فهرست پرامپت خوانده نشد.");
        return res.json() as Promise<PromptInfo>;
      }),
    ])
      .then(([nextHealth, nextPrompts]) => {
        if (cancelled) return;
        setHealth(nextHealth);
        setPrompts(nextPrompts);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "اتصال به API برقرار نشد.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {error ? <p className="settings-error">{error} سرویس API را جدا اجرا کنید؛ کلید در مرورگر نیست.</p> : null}
      <div className="sheet table-wrap">
        <table className="price-table settings-table">
          <tbody>
            <tr>
              <th>وضعیت کلید</th>
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
              <th>پرامپت فعال</th>
              <td>{health?.promptVersion ?? "—"}</td>
            </tr>
            <tr>
              <th>انتشار خودکار</th>
              <td>
                <span className="badge warning">خاموش</span>
              </td>
            </tr>
            <tr>
              <th>API وب‌سایت</th>
              <td>
                {health ? (
                  <span className={`badge ${health.websiteConfigured ? "success" : "warning"}`}>
                    {health.websiteConfigured ? "کلید روی سرور است" : "تنظیم نشده — صف محلی"}
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted">
        کلید API فقط در فایل محلی سرور است و در این صفحه نشان داده نمی‌شود. خروجی مدل بدون اعتبارسنجی schema منتشر
        نمی‌شود.
      </p>
      {prompts?.prompts.length ? (
        <div className="sheet table-wrap" style={{ marginTop: 16 }}>
          <table className="price-table settings-table">
            <thead>
              <tr>
                <th>نسخه پرامپت</th>
                <th>کاربرد</th>
                <th>انتشار</th>
              </tr>
            </thead>
            <tbody>
              {prompts.prompts.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.id}</strong>
                    {item.id === prompts.active ? <div className="muted">فعال</div> : null}
                  </td>
                  <td>{item.purpose}</td>
                  <td>ممنوع</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
