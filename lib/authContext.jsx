import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { api, tokenStore } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [status, setStatus] = useState("loading");
  const [bootError, setBootError] = useState(null);

  const boot = useCallback(async () => {
    const stored = tokenStore.get();
    if (!stored) {
      setStatus("ready");
      return;
    }
    setStatus("loading");
    setBootError(null);
    try {
      const data = await api("/auth/me");
      setToken(stored);
      setUser(data.user);
      setStatus("ready");
    } catch (err) {
      if (err.status === 401) {
        tokenStore.clear();
        setStatus("ready");
      } else {
        setBootError(err.message);
        setStatus("error");
      }
    }
  }, []);

  useEffect(() => {
    boot();
  }, [boot]);

  const applySession = useCallback((data) => {
    tokenStore.set(data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await api("/auth/login", { method: "POST", body: { username, password }, auth: false });
    applySession(data);
    return data.user;
  }, [applySession]);

  const register = useCallback(async (payload) => {
    const data = await api("/auth/register", { method: "POST", body: payload, auth: false });
    applySession(data);
    return data.user;
  }, [applySession]);

  const logout = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api("/auth/me");
      setUser(data.user);
      return data.user;
    } catch (err) {
      if (err.status === 401) logout();
      return null;
    }
  }, [logout]);

  const value = useMemo(
    () => ({ user, token, status, bootError, retry: boot, login, register, logout, refreshUser }),
    [user, token, status, bootError, boot, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useRequireAuth() {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (auth.status === "ready" && !auth.user) router.replace("/login");
  }, [auth.status, auth.user, router]);
  return auth;
}

export function useGuestOnly() {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (auth.status === "ready" && auth.user) router.replace("/home");
  }, [auth.status, auth.user, router]);
  return auth;
}
