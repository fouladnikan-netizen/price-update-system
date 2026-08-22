import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type AuthState = {
  ready: boolean;
  authenticated: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function readMe(): Promise<{ authenticated: boolean; username: string | null }> {
  const response = await fetch("/api/auth/me", { credentials: "same-origin" });
  if (!response.ok) return { authenticated: false, username: null };
  const body = (await response.json()) as { authenticated?: boolean; username?: string | null };
  return {
    authenticated: Boolean(body.authenticated),
    username: body.username ?? null,
  };
}

export function AuthStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readMe()
      .then((next) => {
        if (cancelled) return;
        setAuthenticated(next.authenticated);
        setUsername(next.username);
      })
      .catch(() => {
        if (cancelled) return;
        setAuthenticated(false);
        setUsername(null);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      authenticated,
      username,
      login: async (name, password) => {
        const response = await fetch("/api/login", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: name, password }),
        });
        const body = (await response.json().catch(() => ({}))) as { error?: string; username?: string };
        if (!response.ok) return body.error ?? "ورود انجام نشد.";
        setAuthenticated(true);
        setUsername(body.username ?? name);
        return null;
      },
      logout: async () => {
        await fetch("/api/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
        setAuthenticated(false);
        setUsername(null);
      },
    }),
    [ready, authenticated, username],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthStateProvider missing");
  return value;
}
