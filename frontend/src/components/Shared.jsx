import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import Lenis from "lenis";
import { openCheckout } from "@/paddle";
import { DELIVERY_OPTIONS, money } from "@/data";
import { useAuth } from "@/context/AuthContext";

const API = process.env.REACT_APP_BACKEND_URL;

export const Mascot = ({ pose = "wave", className = "", size, eager = false, alt = "getsub mascot waving hello" }) => (
  <picture>
    <source srcSet={`/mascot/mascot-${pose}.webp`} type="image/webp" />
    <img
      src={`/mascot/mascot-${pose}.png`}
      alt={alt}
      className={`mascot ${className}`}
      width={size}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding={eager ? "sync" : "async"}
      draggable="false"
      data-testid={`mascot-${pose}`}
    />
  </picture>
);


export const useProducts = () =>
  useQuery({
    queryKey: ["products"],
    queryFn: async () => (await axios.get(`${API}/api/products`)).data,
  });

export const useLenis = () => {
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    let raf;
    const loop = (t) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); };
  }, []);
};

export const Reveal = ({ children, delay = 0, y = 24, className = "", ...rest }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    {...rest}
  >
    {children}
  </motion.div>
);

export const ServiceIcon = ({ service, color = "#0E6E56", size = 22 }) => {
  if (service === "youtube")
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <rect x="1" y="5" width="22" height="14" rx="4.2" fill="#FF0000" />
        <path d="M10 8.6v6.8l6-3.4z" fill="#fff" />
      </svg>
    );
  if (service === "spotify")
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#1DB954" />
        <path d="M6.5 9.6c3.4-1 8-.7 11.2 1.3" stroke="#fff" strokeWidth="1.7" fill="none" strokeLinecap="round" />
        <path d="M7 12.6c2.9-.8 6.4-.5 9 1.1" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M7.6 15.4c2.3-.6 4.8-.3 6.9 1" stroke="#fff" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      </svg>
    );
  return (
    <span
      className="generic-icon"
      style={{ width: size, height: size, background: color, fontSize: Math.max(10, size * 0.48) }}
      aria-hidden="true"
    >
      {(service || "?")[0].toUpperCase()}
    </span>
  );
};

export const productChip = (slug, color) => {
  if (slug === "youtube") return { className: "modal-service yt", style: {} };
  if (slug === "spotify") return { className: "modal-service sp", style: {} };
  return { className: "modal-service", style: { background: `${color}1f`, color } };
};

