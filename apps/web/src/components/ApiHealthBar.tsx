import { useEffect, useState } from "react";
import { COLLECT_UNAVAILABLE_ERROR, pingCollectApi } from "../intake/priceUpdate";

export function useApiHealth(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const healthy = await pingCollectApi();
      if (!cancelled) setOk(healthy);
    }
    void tick();
    const timer = window.setInterval(() => void tick(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return ok;
}

export function ApiHealthBar({ ok }: { ok: boolean | null }) {
  if (ok !== false) return null;
  return (
    <div className="api-notice" role="alert">
      <div>
        <p className="kicker">پشت‌صحنه</p>
        <p>{COLLECT_UNAVAILABLE_ERROR}</p>
        <p className="muted">صفحه در مرورگر باز است، ولی برنامهٔ دریافت خاموش است. اول آن را روشن کنید، بعد به‌روزرسانی را بزنید.</p>
      </div>
    </div>
  );
}
