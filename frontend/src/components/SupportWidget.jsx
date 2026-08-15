import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

const API = process.env.REACT_APP_BACKEND_URL;

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

const LiveChatPanel = () => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/api/tickets/mine/messages`, { withCredentials: true });
      setMessages(data);
    } catch { /* keep polling */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const send = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setSending(true);
    try {
      const { data } = await axios.post(`${API}/api/tickets/mine/messages`, { text: t }, { withCredentials: true });
      setMessages((m) => [...m, data]);
      setText("");
    } catch { /* keep text so buyer can retry */ }
    setSending(false);
  };

  return (
    <div className="chat-box support-chat-box" data-testid="support-chat-box">
      <div className="chat-messages">
        {messages.length === 0 && <p className="chat-empty">Send us a message and our team will reply here.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`chat-bubble ${m.sender === "buyer" ? "mine" : "theirs"}`} data-testid={`support-chat-message-${m.sender}`}>
            <span className="chat-sender">{m.sender === "buyer" ? "You" : "getsub support"}</span>
            {m.text}
            <span className="chat-time">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        ))}
      </div>
      <form className="chat-input-row" onSubmit={send}>
        <input className="chat-input" data-testid="support-chat-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" maxLength={2000} />
        <button className="chat-send" data-testid="support-chat-send" type="submit" disabled={!text.trim() || sending}>Send</button>
      </form>
    </div>
  );
};

export const SupportWidget = () => {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  if (user == null) return null;

  return (
    <>
      <button
        className="support-fab"
        data-testid="support-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label="Contact support"
      >
        {open ? <span className="support-fab-x">×</span> : <ChatIcon />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="support-panel"
            data-testid="support-panel"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="support-panel-head">
              <strong>Contact support</strong>
              <button className="support-panel-close" data-testid="support-panel-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </div>
            {user ? (
              <LiveChatPanel />
            ) : (
              <div className="support-signin-prompt" data-testid="support-signin-prompt">
                <p className="support-panel-sub">Sign in to start a live chat with our support team — your conversation is saved to your account.</p>
                <Link className="modal-cta" data-testid="support-signin-link" to={`/login?next=${encodeURIComponent(window.location.pathname)}`} onClick={() => setOpen(false)}>
                  Sign in to chat
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
