import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getProductCategory, getProductGroup } from "../mock/data";
import {
  addAttemptedId,
  loadIdentityStore,
  pendingNotices,
  saveIdentityStore,
  setNoticeStatus,
  upsertPendingNotice,
  type IdentityNotice,
  type IdentityStore,
} from "./identityStore";
import { needsIdentityEnrichment, sourceTypeLabel } from "./sourceStore";
import { useSourceState } from "./SourceState";

type IdentityContextValue = {
  pending: IdentityNotice[];
  confirm: (id: string) => void;
  dismiss: (id: string) => void;
};

const IdentityContext = createContext<IdentityContextValue | null>(null);

type IdentityPayload = {
  officialName?: string | null;
  officialUrl?: string | null;
  note?: string | null;
  confidence?: number;
};

export function IdentityStateProvider({ children }: { children: ReactNode }) {
  const { sources, patch } = useSourceState();
  const [store, setStore] = useState<IdentityStore>(() => loadIdentityStore());
  const inFlight = useRef(new Set<string>());

  const commit = useCallback((next: IdentityStore) => {
    setStore(next);
    saveIdentityStore(next);
  }, []);

  useEffect(() => {
    const due = sources.filter(
      (source) =>
        needsIdentityEnrichment(source) &&
        !store.attemptedIds.includes(source.id) &&
        !inFlight.current.has(source.id),
    );
    if (!due.length) return;
    let next = store;
    for (const source of due) {
      inFlight.current.add(source.id);
      next = addAttemptedId(next, source.id);
    }
    commit(next);

    for (const source of due) {
      const groupLabel = getProductGroup(source.groupCode)?.nameFa ?? source.groupCode;
      const categoryLabel = getProductCategory(source.groupCode, source.categoryCode)?.nameFa ?? source.categoryCode;
      void (async () => {
        let payload: IdentityPayload = {};
        let lookupFailed = false;
        try {
          const response = await fetch("/api/source-identity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: source.name,
              groupLabel,
              categoryLabel,
              sourceType: sourceTypeLabel(source.sourceType),
            }),
          });
          payload = (await response.json()) as IdentityPayload;
          if (!response.ok) lookupFailed = true;
        } catch {
          lookupFailed = true;
        }
        const officialName = lookupFailed ? null : (payload.officialName ?? null);
        const officialUrl = lookupFailed ? null : (payload.officialUrl ?? null);
        const hasSuggestion = Boolean(officialName || officialUrl);
        if (hasSuggestion) {
          patch(source.id, { identityStatus: "suggested" });
        }
        commit(
          upsertPendingNotice(addAttemptedId(loadIdentityStore(), source.id), {
            id: crypto.randomUUID(),
            sourceId: source.id,
            sourceName: source.name,
            officialName,
            officialUrl,
            note: lookupFailed
              ? "شناسایی هویت رسمی انجام نشد. منبع را در تنظیمات کامل کنید."
              : (payload.note ?? null),
            confidence: typeof payload.confidence === "number" ? payload.confidence : null,
            lookupFailed: lookupFailed || !hasSuggestion,
            status: "pending",
            createdAt: new Date().toISOString(),
          }),
        );
        inFlight.current.delete(source.id);
      })();
    }
  }, [commit, patch, sources, store]);

  const pending = useMemo(() => pendingNotices(store.notices), [store.notices]);

  const value = useMemo<IdentityContextValue>(
    () => ({
      pending,
      confirm: (id) => {
        const notice = store.notices.find((item) => item.id === id);
        if (!notice || notice.lookupFailed || !(notice.officialName || notice.officialUrl)) return;
        const source = sources.find((item) => item.id === notice.sourceId);
        if (!source) return;
        patch(source.id, {
          officialName: notice.officialName,
          officialUrl: notice.officialUrl,
          address: source.address.trim() || notice.officialUrl || source.address,
          identityStatus: "confirmed",
        });
        commit(setNoticeStatus(store, id, "confirmed"));
      },
      dismiss: (id) => commit(setNoticeStatus(store, id, "dismissed")),
    }),
    [commit, patch, pending, sources, store],
  );

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

export function useIdentityState(): IdentityContextValue {
  const value = useContext(IdentityContext);
  if (!value) throw new Error("IdentityStateProvider is missing");
  return value;
}

export function IdentityNoticeBar() {
  const { pending, confirm, dismiss } = useIdentityState();
  const notice = pending[0];
  if (!notice) return null;
  const canConfirm = !notice.lookupFailed && Boolean(notice.officialName || notice.officialUrl);
  const extra = pending.length > 1 ? ` · ${pending.length.toLocaleString("fa-IR")} مورد در انتظار` : "";

  return (
    <div className="identity-notice" role="status">
      <div>
        <p className="kicker">هویت منبع</p>
        <p>
          {canConfirm
            ? `برای منبع «${notice.sourceName}» هویت رسمی پیشنهاد شد. با تأیید، در فهرست منابع نوشته می‌شود.`
            : `منبع «${notice.sourceName}» فقط نام و دسته دارد. هویت رسمی هنوز تأیید نشده.`}
          {extra}
        </p>
        {canConfirm ? (
          <p className="muted">
            {notice.officialName ?? "بدون نام رسمی"}
            {notice.officialUrl ? ` · ${notice.officialUrl}` : ""}
          </p>
        ) : null}
        {notice.note ? <p className="muted">{notice.note}</p> : null}
      </div>
      <div className="btn-row">
        {canConfirm ? (
          <button className="btn primary slim" type="button" onClick={() => confirm(notice.id)}>
            تأیید
          </button>
        ) : null}
        <button className="btn ghost slim" type="button" onClick={() => dismiss(notice.id)}>
          نادیده
        </button>
      </div>
    </div>
  );
}
