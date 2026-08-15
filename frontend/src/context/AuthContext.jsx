import { createContext, useContext, useEffect, useState, useCallback } from "react";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;
const AuthContext = createContext(null);

let refreshInFlight = null;
async function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = axios.post(`${API}/api/auth/refresh`, {}, { withCredentials: true }).finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

// Retry once via /auth/refresh on 401 for any buyer-facing (non-admin, non-auth) request,
// so an expired 15-min access cookie doesn't drop an active session while the 7-day refresh cookie is still valid.
axios.interceptors.response.use(
  (res) => res,
  async (error) => {
    const cfg = error.config || {};
    const url = cfg.url || "";
    if (error.response?.status === 401 && !cfg._retried && !url.includes("/api/auth/") && !url.includes("/api/admin/")) {
      cfg._retried = true;
      try {
        await refreshAccessToken();
        return axios(cfg);
      } catch { /* refresh failed, fall through */ }
    }
    return Promise.reject(error);
  },
);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/api/auth/me`, { withCredentials: true });
      setUser(data);
    } catch (err) {
      if (err.response?.status === 401) {
        try {
          await refreshAccessToken();
          const { data } = await axios.get(`${API}/api/auth/me`, { withCredentials: true });
          setUser(data);
          return;
        } catch { /* refresh failed too — not logged in */ }
      }
      setUser(false);
    }
  }, []);

  useEffect(() => {
    // CRITICAL: If returning from the Google OAuth callback, skip this check —
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes("session_id=")) return;
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const { data } = await axios.post(`${API}/api/auth/login`, { email, password }, { withCredentials: true });
    setUser(data);
    return data;
  };

  const register = async (email, password, name) => {
    const { data } = await axios.post(`${API}/api/auth/register`, { email, password, name }, { withCredentials: true });
    setUser(data);
    return data;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/api/auth/logout`, {}, { withCredentials: true });
    } finally {
      setUser(false);
    }
  };

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const loginWithGoogle = (nextPath) => {
    const target = nextPath || (window.location.pathname + window.location.search);
    const redirectUrl = window.location.origin + target;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, register, logout, loginWithGoogle, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
