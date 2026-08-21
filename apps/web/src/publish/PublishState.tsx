import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  findPublication,
  loadPublications,
  savePublications,
  upsertPublication,
  type PublicationRecord,
} from "./publishStore";

type PublishContextValue = {
  publications: PublicationRecord[];
  forItem: (queueItemId: string) => PublicationRecord | undefined;
  record: (item: PublicationRecord) => void;
};

const PublishContext = createContext<PublishContextValue | null>(null);

export function PublishStateProvider({ children }: { children: ReactNode }) {
  const [publications, setPublications] = useState<PublicationRecord[]>(() => loadPublications());

  const record = useCallback((item: PublicationRecord) => {
    setPublications((current) => {
      const next = upsertPublication(current, item);
      savePublications(next);
      return next;
    });
  }, []);

  const value = useMemo<PublishContextValue>(
    () => ({
      publications,
      forItem: (queueItemId) => findPublication(publications, queueItemId),
      record,
    }),
    [publications, record],
  );

  return <PublishContext.Provider value={value}>{children}</PublishContext.Provider>;
}

export function usePublishState(): PublishContextValue {
  const value = useContext(PublishContext);
  if (!value) throw new Error("PublishStateProvider is missing");
  return value;
}
