import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { ServiceIcon } from "@/components/Shared";
import { AdminProducts, AdminSignups, AdminSupport } from "@/pages/AdminProducts";
import { money } from "@/data";
import "@/styles/getsub.css";

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_OPTIONS = [
  ["awaiting_credentials", "Awaiting credentials"],
  ["processing", "Processing"],
  ["completed", "Completed"],
];

const AdminChat = ({ orderId, headers }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/api/admin/orders/${orderId}/messages`, { headers });
      setMessages(data);
    } catch (e) { /* keep polling */ }
  }, [orderId]);

  useEffect(() => {
    setMessages([]);
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const send = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    try {
      const { data } = await axios.post(`${API}/api/admin/orders/${orderId}/messages`, { text: t }, { headers });
      setMessages((m) => [...m, data]);
      setText("");
    } catch (err) { /* keep text so admin can retry */ }
  };

  return (
    <div className="chat-box admin-chat" data-testid="admin-chat-box">
      <div className="chat-messages">
        {messages.length === 0 && <p className="chat-empty">No messages yet.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`chat-bubble ${m.sender === "admin" ? "mine" : "theirs"}`} data-testid={`admin-chat-message-${m.sender}`}>
            <span className="chat-sender">{m.sender === "admin" ? "You" : "Buyer"}</span>
            {m.text}
            <span className="chat-time">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        ))}
      </div>
      <form className="chat-input-row" onSubmit={send}>
        <input className="chat-input" data-testid="admin-chat-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply to the buyer…" maxLength={2000} />
        <button className="chat-send" data-testid="admin-chat-send" type="submit" disabled={!text.trim()}>Send</button>
      </form>
    </div>
  );
};

export default function AdminPage() {
  const [token, setToken] = useState(() => localStorage.getItem("getsub_admin_token") || "");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("orders");

  const headers = { Authorization: `Bearer ${token}` };

  const logout = useCallback(() => {
    localStorage.removeItem("getsub_admin_token");
    setToken("");
    setOrders([]);
    setSelected(null);
  }, []);

  const loadOrders = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(`${API}/api/admin/orders`, { headers: { Authorization: `Bearer ${token}` } });
      setOrders(data);
      setSelected((s) => (s ? data.find((o) => o.id === s.id) || s : s));
    } catch (e) {
      if (e.response?.status === 401) logout();
    }
  }, [token, logout]);

  useEffect(() => {
    loadOrders();
    const t = setInterval(loadOrders, 10000);
    return () => clearInterval(t);
  }, [loadOrders]);

  const login = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const { data } = await axios.post(`${API}/api/admin/login`, { password });
      localStorage.setItem("getsub_admin_token", data.token);
      setToken(data.token);
      setPassword("");
    } catch (err) {
      const d = err.response?.data?.detail;
      setLoginError(typeof d === "string" ? d : "Login failed");
    }
  };

  const setStatus = async (status) => {
    await axios.patch(`${API}/api/admin/orders/${selected.id}`, { status }, { headers });
    loadOrders();
  };

  if (!token) {
    return (
      <div className="admin-shell admin-login-shell">
        <form className="admin-login-card" data-testid="admin-login-form" onSubmit={login}>
          <img src="/getsub-logo.png" alt="getsub" className="logo-img" style={{ margin: "0 auto 18px" }} />
          <h2>Admin login</h2>
          <input className="cred-input" data-testid="admin-login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Admin password" required />
          {loginError && <p className="modal-error" data-testid="admin-login-error">{loginError}</p>}
          <button className="modal-cta" data-testid="admin-login-submit" type="submit">Sign in</button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-shell" data-testid="admin-dashboard">
      <div className="admin-topbar">
        <img src="/getsub-logo.png" alt="getsub" className="logo-img" style={{ height: 28 }} />
        <div className="admin-tabs">
          {[["orders", "Orders"], ["products", "Products"], ["signups", "Notify signups"], ["support", "Support"]].map(([v, l]) => (
            <button key={v} className={`admin-tab ${tab === v ? "active" : ""}`} data-testid={`admin-tab-${v}`} onClick={() => setTab(v)}>{l}</button>
          ))}
        </div>
        <button className="modal-share admin-logout" data-testid="admin-logout" onClick={logout}>Log out</button>
      </div>
      {tab === "products" && <AdminProducts headers={headers} onAuthFail={logout} />}
      {tab === "signups" && <AdminSignups headers={headers} onAuthFail={logout} />}
      {tab === "support" && <AdminSupport headers={headers} onAuthFail={logout} />}
      {tab === "orders" && (
      <div className="admin-grid">
        <div className="admin-orders" data-testid="admin-orders-list">
          {orders.length === 0 && <p className="chat-empty" style={{ padding: 20 }}>No orders yet.</p>}
          {orders.map((o) => (
            <button
              key={o.id}
              className={`admin-order-row ${selected?.id === o.id ? "active" : ""}`}
              data-testid={`admin-order-row-${o.id}`}
              onClick={() => setSelected(o)}
            >
              <ServiceIcon service={o.service} size={20} />
              <span className="admin-order-main">
                <strong>{o.plan_name}</strong>
                <em>{o.delivery_type === "preplanned" ? "Pre-planned" : o.delivery_type === "recharge" ? "Recharge" : "Shared"} · {money(o.price)} · {new Date(o.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</em>
              </span>
              <span className={`order-status-chip ${o.status}`}>{o.status.replace("_", " ")}</span>
              {o.last_message_sender === "buyer" && <span className="admin-unread-dot" title="Buyer sent the last message" />}
            </button>
          ))}
        </div>
        <div className="admin-detail">
          {!selected ? (
            <p className="chat-empty" style={{ padding: 32 }}>Select an order to see details and chat.</p>
          ) : (
            <>
              <div className="order-summary" data-testid="admin-order-detail">
                <div className="order-summary-row"><span>Plan</span><strong>{selected.plan_name}{selected.delivery_type === "shared" ? ` · ${selected.months} months` : ""}</strong></div>
                <div className="order-summary-row"><span>Delivery</span><strong>{selected.delivery_type}</strong></div>
                <div className="order-summary-row"><span>Paid</span><strong>{money(selected.price)} <em style={{ color: "var(--muted)", fontStyle: "normal", fontWeight: 500 }}>(payment simulated)</em></strong></div>
                {selected.buyer_email && <div className="order-summary-row"><span>Buyer email</span><strong data-testid="admin-buyer-email">{selected.buyer_email}</strong></div>}
                {selected.delivery_type === "recharge" && (
                  <>
                    <div className="order-summary-row"><span>Buyer Gmail</span><strong data-testid="admin-order-gmail">{selected.gmail || "Not submitted yet"}</strong></div>
                    <div className="order-summary-row"><span>Password</span><strong data-testid="admin-order-password">{selected.account_password || "—"}</strong></div>
                  </>
                )}
                <div className="order-summary-row">
                  <span>Status</span>
                  <select className="admin-status-select" data-testid="admin-status-select" value={selected.status} onChange={(e) => setStatus(e.target.value)}>
                    {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              {selected.delivery_type === "recharge" ? (
                <AdminChat orderId={selected.id} headers={headers} />
              ) : (
                <p className="cred-note" style={{ marginTop: 16 }}>No chat for this delivery type — fulfil by email.</p>
              )}
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
