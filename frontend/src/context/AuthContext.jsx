import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setToken, getToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      // Demo mode: no credentials needed. The backend issues an admin
      // token only while DEMO_AUTH_ENABLED (dev), so this stays a demo helper.
      try {
        const data = await api("/auth/demologin", { method: "POST" });
        setToken(data.token);
        setUser(data.user);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
      return;
    }
    try {
      const data = await api("/auth/me");
      setUser(data.user);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const value = useMemo(
    () => ({ user, loading, refreshUser }),
    [user, loading, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}