export const SiteHeader = ({ links }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const { data: products = [] } = useProducts();
  const { user } = useAuth();
  const navigate = useNavigate();
  const activeProducts = products.filter((p) => p.status === "active");
  const items = links || [{ href: "/#how", label: "How it works" }];
  const searchMatches = searchQuery.trim()
    ? activeProducts.filter((p) => p.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : activeProducts;
  const showSearchResults = searchFocused || searchQuery.trim().length > 0;
  const goToSearchResult = (slug) => { setSearchQuery(""); setSearchFocused(false); navigate(`/${slug}`); };
  const submitSearch = (e) => {
    e.preventDefault();
    if (searchMatches.length > 0) goToSearchResult(searchMatches[0].slug);
  };
  const renderLink = (l, onClick) =>
    l.href.startsWith("/") && !l.href.includes("#") ? (
      <Link key={l.label} to={l.href} onClick={onClick}>{l.label}</Link>
    ) : (
      <a key={l.label} href={l.href} onClick={onClick}>{l.label}</a>
    );
  return (
    <header>
      <div className="nav">
        <Link to="/" data-testid="nav-logo"><img src="/getsub-logo.png" alt="getsub" className="logo-img" /></Link>
        <nav className="nav-links">
          {items.map((l) => renderLink(l))}
        </nav>
        <div className="nav-right">
          <form className="nav-search" role="search" onSubmit={submitSearch} data-testid="nav-search-form">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-search-icon"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input
              type="text"
              className="nav-search-input"
              placeholder="Search products…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              data-testid="nav-search-input"
            />
            <AnimatePresence>
              {showSearchResults && (
                <motion.div className="nav-search-results" data-testid="nav-search-results" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.15 }}>
                  {searchMatches.length === 0 ? (
                    <p className="nav-search-empty" data-testid="nav-search-empty">No products found</p>
                  ) : searchMatches.map((p) => (
                    <button type="button" key={p.slug} className="nav-search-result-item" data-testid={`nav-search-result-${p.slug}`} onClick={() => goToSearchResult(p.slug)}>
                      <ServiceIcon service={p.slug} color={p.color} size={16} />
                      {p.name}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </form>
          <Link to={user ? "/account" : "/login?next=/account"} className="nav-account-link" data-testid="nav-subscription-link">My Subscription</Link>
          <span className="nav-lang-pill" data-testid="nav-lang-pill">EN <span className="nav-lang-sep">|</span> USD</span>
          <a href={items.find((l) => l.cta)?.href || "/#products"} className="nav-cta" data-testid="nav-get-started">Get started</a>
          <Link to={user ? "/account" : "/login"} className="nav-login-icon-btn" data-testid="nav-login-icon" aria-label="Account">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
          </Link>
        </div>
        <button className="menu-btn" data-testid="menu-toggle" aria-label="Open menu" onClick={() => setMobileOpen((v) => !v)}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {mobileOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>}
          </svg>
        </button>
      </div>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="mobile-menu" data-testid="mobile-menu" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
            <div className="mobile-menu-inner">
              <form className="nav-search mobile-nav-search" role="search" onSubmit={submitSearch} data-testid="mobile-nav-search-form">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-search-icon"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
                <input
                  type="text"
                  className="nav-search-input"
                  placeholder="Search products…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="mobile-nav-search-input"
                />
              </form>
              {items.map((l) => renderLink(l, () => setMobileOpen(false)))}
              {activeProducts.map((p) => (
                <Link key={p.slug} to={`/${p.slug}`} onClick={() => setMobileOpen(false)}>{p.name}</Link>
              ))}
              <Link to={user ? "/account" : "/login?next=/account"} data-testid="mobile-subscription-link" onClick={() => setMobileOpen(false)}>My Subscription</Link>
              <span className="nav-lang-pill" data-testid="mobile-nav-lang-pill">EN <span className="nav-lang-sep">|</span> USD</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export const SiteFooter = () => (
  <footer>
    <div className="wrap footer-row">
      <img src="/getsub-logo.png" alt="getsub" className="logo-img" style={{ height: 30 }} />
      <span className="tp-badge tp-footer" data-testid="footer-trustpilot" title="Trustpilot reviews coming soon">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="#00B67A" aria-hidden="true"><path d="M12 1.5 14.8 9h7.7l-6.2 4.7 2.4 7.8L12 16.7l-6.7 4.8 2.4-7.8L1.5 9h7.7z"/></svg>
        Review us on Trustpilot
      </span>
      <div className="footer-links">
        <Link to="/refunds" data-testid="footer-refunds">Refund policy</Link>
        <Link to="/terms" data-testid="footer-terms">Terms</Link>
        <Link to="/privacy" data-testid="footer-privacy">Privacy</Link>
        <Link to="/contact" data-testid="footer-contact">Contact</Link>
      </div>
      <p className="footer-copy">© 2026 getsub.shop</p>
    </div>
  </footer>
);

export const SavingsModal = ({ product, plan, months = 1, delivery = null, onChangeDelivery, onClose }) => {
  const navigate = useNavigate();
  const { user, loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!plan || !product) return null;

  const isShared = plan.shared;
  const qty = isShared ? months : 1;
  const price = plan.price * qty;
  const official = plan.official * qty;
  const savings = official - price;
  const pct = Math.round((savings / official) * 100);
  const billing = isShared ? `One-time · ${months} months of access` : plan.billing;
  const chip = productChip(product.slug, product.color);
  const deliveryMeta = !isShared && delivery ? DELIVERY_OPTIONS[delivery] : null;
  const nextPath = `${window.location.pathname}?plan=${plan.plan_id}`;

  const handleCheckout = async () => {
    setLoading(true);
    setError("");
    const res = await openCheckout(plan.plan_id, qty);
    if (res.ok) { setLoading(false); return; }
    try {
      const { data } = await axios.post(`${API}/api/orders`, {
        plan_id: plan.plan_id,
        delivery_type: isShared ? "shared" : delivery || "preplanned",
        months: isShared ? months : 1,
      }, { withCredentials: true });
      navigate(`/order/${data.access_token}`);
    } catch (e) {
      setError("Could not create your order. Please try again.");
    }
    setLoading(false);
  };

  return (
    <motion.div
      className="modal-overlay"
      data-testid="savings-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-card"
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-top">
          <span className={chip.className} style={chip.style}><ServiceIcon service={product.slug} color={product.color} size={16} />{product.name}</span>
          <button className="modal-close" onClick={onClose} data-testid="modal-close" aria-label="Close">×</button>
          <div className="modal-plan-title" data-testid="modal-plan-title">{product.name} · {plan.name}</div>
        </div>

        <div className="modal-hero">
          <div className="modal-you-pay-label">You pay</div>
          <div className="modal-price" data-testid="modal-price">
            {money(price)}<small>{isShared ? ` · ${months} mo` : plan.unit}</small>
          </div>
          <div className="modal-billing">{billing}</div>
        </div>

        <div className="modal-breakdown">
          <div className="breakdown-line">
            <span className="bl-label">Official price</span>
            <span className="bl-value bl-strike" data-testid="modal-official">{money(official)}{isShared ? "" : plan.unit}</span>
          </div>
          <div className="breakdown-line">
            <span className="bl-label">Your price with getsub</span>
            <span className="bl-value">{money(price)}{isShared ? "" : plan.unit}</span>
          </div>
          <div className="breakdown-line breakdown-save">
            <span className="bl-label">You save</span>
            <span className="bl-value" data-testid="modal-savings">{money(savings)} ({pct}%)</span>
          </div>
        </div>

        <div className="modal-savings-badge">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          That's {pct}% off the official price — same app, your own login
        </div>

        {deliveryMeta && (
          <div className="modal-delivery-line" data-testid="modal-delivery-line">
            <span>Delivery: <strong>{deliveryMeta.title}</strong></span>
            {onChangeDelivery && (
              <button className="modal-delivery-change" data-testid="modal-delivery-change" onClick={onChangeDelivery}>Change</button>
            )}
          </div>
        )}

        <div className="modal-actions">
          {user ? (
            <>
              <p className="modal-signed-in-as" data-testid="modal-signed-in-as">Signed in as <strong>{user.email}</strong></p>
              {error && <p className="modal-error" data-testid="modal-error">{error}</p>}
              <button className="modal-cta" data-testid="modal-checkout" onClick={handleCheckout} disabled={loading}>
                {loading ? "Creating your order…" : "Continue with this plan"}
              </button>
            </>
          ) : (
            <>
              <p className="modal-signed-in-as" data-testid="modal-login-required">Sign in to complete your purchase — your orders and chats are saved to your account.</p>
              <Link className="modal-cta" data-testid="modal-go-login" to={`/login?next=${encodeURIComponent(nextPath)}`} style={{ display: "block" }}>
                Sign in to continue
              </Link>
              <button type="button" className="modal-share" data-testid="modal-google-login" onClick={() => loginWithGoogle(nextPath)} style={{ marginTop: 8 }}>
                Continue with Google
              </button>
            </>
          )}
          <p className="modal-fineprint">One-time payment · secure Paddle checkout · same-day activation</p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export const DeliveryChoiceModal = ({ product, plan, onSelect, onClose }) => {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!plan || !product) return null;
  const chip = productChip(product.slug, product.color);
  const options = ["preplanned", "recharge"].filter((k) => (plan.delivery_types || []).includes(k));

  return (
    <motion.div
      className="modal-overlay"
      data-testid="delivery-choice-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-card choice-card"
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-top">
          <span className={chip.className} style={chip.style}><ServiceIcon service={product.slug} color={product.color} size={16} />{product.name}</span>
          <button className="modal-close" onClick={onClose} data-testid="choice-close" aria-label="Close">×</button>
          <div className="modal-plan-title">{product.name} · {plan.name} — how do you want it?</div>
          <p className="qv-brief">Same price either way ({money(plan.price)}{plan.unit}) — pick whichever suits you.</p>
        </div>

        <div className="choice-grid">
          {options.map((key) => {
            const opt = DELIVERY_OPTIONS[key];
            return (
              <div className="choice-box" key={key} data-testid={`choice-box-${key}`}>
                <span className="plan-delivery-tag">{opt.chip}</span>
                <h3 className="choice-title">{opt.title}</h3>
                <p className="choice-sub">{opt.sub}</p>
                {opt.videoUrl ? (
                  <video className="choice-video" src={opt.videoUrl} controls preload="metadata" />
                ) : (
                  <div className="choice-video-placeholder" data-testid={`choice-video-${key}`}>
                    <span className="choice-play">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    </span>
                    <span>Video guide — coming soon</span>
                  </div>
                )}
                <ol className="choice-steps">
                  {opt.steps.map((s, i) => (
                    <li key={i}><span className="choice-step-num">{i + 1}</span>{s}</li>
                  ))}
                </ol>
                <p className="choice-bestfor">{opt.bestFor}</p>
                <button className="modal-cta choice-select" data-testid={`choice-select-${key}`} onClick={() => onSelect(key)}>
                  Choose {opt.title.toLowerCase()}
                </button>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
};

export const PlanModalFlow = ({ product, plan, months = 1, onClose }) => {
  const isShared = plan.shared;
  const types = plan.delivery_types || [];
  const single = !isShared && types.length <= 1;
  const [delivery, setDelivery] = useState(isShared ? "shared" : single ? types[0] || "preplanned" : null);

  if (!isShared && !delivery) {
    return <DeliveryChoiceModal product={product} plan={plan} onSelect={setDelivery} onClose={onClose} />;
  }
  return (
    <SavingsModal
      product={product}
      plan={plan}
      months={months}
      delivery={isShared ? null : delivery}
      onChangeDelivery={isShared || single ? undefined : () => setDelivery(null)}
      onClose={onClose}
    />
  );
};
