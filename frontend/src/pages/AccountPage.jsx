import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { ServiceIcon, SiteHeader, SiteFooter } from "@/components/Shared";
import { money } from "@/data";
import "@/styles/getsub.css";

const API = process.env.REACT_APP_BACKEND_URL;

export default function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (user === false) navigate("/login?next=/account", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;
    axios.get(`${API}/api/my/orders`, { withCredentials: true }).then(({ data }) => setOrders(data)).catch(() => {});
  }, [user]);

  if (!user) return null;

  return (
    <div className="legal-page">
      <SiteHeader links={[{ href: "/#how", label: "How it works" }]} />
      <div className="legal-hero">
        <div className="wrap">
          <span className="chapter">Account</span>
          <h1 className="legal-title">Hi, {user.name || user.email}</h1>
        </div>
      </div>
      <div className="legal-body wrap" data-testid="account-page">
        <div className="legal-card" style={{ marginBottom: 24 }}>
          <p style={{ marginBottom: 8 }}><strong>Email:</strong> {user.email}</p>
          <button className="modal-share" data-testid="account-logout" onClick={async () => { await logout(); navigate("/"); }} style={{ marginTop: 4 }}>Log out</button>
        </div>
        <h3>Your orders</h3>
        {orders.length === 0 ? (
          <p className="chat-empty" data-testid="account-no-orders">No orders yet — <Link to="/#products">browse plans</Link>.</p>
        ) : (
          <div className="admin-signups" style={{ padding: 0 }} data-testid="account-orders-list">
            {orders.map((o) => (
              <Link className="admin-signup-row" style={{ textDecoration: "none" }} to={`/order/${o.access_token}`} key={o.id} data-testid={`account-order-${o.id}`}>
                <ServiceIcon service={o.service} size={20} />
                <strong>{o.plan_name}</strong>
                <span>{money(o.price)}</span>
                <em>{new Date(o.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}</em>
              </Link>
            ))}
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
