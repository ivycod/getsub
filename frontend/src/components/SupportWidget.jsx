import { useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";

const API = process.env.REACT_APP_BACKEND_URL;

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

export const SupportWidget = () => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await axios.post(`${API}/api/support`, { email, message });
      setSent(true);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : Array.isArray(detail) ? detail[0]?.msg : "Something went wrong — try again.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setOpen(false);
    setTimeout(() => { setSent(false); setEmail(""); setMessage(""); setError(""); }, 300);
  };

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
              <button className="support-panel-close" data-testid="support-panel-close" onClick={reset} aria-label="Close">×</button>
            </div>
            {sent ? (
              <div className="support-sent" data-testid="support-sent">
                <p>Thanks — we got your message and will reply by email shortly.</p>
                <button className="modal-cta" onClick={reset} data-testid="support-sent-close">Close</button>
              </div>
            ) : (
              <form onSubmit={submit} className="support-form">
                <p className="support-panel-sub">Leave a message and we'll get back to you by email.</p>
                <input
                  type="email"
                  required
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="cred-input"
                  data-testid="support-email-input"
                />
                <textarea
                  required
                  placeholder="How can we help?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  className="cred-input support-textarea"
                  data-testid="support-message-input"
                />
                {error && <p className="modal-error" data-testid="support-error">{error}</p>}
                <button className="modal-cta" type="submit" disabled={loading} data-testid="support-submit">
                  {loading ? "Sending…" : "Send message"}
                </button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
