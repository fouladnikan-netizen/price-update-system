import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ObservationStatus } from "../mock/data";
import { debouncePersist, getJson, putJson } from "../persist/apiStore";
import { addIntake, loadIntakes, saveIntakes, type IntakeRecord } from "./rawStore";
import {
  buildQueueItems,
  clearDecisions,
  loadDecisions,
  openQueueCount,
  saveDecisions,
  type QueueItem,
  type ReviewDecisions,
} from "./queueStore";

type IntakeContextValue = {
  intakes: IntakeRecord[];
  items: QueueItem[];
  openCount: number;
  recordIntake: (record: IntakeRecord) => void;
  patchIntake: (id: string, patch: Partial<IntakeRecord>) => void;
  assignLane: (itemId: string, lane: "factory" | "warehouse") => void;
  decide: (id: string, status: ObservationStatus) => void;
  clearQueue: () => void;
};

const IntakeContext = createContext<IntakeContextValue | null>(null);

export function IntakeStateProvider({ children }: { children: ReactNode }) {
  const [intakes, setIntakes] = useState<IntakeRecord[]>(() => loadIntakes());
  const [decisions, setDecisions] = useState<ReviewDecisions>(() => loadDecisions());
  const intakesRef = useRef(intakes);
  intakesRef.current = intakes;
  const persist = useRef(
    debouncePersist(() => {
      void putJson("/api/intakes", { intakes: intakesRef.current });
    }, 500),
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const remote = await getJson<{ store?: string; intakes?: IntakeRecord[] }>("/api/intakes");
      if (cancelled || !remote) return;
      if (remote.store === "postgres" && Array.isArray(remote.intakes) && remote.intakes.length) {
        setIntakes(remote.intakes);
        saveIntakes(remote.intakes);
        return;
      }
      if (remote.store === "postgres" && Array.isArray(remote.intakes) && remote.intakes.length === 0) {
        const local = loadIntakes();
        if (local.length) void putJson("/api/intakes", { intakes: local });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => buildQueueItems(intakes, decisions), [decisions, intakes]);
  const openCount = useMemo(() => openQueueCount(items), [items]);

  const recordIntake = useCallback((record: IntakeRecord) => {
    setIntakes((current) => {
      const next = addIntake(current, record);
      saveIntakes(next);
      persist.current();
      return next;
    });
  }, []);

  const patchIntake = useCallback((id: string, patch: Partial<IntakeRecord>) => {
    setIntakes((current) => {
      const next = current.map((item) => (item.id === id ? { ...item, ...patch } : item));
      saveIntakes(next);
      persist.current();
      return next;
    });
  }, []);

  const assignLane = useCallback((itemId: string, lane: "factory" | "warehouse") => {
    const split = itemId.lastIndexOf(":");
    if (split <= 0) return;
    const intakeId = itemId.slice(0, split);
    const index = Number(itemId.slice(split + 1));
    if (!Number.isInteger(index)) return;
    setIntakes((current) => {
      const next = current.map((intake) => {
        if (intake.id !== intakeId || !intake.result || typeof intake.result !== "object") return intake;
        const result = intake.result as { observations?: Array<Record<string, unknown>> };
        if (!Array.isArray(result.observations) || !result.observations[index]) return intake;
        const observations = result.observations.map((obs, obsIndex) => {
          if (obsIndex !== index) return obs;
          const factory = typeof obs.factoryPrice === "number" ? obs.factoryPrice : null;
          const warehouse = typeof obs.warehousePrice === "number" ? obs.warehousePrice : null;
          const amount = factory ?? warehouse;
          return lane === "factory"
            ? { ...obs, factoryPrice: amount, warehousePrice: null }
            : { ...obs, factoryPrice: null, warehousePrice: amount };
        });
        return { ...intake, result: { ...result, observations } };
      });
      saveIntakes(next);
      persist.current();
      return next;
    });
  }, []);

  const decide = useCallback((id: string, status: ObservationStatus) => {
    setDecisions((current) => {
      const next = { ...current, [id]: status };
      saveDecisions(next);
      return next;
    });
  }, []);

  const clearQueue = useCallback(() => {
    clearDecisions();
    setIntakes([]);
    setDecisions({});
    saveIntakes([]);
    void putJson("/api/intakes", { intakes: [] });
  }, []);

  const value = useMemo<IntakeContextValue>(
    () => ({ intakes, items, openCount, recordIntake, patchIntake, assignLane, decide, clearQueue }),
    [assignLane, clearQueue, decide, intakes, items, openCount, patchIntake, recordIntake],
  );

  return <IntakeContext.Provider value={value}>{children}</IntakeContext.Provider>;
}

export function useIntakeState(): IntakeContextValue {
  const value = useContext(IntakeContext);
  if (!value) throw new Error("IntakeStateProvider is missing");
  return value;
}
