import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  loadSources,
  removeSource,
  saveSources,
  setSourceActive,
  upsertSource,
  validateSourceInput,
  type PriceSource,
  type SourceInput,
} from "./sourceStore";

type SourceContextValue = {
  sources: PriceSource[];
  saveSource: (input: SourceInput, editingId?: string) => string | null;
  setActive: (id: string, isActive: boolean) => void;
  remove: (id: string) => void;
};

const SourceContext = createContext<SourceContextValue | null>(null);

export function SourceStateProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState<PriceSource[]>(() => loadSources());

  const commit = useCallback((next: PriceSource[]) => {
    setSources(next);
    saveSources(next);
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
