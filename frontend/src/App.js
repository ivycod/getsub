import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { Reveal, ServiceIcon, SiteHeader, SiteFooter, PlanModalFlow, useLenis, useProducts, Mascot } from "@/components/Shared";
import { QuickViewModal } from "@/components/QuickViewModal";
import { money } from "@/data";
import "@/styles/getsub.css";

const API = process.env.REACT_APP_BACKEND_URL;

const ROTATE_WORDS = ["YouTube", "Netflix", "Prime Video", "Grammarly", "chat GPT", "Canva"];

const RotatingWord = () => {
  const reduced = useReducedMotion();
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const interval = window.matchMedia("(max-width: 640px)").matches ? 2500 : 2000;
    const t = setInterval(() => setIdx((i) => (i + 1) % ROTATE_WORDS.length), interval);
    return () => clearInterval(t);
  }, [reduced]);
  if (reduced) return <span className="rotate-word-wrap"><span className="rotate-word">YouTube.</span></span>;
  return (
    <span className="rotate-word-wrap" data-testid="hero-rotating-word">
      <AnimatePresence mode="wait">
        <motion.span
          key={idx}
          className="rotate-word"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {ROTATE_WORDS[idx]}.
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

const PayRow = ({ dark }) => (
  <div className={`pay-row ${dark ? "pay-row-dark" : ""}`} data-testid={dark ? "footer-payment-trust" : "payment-trust-row"}>
    <span className="pay-lock">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
      Secure checkout
    </span>
    <span className="pay-chip pay-visa">VISA</span>
    <span className="pay-chip pay-mc" aria-label="Mastercard"><i className="mc-c mc-r" /><i className="mc-c mc-y" /></span>
    <span className="pay-chip pay-pp">Pay<em>Pal</em></span>
    <span className="pay-chip">G Pay</span>
    <span className="pay-chip">Apple Pay</span>
  </div>
);

const Hero = ({ heroTab, setHeroTab, heroPrice }) => {
  const { scrollY } = useScroll();
  const cardY = useTransform(scrollY, [0, 400], [0, -40]);
  return (
    <section className="hero">
      <div className="wrap hero-grid">
        <div>
          <motion.span className="eyebrow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            Individual and family plans, real prices
          </motion.span>
          <h1>
            {[
              <>Same Spotify.</>,
              <>Same <RotatingWord /></>,
              <>Half the price.</>,
            ].map((line, i) => (
              <span className="line-mask" key={i}>
                <motion.span style={{ display: "block" }} initial={{ y: "110%" }} animate={{ y: 0 }} transition={{ duration: 0.7, delay: 0.15 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}>
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p className="lead" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.6 }}>
            Get Spotify and YouTube Premium for less — an individual seat if it's just you, a family-size plan if you need more. Same login, same official app either way.
          </motion.p>
          <motion.div className="hero-proof" data-testid="hero-proof" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.68 }}>
            <div className="proof-avatars" aria-hidden="true">
              {["JM", "AK", "RS"].map((n, i) => (
                <span className={`proof-avatar av-${i}`} key={n}>{n}</span>
              ))}
            </div>
            <span className="proof-rating"><span className="proof-stars">★★★★★</span> 4.8 from 241+ subscribers</span>
            <span className="tp-badge" data-testid="trustpilot-badge" title="Trustpilot reviews coming soon">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="#00B67A" aria-hidden="true"><path d="M12 1.5 14.8 9h7.7l-6.2 4.7 2.4 7.8L12 16.7l-6.7 4.8 2.4-7.8L1.5 9h7.7z"/></svg>
              Trustpilot
            </span>
          </motion.div>
          <motion.div className="hero-actions" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.75 }}>
            <a href="#products" className="btn-primary" data-testid="hero-cta">See products</a>
            <a href="#how" className="link-plain" data-testid="hero-how-link">How it works →</a>
          </motion.div>
          <div className="hero-mascot-area">
            <div className="hero-mascot-wrap">
              <Mascot pose="wave" className="hero-mascot" eager alt="getsub mascot waving hello" />
            </div>
            <div className="mascot-bubble" data-testid="mascot-bubble">
              <span className="mascot-bubble-name">Hey, I'm subby</span> — I do one thing: cut your bill in half.
            </div>
          </div>
          <div className="hero-mini-features" data-testid="hero-mini-features">
            <span className="mini-feat"><span className="mini-dot mini-dot-teal" />No auto-renewal</span>
            <span className="mini-feat"><span className="mini-dot mini-dot-amber" />Same-day activation</span>
            <span className="mini-feat"><span className="mini-dot mini-dot-blue" />Human support</span>
          </div>
        </div>

        <div className="hero-right">
          <div className="price-chip" data-testid="price-chip"><span className="price-chip-star">★</span> 4.8 · 241+ happy subscribers</div>
          <motion.div className="price-card" style={{ y: cardY }} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}>
            <div className="tabs">
              {["spotify", "youtube"].map((s) => (
                <button key={s} className={`tab ${heroTab === s ? "active" : ""}`} onClick={() => setHeroTab(s)} data-testid={`hero-tab-${s}`}>
                  {s === "spotify" ? "Spotify" : "YouTube"}
                </button>
              ))}
            </div>
            <div className="bridge">
              <span className="price-old">{heroPrice.old}</span>
              <span className="arrow">→</span>
              <span className="price-new">{heroPrice.new}</span>
            </div>
            <p className="price-sub">per month · from</p>
            <div className="seats"><span className="seats-dot" /> 2 seats left on this cycle</div>
            <PayRow />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const Marquee = () => {
  const items = ["Real accounts", "Your own login", "Same official app", "No auto-renewal", "Seat protection", "Same-day activation", "Human support"];
  const row = [...items, ...items];
  return (
    <div className="marquee">
      <motion.div className="marquee-track" animate={{ x: ["0%", "-50%"] }} transition={{ duration: 26, ease: "linear", repeat: Infinity }}>
        {row.map((t, i) => (
          <span className="marquee-item" key={i}><span className="dot" />{t}</span>
        ))}
      </motion.div>
    </div>
  );
};

