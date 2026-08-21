const STORAGE_KEY = "price-update.source-identity.v1";

export type IdentityNotice = {
  id: string;
  sourceId: string;
  sourceName: string;
  officialName: string | null;
  officialUrl: string | null;
  note: string | null;
  confidence: number | null;
  lookupFailed: boolean;
  status: "pending" | "confirmed" | "dismissed";
  createdAt: string;
};

export type IdentityStore = {
  notices: IdentityNotice[];
  attemptedIds: string[];
};

const EMPTY: IdentityStore = { notices: [], attemptedIds: [] };

export function loadIdentityStore(): IdentityStore {
  try {
    if (typeof localStorage === "undefined") return { ...EMPTY, notices: [], attemptedIds: [] };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { notices: [], attemptedIds: [] };
    const parsed = JSON.parse(raw) as IdentityStore;
    return {
      notices: Array.isArray(parsed.notices) ? parsed.notices : [],
      attemptedIds: Array.isArray(parsed.attemptedIds) ? parsed.attemptedIds : [],
    };
  } catch {
    return { notices: [], attemptedIds: [] };
  }
}

export function saveIdentityStore(store: IdentityStore): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function pendingNotices(notices: IdentityNotice[]): IdentityNotice[] {
  return notices.filter((item) => item.status === "pending");
}

export function addAttemptedId(store: IdentityStore, sourceId: string): IdentityStore {
  if (store.attemptedIds.includes(sourceId)) return store;
  return { ...store, attemptedIds: [...store.attemptedIds, sourceId] };
}

export function upsertPendingNotice(store: IdentityStore, notice: IdentityNotice): IdentityStore {
  const notices = [
    notice,
    ...store.notices.filter((item) => !(item.sourceId === notice.sourceId && item.status === "pending")),
  ];
  return { ...store, notices };
}

export function setNoticeStatus(
  store: IdentityStore,
  id: string,
  status: "confirmed" | "dismissed",
): IdentityStore {
  return {
    ...store,
    notices: store.notices.map((item) => (item.id === id ? { ...item, status } : item)),
  };
}
