import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { SiteHeader, SiteFooter, ServiceIcon, productChip } from "@/components/Shared";
import { money } from "@/data";
import "@/styles/getsub.css";

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_LABELS = {
  awaiting_credentials: "Waiting for your account details",
  processing: "Processing",
  completed: "Completed",
};

const ChatBox = ({ fetchUrl, postUrl, me, headers = {} }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const countRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(fetchUrl, { headers });
      setMessages(data);
    } catch (e) { /* keep polling */ }
  }, [fetchUrl]);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (messages.length > countRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    countRef.current = messages.length;
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      const { data } = await axios.post(postUrl, { text: t }, { headers });
      setMessages((m) => [...m, data]);
      setText("");
    } catch (err) { /* leave text in box */ }
    setSending(false);
  };

  return (
    <div className="chat-box" data-testid="chat-box">
      <div className="chat-messages" data-testid="chat-messages">
        {messages.length === 0 && (
          <p className="chat-empty">No messages yet — say hello and we'll reply here.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-bubble ${m.sender === me ? "mine" : "theirs"}`} data-testid={`chat-message-${m.sender}`}>
            <span className="chat-sender">{m.sender === "admin" ? "getsub support" : "Buyer"}</span>
            {m.text}
            <span className="chat-time">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input-row" onSubmit={send}>
        <input
          className="chat-input"
          data-testid="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          maxLength={2000}
        />
        <button className="chat-send" data-testid="chat-send" type="submit" disabled={sending || !text.trim()}>Send</button>
      </form>
    </div>
  );
};

const CredentialsForm = ({ token, onDone }) => {
  const [gmail, setGmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!gmail.includes("@")) { setError("Enter a valid Gmail address."); return; }
    if (!password) { setError("Enter your account password."); return; }
    setSaving(true);
    setError("");
    try {
      await axios.post(`${API}/api/orders/${token}/credentials`, { gmail, account_password: password });
      onDone();
    } catch (err) {
      setError("Could not save your details. Please try again.");
    }
    setSaving(false);
  };

  return (
    <form className="cred-form" data-testid="credentials-form" onSubmit={submit}>
      <h3>Your account details</h3>
      <p className="cred-note">We need these to activate premium on <strong>your</strong> account. They're only visible to getsub support.</p>
      <label className="cred-label" htmlFor="cred-gmail">Gmail for the account</label>
      <input id="cred-gmail" className="cred-input" data-testid="credentials-gmail-input" type="email" value={gmail} onChange={(e) => setGmail(e.target.value)} placeholder="you@gmail.com" required />
      <label className="cred-label" htmlFor="cred-password">Account password</label>
      <input id="cred-password" className="cred-input" data-testid="credentials-password-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Account password" required />
      {error && <p className="modal-error" data-testid="credentials-error">{error}</p>}
      <button className="modal-cta" data-testid="credentials-submit" type="submit" disabled={saving}>
        {saving ? "Saving…" : "Submit & open live chat"}
      </button>
    </form>
  );
};

export default function OrderPage() {
  const { token } = useParams();
  const [order, setOrder] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/api/orders/${token}`);
      setOrder(data);
    } catch (e) {
      if (e.response?.status === 404) setNotFound(true);
    }
  }, [token]);

  useEffect(() => {
    window.scrollTo(0, 0);
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (notFound) {
    return (
      <>
        <SiteHeader />
        <div className="order-page wrap" data-testid="order-not-found">
          <h1 className="order-title">Order not found</h1>
          <p className="lead">This link doesn't match any order. Double-check the URL from your purchase.</p>
        </div>
        <SiteFooter />
      </>
    );
  }

  if (!order) {
    return (
      <>
        <SiteHeader />
        <div className="order-page wrap"><p className="lead">Loading your order…</p></div>
        <SiteFooter />
      </>
    );
  }

  const isRecharge = order.delivery_type === "recharge";
  const needsCreds = isRecharge && !order.credentials_submitted;
  const chip = productChip(order.service, order.product_color || "#0E6E56");
  const productName = order.plan_name.split(" · ")[0];

  return (
    <>
      <SiteHeader />
      <div className="order-page wrap" data-testid="order-page">
        <span className={chip.className} style={chip.style}>
          <ServiceIcon service={order.service} color={order.product_color || "#0E6E56"} size={16} />
          {productName}
        </span>
        <h1 className="order-title">Thanks — your order is in.</h1>

        <div className="order-summary" data-testid="order-summary">
          <div className="order-summary-row"><span>Plan</span><strong>{order.plan_name}{order.delivery_type === "shared" ? ` · ${order.months} months` : ""}</strong></div>
          <div className="order-summary-row"><span>Delivery</span><strong>{order.delivery_type === "preplanned" ? "Pre-planned account" : order.delivery_type === "recharge" ? "Recharge my account" : "Family invite"}</strong></div>
          <div className="order-summary-row"><span>Paid</span><strong>{money(order.price)}</strong></div>
          {order.buyer_email && <div className="order-summary-row"><span>Confirmation sent to</span><strong data-testid="order-buyer-email">{order.buyer_email}</strong></div>}
          <div className="order-summary-row"><span>Status</span><span className={`order-status-chip ${order.status}`} data-testid="order-status-chip">{STATUS_LABELS[order.status]}</span></div>
        </div>

        <div className="order-link-note">
          <p>This is your <strong>private order link</strong> — bookmark it to come back to this page anytime.</p>
          <button className="modal-share" data-testid="copy-order-link" onClick={copyLink}>{copied ? "✓ Link copied" : "Copy private link"}</button>
        </div>

        {order.delivery_type === "preplanned" && (
          <div className="order-info-card" data-testid="preplanned-info">
            <h3>What happens next</h3>
            <p>We're setting up a fresh account with your premium plan active. Full login credentials land in your inbox within <strong>10 minutes – 2 hours</strong>.</p>
          </div>
        )}

        {order.delivery_type === "shared" && (
          <div className="order-info-card" data-testid="shared-info">
            <h3>What happens next</h3>
            <p>Your family-plan invite link will be emailed within <strong>10 minutes – 2 hours</strong>. Accept it and premium activates on your own account.</p>
          </div>
        )}

        {needsCreds && <CredentialsForm token={token} onDone={load} />}

        {isRecharge && order.credentials_submitted && (
          <div className="order-chat-section">
            <h3 className="chat-heading">Live chat with getsub</h3>
            <p className="cred-note">Share the OTP / verification code here when we ask for it, and drop any questions — a real person replies.</p>
            <ChatBox
              fetchUrl={`${API}/api/orders/${token}/messages`}
              postUrl={`${API}/api/orders/${token}/messages`}
              me="buyer"
            />
          </div>
        )}
      </div>
      <SiteFooter />
    </>
  );
}