const LEGIT_QA = [
  { q: "Is this against Spotify/YouTube's terms?", a: "No — we use official family-sharing plans and regional pricing differences to offer these rates. You're getting a legitimate seat, not a workaround.", path: "M12 2 4 5v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V5z M9 12l2 2 4-4" },
  { q: "Do I get my own login?", a: "Yes, both options are available: Premium under your own login, or ready-made account credentials — whichever you prefer.", path: "M12 8m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M4 21c1.5-4 5-6 8-6s6.5 2 8 6" },
  { q: "What happens if a seat gets removed?", a: "That's rare, but if it happens, you can choose between a full refund or a free replacement seat.", path: "M3 12a9 9 0 0 1 15-6.7L21 8 M21 3v5h-5" },
  { q: "Can I cancel anytime?", a: "Absolutely — cancel anytime, and refunds are processed immediately.", path: "M20 6 9 17l-5-5" },
];

const ProductCard = ({ product, delay, onQuickView }) => {
  const pct = product.official_price > 0 ? Math.round(((product.official_price - product.from_price) / product.official_price) * 100) : 0;
  return (
    <Reveal className="product-card" delay={delay} data-testid={`product-card-${product.slug}`}>
      <div className="product-card-head">
        <div className="product-card-icon" style={{ background: `${product.color}1f` }}><ServiceIcon service={product.slug} color={product.color} size={30} /></div>
        {pct > 0 && <span className="product-save-chip">up to {pct}% off</span>}
      </div>
      <h3 className="product-card-title">{product.name}</h3>
      <p className="product-card-desc">{product.brief}</p>
      <div className="product-card-price">
        <span className="plan-old">{money(product.official_price)}/mo</span>
        <span className="product-card-from">from <strong>{money(product.from_price)}</strong>/mo</span>
      </div>
      <ul className="plan-features">
        {product.highlights.slice(0, 3).map((h) => <li key={h}>{h}</li>)}
      </ul>
      <div className="product-card-actions">
        <Link to={`/${product.slug}`} className="plan-cta product-cta-primary" data-testid={`choose-plan-${product.slug}`}>Choose plan</Link>
        <button className="plan-cta product-cta-ghost" data-testid={`view-more-${product.slug}`} onClick={() => onQuickView(product)}>View more</button>
      </div>
    </Reveal>
  );
};

const ComingSoonCard = ({ product, delay }) => {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await axios.post(`${API}/api/notify`, { product_slug: product.slug, email });
      setDone(true);
    } catch (err) {
      setError("Enter a valid email.");
    }
  };
  return (
    <Reveal className="product-card coming-soon-card" delay={delay} data-testid={`coming-soon-card-${product.slug}`}>
      <div className="product-card-head">
        <div className="product-card-icon" style={{ background: `${product.color}1f` }}><ServiceIcon service={product.slug} color={product.color} size={30} /></div>
        <span className="coming-soon-chip">Coming soon</span>
      </div>
      <h3 className="product-card-title">{product.name}</h3>
      <p className="product-card-desc">{product.brief}</p>
      {product.from_price > 0 && (
        <div className="product-card-price">
          <span className="plan-old">{money(product.official_price)}/mo</span>
          <span className="product-card-from">from <strong>{money(product.from_price)}</strong>/mo</span>
        </div>
      )}
      {done ? (
        <p className="notify-done" data-testid={`notify-done-${product.slug}`}>✓ You're on the list — we'll email you at launch.</p>
      ) : (
        <form className="notify-form" onSubmit={submit}>
          <input
            className="notify-input"
            data-testid={`notify-email-${product.slug}`}
            type="email"
            required
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="notify-btn" data-testid={`notify-submit-${product.slug}`} type="submit">Notify me</button>
        </form>
      )}
      {error && <p className="modal-error" style={{ marginTop: 8 }}>{error}</p>}
    </Reveal>
  );
};

