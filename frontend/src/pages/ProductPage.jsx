import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { AnimatePresence, motion } from "framer-motion";
import { Reveal, ServiceIcon, SiteHeader, SiteFooter, PlanModalFlow, useLenis, productChip } from "@/components/Shared";
import { SHARED_MONTH_OPTIONS, money } from "@/data";
import "@/styles/getsub.css";

const API = process.env.REACT_APP_BACKEND_URL;

const HOW_STEPS = [
  ["Pick your plan", "Choose the plan that fits and see the official price next to yours, upfront."],
  ["Confirm your order", "One quick step to lock in your price — no card details stored by us."],
  ["Get access", "You're added the same day, with your own login delivered by email."],
];

export default function ProductPage() {
  const { slug } = useParams();
  const [sharedMonths, setSharedMonths] = useState(3);
  const [modalPlan, setModalPlan] = useState(null);
  const [openFaq, setOpenFaq] = useState(0);
  useLenis();

  const { data: product, isError, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => (await axios.get(`${API}/api/products/${slug}`)).data,
    retry: false,
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    if (!product) return;
    const q = new URLSearchParams(window.location.search).get("plan");
    if (!q) return;
    const plan = product.plans.find((p) => p.plan_id === q);
    if (plan) setModalPlan(plan);
  }, [product]);

  useEffect(() => {
    document.body.style.overflow = modalPlan ? "hidden" : "";
  }, [modalPlan]);

  if (isError) return <Navigate to="/" replace />;
  if (isLoading || !product) {
    return (
      <>
        <SiteHeader />
        <div className="order-page wrap"><p className="lead">Loading…</p></div>
        <SiteFooter />
      </>
    );
  }
  if (product.status !== "active") return <Navigate to="/" replace />;

  const chip = productChip(product.slug, product.color);
  const pct = product.official_price > 0 ? Math.round(((product.official_price - product.from_price) / product.official_price) * 100) : 0;

  return (
    <>
      <SiteHeader
        links={[
          { href: "#plans", label: "Plans", cta: true },
          { href: "#how", label: "How it works" },
          { href: "#reviews", label: "Reviews" },
          { href: "#faq", label: "FAQ" },
        ]}
      />

      <section className="product-hero" data-testid="product-hero">
        <div className="wrap">
          <motion.span className={chip.className} style={chip.style} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <ServiceIcon service={product.slug} color={product.color} size={16} />{product.name}
          </motion.span>
          <h1 className="product-hero-title">
            <span className="line-mask">
              <motion.span style={{ display: "block" }} initial={{ y: "110%" }} animate={{ y: 0 }} transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}>
                {product.hero_title || product.name}
              </motion.span>
            </span>
          </h1>
          <motion.p className="lead" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.5 }}>
            {product.tagline}
          </motion.p>
          <motion.div className="product-hero-bridge" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.6 }}>
            <span className="price-old">{money(product.official_price)}/mo</span>
            <span className="arrow">→</span>
            <span className="price-new">from {money(product.from_price)}/mo</span>
            {pct > 0 && <span className="product-save-chip" data-testid="product-save-chip">save up to {pct}%</span>}
          </motion.div>
          <motion.div className="hero-actions" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.72 }}>
            <a href="#plans" className="btn-primary" data-testid="product-see-plans">See plans</a>
            <a href="#how" className="link-plain">How it works →</a>
          </motion.div>
        </div>
      </section>

      {product.perks.length > 0 && (
        <div className="surface-band">
          <div className="wrap" style={{ padding: "72px 24px" }}>
            <Reveal className="block-head">
              <span className="chapter">01 — What you get</span>
              <h2>Everything in {product.name}</h2>
              <p>The full official feature set — nothing stripped out.</p>
            </Reveal>
            <div className="perk-grid">
              {product.perks.map((p, i) => (
                <Reveal className="perk-card" key={p.t} delay={(i % 4) * 0.08}>
                  <div className="perk-icon" style={{ background: `${product.color}1f`, color: product.color }}>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={p.path || "M20 6 9 17l-5-5"} /></svg>
                  </div>
                  <h3>{p.t}</h3>
                  <p>{p.d}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      )}

      <section className="block" id="plans">
        <div className="wrap">
          <Reveal className="block-head">
            <span className="chapter">02 — Plans</span>
            <h2>Pick your {product.name} plan</h2>
            <p>Tap any plan to see the full price breakdown before you pay.</p>
          </Reveal>
          <div className="pricing-grid">
            {product.plans.map((plan, i) => (
              <Reveal className={`plan ${plan.featured ? "featured" : ""}`} key={plan.plan_id} delay={i * 0.08}>
                {plan.featured && <span className="badge">Best value</span>}
                <div className="plan-service"><ServiceIcon service={product.slug} color={product.color} size={22} /></div>
                <p className="plan-name">{plan.name}</p>
                {plan.shared ? (
                  <>
                    <div className="plan-price-row">
                      <span className="plan-old">${(plan.official * sharedMonths).toFixed(2)}</span>
                      <span className="plan-new" data-testid={`shared-total-${plan.plan_id}`}>${(plan.price * sharedMonths).toFixed(2)}</span>
                    </div>
                    <p className="plan-period">${plan.price.toFixed(2)}/mo × {sharedMonths} months</p>
                    <div className="months-picker">
                      <label htmlFor={`months-${plan.plan_id}`}>Choose duration</label>
                      <select
                        id={`months-${plan.plan_id}`}
                        data-testid={`months-select-${plan.plan_id}`}
                        value={sharedMonths}
                        onChange={(e) => setSharedMonths(Number(e.target.value))}
                      >
                        {SHARED_MONTH_OPTIONS.map((m) => (
                          <option key={m} value={m}>{m} months</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="plan-price-row"><span className="plan-old">{money(plan.official)}</span><span className="plan-new">{money(plan.price)}</span></div>
                    <p className="plan-period">{plan.period_label}</p>
                  </>
                )}
                <p className="plan-desc">{plan.desc}</p>
                <ul className="plan-features">{plan.feats.map((f) => <li key={f}>{f}</li>)}</ul>
                <div className="plan-delivery">
                  <span className="plan-delivery-tag">{plan.delivery_label}</span>
                  <p className="plan-delivery-note">{plan.delivery_note}</p>
                  <p className="plan-delivery-time">Delivered by email · 10 min–2 hrs</p>
                </div>
                <button className="plan-cta" data-testid={`choose-${plan.plan_id}`} onClick={() => setModalPlan(plan)}>Choose plan</button>
              </Reveal>
            ))}
          </div>
          <p className="plan-note">Official prices are current list prices as of June 2026 — these change periodically, so recheck before launch.</p>
        </div>
      </section>

      <div className="surface-band" id="how">
        <div className="wrap" style={{ padding: "72px 24px" }}>
          <Reveal className="block-head">
            <span className="chapter">03 — How it works</span>
            <h2>Three steps, same-day access</h2>
            <p>No account juggling, no waiting around.</p>
          </Reveal>
          <div className="steps">
            {HOW_STEPS.map(([t, d], i) => (
              <Reveal className="step" key={t} delay={i * 0.1}>
                <div className="step-num">{i + 1}</div>
                <h3>{t}</h3>
                <p>{d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      <section className="block" id="reviews">
        <div className="wrap">
          <Reveal className="block-head">
            <span className="chapter">04 — Reviews</span>
            <h2>What {product.name} buyers say</h2>
            <p>Real reviews go here once you have them.</p>
          </Reveal>
          <div className="testimonial-grid">
            {[0, 1, 2].map((i) => (
              <Reveal className="testimonial" key={i} delay={i * 0.08}>
                <div className="stars">★★★★★</div>
                <p className="quote">"Placeholder review text — replace with a real customer quote."</p>
                <p className="who">Customer name, city</p>
              </Reveal>
            ))}
          </div>
          <div className="placeholder-note-wrap"><span className="placeholder-note">These are placeholders — swap in genuine reviews once you have them, never fabricated ones.</span></div>
        </div>
      </section>

      {product.faqs.length > 0 && (
        <section className="block" id="faq" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <Reveal className="block-head"><span className="chapter">05 — FAQ</span><h2>{product.name} questions</h2></Reveal>
            <div className="faq">
              {product.faqs.map((f, i) => (
                <div className={`faq-item ${openFaq === i ? "open" : ""}`} key={i}>
                  <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? -1 : i)} data-testid={`faq-${i}`}>
                    {f.q}<span className="faq-icon">+</span>
                  </button>
                  <AnimatePresence initial={false}>
                    {openFaq === i && (
                      <motion.div className="faq-a" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
                        <div className="faq-a-inner">{f.a}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <Reveal className="footer-cta">
        <h2>Ready for {product.name} at {money(product.from_price)}/mo?</h2>
        <p>Set up your seat in under two minutes.</p>
        <a href="#plans" className="btn-primary" data-testid="product-footer-cta">See plans</a>
      </Reveal>

      <SiteFooter />

      <AnimatePresence>
        {modalPlan && <PlanModalFlow key={modalPlan.plan_id} product={product} plan={modalPlan} months={modalPlan.shared ? sharedMonths : 1} onClose={() => setModalPlan(null)} />}
      </AnimatePresence>
    </>
  );
}
