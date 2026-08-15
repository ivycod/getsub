import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, formatApiErrorDetail } from "@/context/AuthContext";
import "@/styles/getsub.css";

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, name);
      navigate(next, { replace: true });
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-shell admin-login-shell" data-testid="auth-page">
      <form className="admin-login-card" data-testid="auth-form" onSubmit={submit}>
        <Link to="/"><img src="/getsub-logo.png" alt="getsub" className="logo-img" style={{ margin: "0 auto 18px" }} /></Link>
        <div className="auth-tabs" data-testid="auth-tabs">
          <button type="button" className={`auth-tab ${mode === "login" ? "active" : ""}`} data-testid="auth-tab-login" onClick={() => { setMode("login"); setError(""); }}>Sign in</button>
          <button type="button" className={`auth-tab ${mode === "register" ? "active" : ""}`} data-testid="auth-tab-register" onClick={() => { setMode("register"); setError(""); }}>Sign up</button>
        </div>
        {mode === "register" && (
          <input className="cred-input" data-testid="auth-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
        )}
        <input className="cred-input" data-testid="auth-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required />
        <input className="cred-input" data-testid="auth-password-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" minLength={6} required />
        {error && <p className="modal-error" data-testid="auth-error">{error}</p>}
        <button className="modal-cta" type="submit" data-testid="auth-submit" disabled={loading}>
          {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
        <div className="auth-divider" data-testid="auth-divider"><span>or</span></div>
        <button type="button" className="auth-google-btn" data-testid="auth-google-btn" onClick={() => loginWithGoogle(next)}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="#4285F4" d="M23.5 12.27c0-.82-.07-1.42-.22-2.04H12v3.86h6.55c-.13 1.08-.85 2.71-2.44 3.8l-.02.15 3.55 2.75.25.02c2.26-2.08 3.61-5.15 3.61-8.54z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.78-2.92c-1.01.7-2.37 1.19-4.15 1.19-3.18 0-5.88-2.09-6.84-4.99l-.14.01-3.68 2.84-.05.13C3.14 21.3 7.26 24 12 24z" />
            <path fill="#FBBC05" d="M5.16 14.38A7.15 7.15 0 0 1 4.75 12c0-.83.15-1.63.41-2.38L5.15 9.5 1.42 6.6l-.12.06A11.94 11.94 0 0 0 0 12c0 1.93.47 3.76 1.3 5.4z" />
            <path fill="#EA4335" d="M12 4.75c2.25 0 3.77.97 4.64 1.79l3.39-3.3C17.94 1.19 15.24 0 12 0 7.26 0 3.14 2.7 1.3 6.6l3.85 2.99C6.12 6.84 8.82 4.75 12 4.75z" />
          </svg>
          Continue with Google
        </button>
        <p className="auth-switch" data-testid="auth-switch">
          {mode === "login" ? (
            <>New here? <button type="button" onClick={() => setMode("register")}>Create an account</button></>
          ) : (
            <>Already have an account? <button type="button" onClick={() => setMode("login")}>Sign in</button></>
          )}
        </p>
      </form>
    </div>
  );
}
