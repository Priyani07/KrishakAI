/* Krishak Phase 4 — client auth state only. Opaque session tokens come from the backend. */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getProfile, logIn, logOut, signUp } from "../services/phase4Services.js";

const AuthContext = createContext(null);
const tokenKey = "krishak.community.token";
const userKey = "krishak.community.user";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => window.localStorage.getItem(tokenKey) || "");
  const [user, setUser] = useState(() => { try { return JSON.parse(window.localStorage.getItem(userKey) || "null"); } catch { return null; } });
  const [authStatus, setAuthStatus] = useState("idle");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!token) { setAuthStatus("idle"); return; }
    let active = true;
    setAuthStatus("loading");
    getProfile(token).then((profile) => {
      if (!active) return;
      const nextUser = profile.user || profile;
      setUser(nextUser);
      window.localStorage.setItem(userKey, JSON.stringify(nextUser));
      setAuthStatus("ready");
    }).catch(() => {
      if (!active) return;
      window.localStorage.removeItem(tokenKey);
      window.localStorage.removeItem(userKey);
      setToken(""); setUser(null); setAuthStatus("idle");
    });
    return () => { active = false; };
  }, [token]);
  const save = (payload) => { const nextToken = payload.token || payload.accessToken || ""; const nextUser = payload.user || payload.profile || null; if (!nextToken) throw new Error("The authentication service did not return a session token."); setToken(nextToken); setUser(nextUser); window.localStorage.setItem(tokenKey, nextToken); if (nextUser) window.localStorage.setItem(userKey, JSON.stringify(nextUser)); setAuthStatus("ready"); };
  const login = async (credentials) => { setAuthStatus("loading"); setAuthError(""); try { const payload = await logIn(credentials); save(payload); return payload; } catch (error) { setAuthStatus("error"); setAuthError(error.message); throw error; } };
  const signup = async (details) => { setAuthStatus("loading"); setAuthError(""); try { const payload = await signUp(details); save(payload); return payload; } catch (error) { setAuthStatus("error"); setAuthError(error.message); throw error; } };
  const logout = async () => {
    const currentToken = token;
    try { if (currentToken) await logOut(currentToken); } catch { /* local cleanup still prevents stale client state */ }
    setToken(""); setUser(null); setAuthStatus("idle");
    window.localStorage.removeItem(tokenKey); window.localStorage.removeItem(userKey);
  };
  const value = useMemo(() => ({ token, user, authStatus, authError, isAuthenticated: Boolean(token && user), login, signup, logout }), [token, user, authStatus, authError]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
