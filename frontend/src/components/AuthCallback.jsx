import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Mascot } from "@/components/Shared";

const API = process.env.REACT_APP_BACKEND_URL;

export const AuthCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    const sessionId = new URLSearchParams(location.hash.slice(1)).get("session_id");
    (async () => {
      if (sessionId) {
        try {
          const { data } = await axios.post(`${API}/api/auth/google/session`, { session_id: sessionId }, { withCredentials: true });
          setUser(data);
        } catch {
          setUser(false);
        }
      }
      navigate(location.pathname + location.search, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="order-loading" data-testid="auth-callback-loading">
      <Mascot pose="wave" className="mascot-idle-loading" alt="getsub mascot" />
      <p>Signing you in…</p>
    </div>
  );
};