function App() {
  const [heroTab, setHeroTab] = useState("spotify");
  const [modalPlan, setModalPlan] = useState(null);
  const [quickView, setQuickView] = useState(null);
  const { data: products = [] } = useProducts();
  useLenis();

  const activeProducts = products.filter((p) => p.status === "active");
  const comingSoon = products.filter((p) => p.status === "coming_soon");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("plan");
    if (!q || !products.length) return;
    for (const prod of products) {
      const plan = prod.plans.find((p) => p.plan_id === q);
      if (plan) { setModalPlan({ product: prod, plan }); break; }
    }
  }, [products]);

  useEffect(() => {
    document.body.style.overflow = modalPlan || quickView ? "hidden" : "";
  }, [modalPlan, quickView]);

  const heroPrices = { spotify: { old: "$12.99", new: "$4.49" }, youtube: { old: "$15.99", new: "$3.49" } };

  return (
    <>
      <SiteHeader links={[{ href: "#how", label: "How it works" }]} />

      <Hero heroTab={heroTab} setHeroTab={setHeroTab} heroPrice={heroPrices[heroTab]} />

      <Marquee />

      <section className="legit-section" data-testid="legit-section">
        <div className="wrap">
          <Reveal className="legit-head">
            <span className="chapter">Before you buy</span>
            <h2>Why it's legit</h2>
          </Reveal>
          <div className="legit-grid">
            {LEGIT_QA.map((item, i) => (
              <Reveal className="legit-card" key={item.q} delay={(i % 4) * 0.07} data-testid={`legit-card-${i}`}>
                <div className="legit-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.path} /></svg>
                </div>
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="trust">
        <div className="wrap">
          <p className="trust-label">Bundle these platforms</p>
          <div className="trust-row">
            {[...activeProducts.map((p) => p.name), "Secure checkout", "No auto-renewal"].map((t) => (
              <span className="trust-chip" key={t}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      <section className="block" id="products">
        <div className="wrap">
          <Reveal className="block-head">
            <span className="chapter">01 — Products</span>
            <h2>Pick your platform</h2>
            <p>Choose a plan to see everything included, or view a quick summary first.</p>
          </Reveal>
          <div className="product-grid" data-testid="product-grid">
            {activeProducts.map((p, i) => (
              <ProductCard key={p.slug} product={p} delay={i * 0.08} onQuickView={setQuickView} />
            ))}
            {comingSoon.map((p, i) => (
              <ComingSoonCard key={p.slug} product={p} delay={(activeProducts.length + i) * 0.08} />
            ))}
          </div>
        </div>
      </section>

      <div className="surface-band" id="how">
        <div className="wrap" style={{ padding: "72px 24px" }}>
          <Reveal className="block-head">
            <span className="chapter">02 — How it works</span>
            <h2>Three steps, same-day access</h2>
            <p>No account juggling, no waiting around.</p>
          </Reveal>
          <div className="steps">
            {[
              ["Pick your seat", "Choose a service and see the official price next to yours, upfront."],
              ["Confirm your order", "One quick step to lock in your price — no card details stored by us."],
              ["Get access", "You're added to the plan the same day, with your own login."],
            ].map(([t, d], i) => (
              <Reveal className="step" key={t} delay={i * 0.1}>
                <div className="step-num">{i + 1}</div>
                <h3>{t}</h3>
                <p>{d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      <Reveal className="footer-cta">
        <h2>Ready to stop overpaying?</h2>
        <p>Set up your first seat in under two minutes.</p>
        <a href="#products" className="btn-primary">Get started</a>
        <PayRow dark />
      </Reveal>

      <SiteFooter />

      <AnimatePresence>
        {quickView && <QuickViewModal product={quickView} onClose={() => setQuickView(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {modalPlan && <PlanModalFlow key={modalPlan.plan.plan_id} product={modalPlan.product} plan={modalPlan.plan} months={1} onClose={() => setModalPlan(null)} />}
      </AnimatePresence>
    </>
  );
}

export default App;
