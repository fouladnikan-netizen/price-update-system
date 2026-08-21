import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getJson, putJson } from "../persist/apiStore";
import {
  loadSources,
  patchSource,
  removeSource,
  saveSources,
  setSourceActive,
  upsertSource,
  validateSourceInput,
  type PriceSource,
  type SourceInput,
} from "./sourceStore";

type SourcePatch = Parameters<typeof patchSource>[2];

type SourceContextValue = {
  sources: PriceSource[];
  saveSource: (input: SourceInput, editingId?: string) => string | null;
  createSource: (
    input: SourceInput,
    options?: { allowIncomplete?: boolean },
  ) => { error: string } | { source: PriceSource };
  patch: (id: string, patch: SourcePatch) => void;
  setActive: (id: string, isActive: boolean) => void;
  remove: (id: string) => void;
};

const SourceContext = createContext<SourceContextValue | null>(null);

export function SourceStateProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState<PriceSource[]>(() => loadSources());

  const commit = useCallback((next: PriceSource[]) => {
    setSources(next);
    saveSources(next);
    void putJson("/api/sources", { sources: next });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const remote = await getJson<{ store?: string; sources?: PriceSource[] }>("/api/sources");
      if (cancelled || !remote) return;
      if (remote.store === "postgres" && Array.isArray(remote.sources) && remote.sources.length) {
        setSources(remote.sources);
        saveSources(remote.sources);
        return;
      }
      if (remote.store === "postgres" && Array.isArray(remote.sources) && remote.sources.length === 0) {
        const local = loadSources();
        if (local.length) void putJson("/api/sources", { sources: local });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<SourceContextValue>(
    () => ({
      sources,
      saveSource: (input, editingId) => {
        const error = validateSourceInput(input);
        if (error) return error;
        commit(upsertSource(sources, input, editingId));
        return null;
      },
      createSource: (input, options) => {
        const error = validateSourceInput(input, options);
        if (error) return { error };
        const next = upsertSource(sources, input);
        const source = next[0];
        if (!source) return { error: "منبع ساخته نشد." };
        commit(next);
        return { source };
      },
      patch: (id, patch) => commit(patchSource(sources, id, patch)),
      setActive: (id, isActive) => commit(setSourceActive(sources, id, isActive)),
      remove: (id) => commit(removeSource(sources, id)),
    }),
    [commit, sources],
  );

  return <SourceContext.Provider value={value}>{children}</SourceContext.Provider>;
}

export function useSourceState(): SourceContextValue {
  const value = useContext(SourceContext);
  if (!value) throw new Error("SourceStateProvider is missing");
  return value;
}
