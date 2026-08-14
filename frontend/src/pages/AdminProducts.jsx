import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ServiceIcon } from "@/components/Shared";
import { money } from "@/data";

const API = process.env.REACT_APP_BACKEND_URL;

const BLANK_PLAN = () => ({
  plan_id: "", name: "", price: 0, official: 0, unit: "/mo", period_label: "per month",
  billing: "One-time · 1 month of access", desc: "", featsStr: "Your own login, Full app access, No auto-renewal",
  featured: false, shared: false, delivery_types: ["preplanned", "recharge"],
  delivery_label: "New account", delivery_note: "Login details emailed to you after a quick setup.",
});

const BLANK_FORM = () => ({
  id: null, slug: "", name: "", status: "coming_soon", color: "#0E6E56",
  tagline: "", hero_title: "", brief: "", from_price: 0, official_price: 0,
  highlightsStr: "", perks: [], faqs: [], plans: [], sort_order: 10,
});

const productToForm = (p) => ({
  ...p,
  highlightsStr: p.highlights.join(", "),
  perks: p.perks.map((x) => ({ ...x })),
  faqs: p.faqs.map((x) => ({ ...x })),
  plans: p.plans.map((pl) => ({ ...pl, featsStr: pl.feats.join(", ") })),
});

const formToPayload = (f) => ({
  slug: f.slug.trim().toLowerCase(),
  name: f.name.trim(),
  status: f.status,
  color: f.color,
  tagline: f.tagline,
  hero_title: f.hero_title,
  brief: f.brief,
  from_price: Number(f.from_price) || 0,
  official_price: Number(f.official_price) || 0,
  highlights: f.highlightsStr.split(",").map((s) => s.trim()).filter(Boolean),
  perks: f.perks.filter((p) => p.t.trim()).map((p) => ({ t: p.t, d: p.d || "", path: p.path || "M20 6 9 17l-5-5" })),
  faqs: f.faqs.filter((x) => x.q.trim()),
  plans: f.plans.filter((p) => p.name.trim()).map((p) => ({
    plan_id: p.plan_id || "",
    name: p.name, price: Number(p.price) || 0, official: Number(p.official) || 0,
    unit: p.unit, period_label: p.period_label, billing: p.billing, desc: p.desc,
    feats: (p.featsStr || "").split(",").map((s) => s.trim()).filter(Boolean),
    featured: !!p.featured, shared: !!p.shared,
    delivery_types: p.shared ? [] : p.delivery_types,
    delivery_label: p.delivery_label, delivery_note: p.delivery_note,
  })),
  sort_order: Number(f.sort_order) || 0,
});

export const AdminProducts = ({ headers, onAuthFail }) => {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await axios.get(`${API}/api/products`)).data,
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setRow = (list, i, k, v) => setForm((f) => {
    const rows = [...f[list]];
    rows[i] = { ...rows[i], [k]: v };
    return { ...f, [list]: rows };
  });
  const addRow = (list, blank) => setForm((f) => ({ ...f, [list]: [...f[list], blank] }));
  const delRow = (list, i) => setForm((f) => ({ ...f, [list]: f[list].filter((_, j) => j !== i) }));

  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ["products"] }), [qc]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const payload = formToPayload(form);
      if (form.id) await axios.put(`${API}/api/admin/products/${form.id}`, payload, { headers });
      else await axios.post(`${API}/api/admin/products`, payload, { headers });
      refresh();
      setForm(null);
      setMsg("Saved ✓");
    } catch (err) {
      if (err.response?.status === 401) return onAuthFail();
      const d = err.response?.data?.detail;
      setMsg(typeof d === "string" ? d : "Save failed — check required fields (slug: lowercase letters/numbers/dashes).");
    }
    setSaving(false);
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete ${p.name}? Existing orders keep their data but buyers can no longer order it.`)) return;
    try {
      await axios.delete(`${API}/api/admin/products/${p.id}`, { headers });
      refresh();
      if (form?.id === p.id) setForm(null);
    } catch (err) {
      if (err.response?.status === 401) return onAuthFail();
    }
  };

  return (
    <div className="admin-grid" data-testid="admin-products">
      <div className="admin-orders">
        <button className="admin-new-product" data-testid="admin-new-product" onClick={() => { setForm(BLANK_FORM()); setMsg(""); }}>+ New product</button>
        {products.map((p) => (
          <button key={p.id} className={`admin-order-row ${form?.id === p.id ? "active" : ""}`} data-testid={`admin-product-row-${p.slug}`} onClick={() => { setForm(productToForm(p)); setMsg(""); }}>
            <ServiceIcon service={p.slug} color={p.color} size={20} />
            <span className="admin-order-main">
              <strong>{p.name}</strong>
              <em>/{p.slug} · {p.plans.length} plans · from {money(p.from_price)}</em>
            </span>
            <span className={`order-status-chip ${p.status === "active" ? "completed" : "awaiting_credentials"}`}>{p.status === "active" ? "active" : "coming soon"}</span>
          </button>
        ))}
      </div>
      <div className="admin-detail">
        {msg && !form && <p className="notify-done" data-testid="admin-products-msg">{msg}</p>}
        {!form ? (
          <p className="chat-empty" style={{ padding: 32 }}>Select a product to edit, or create a new one.</p>
        ) : (
          <form className="prod-form" data-testid="admin-product-form" onSubmit={save}>
            <div className="prod-form-grid">
              <label>Name<input className="cred-input" data-testid="prod-name" value={form.name} onChange={(e) => set("name", e.target.value)} required /></label>
              <label>Slug (URL)<input className="cred-input" data-testid="prod-slug" value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="netflix" required /></label>
              <label>Status
                <select className="cred-input" data-testid="prod-status" value={form.status} onChange={(e) => set("status", e.target.value)}>
                  <option value="active">Active (buyable)</option>
                  <option value="coming_soon">Coming soon (notify me)</option>
                </select>
              </label>
              <label>Accent color<input className="cred-input" type="color" value={form.color} onChange={(e) => set("color", e.target.value)} style={{ height: 44, padding: 4 }} /></label>
              <label>From price ($/mo)<input className="cred-input" data-testid="prod-from-price" type="number" step="0.01" value={form.from_price} onChange={(e) => set("from_price", e.target.value)} /></label>
              <label>Official price ($/mo)<input className="cred-input" type="number" step="0.01" value={form.official_price} onChange={(e) => set("official_price", e.target.value)} /></label>
            </div>
            <label className="prod-label">Brief (landing card)<input className="cred-input" value={form.brief} onChange={(e) => set("brief", e.target.value)} /></label>
            <label className="prod-label">Tagline (product page)<input className="cred-input" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} /></label>
            <label className="prod-label">Hero title<input className="cred-input" value={form.hero_title} onChange={(e) => set("hero_title", e.target.value)} /></label>
            <label className="prod-label">Highlights (comma separated)<input className="cred-input" value={form.highlightsStr} onChange={(e) => set("highlightsStr", e.target.value)} /></label>

            <div className="prod-section">
              <div className="prod-section-head"><h4>Plans</h4><button type="button" className="prod-add" data-testid="prod-add-plan" onClick={() => addRow("plans", BLANK_PLAN())}>+ Add plan</button></div>
              {form.plans.map((pl, i) => (
                <div className="prod-plan-row" key={i}>
                  <div className="prod-form-grid">
                    <label>Plan name<input className="cred-input" data-testid={`plan-name-${i}`} value={pl.name} onChange={(e) => setRow("plans", i, "name", e.target.value)} /></label>
                    <label>Price ($)<input className="cred-input" data-testid={`plan-price-${i}`} type="number" step="0.01" value={pl.price} onChange={(e) => setRow("plans", i, "price", e.target.value)} /></label>
                    <label>Official ($)<input className="cred-input" type="number" step="0.01" value={pl.official} onChange={(e) => setRow("plans", i, "official", e.target.value)} /></label>
                    <label>Unit
                      <select className="cred-input" value={pl.unit} onChange={(e) => setRow("plans", i, "unit", e.target.value)}>
                        <option value="/mo">/mo</option><option value="/yr">/yr</option>
                      </select>
                    </label>
                    <label>Period label<input className="cred-input" value={pl.period_label} onChange={(e) => setRow("plans", i, "period_label", e.target.value)} /></label>
                    <label>Billing line<input className="cred-input" value={pl.billing} onChange={(e) => setRow("plans", i, "billing", e.target.value)} /></label>
                  </div>
                  <label className="prod-label">Description<input className="cred-input" value={pl.desc} onChange={(e) => setRow("plans", i, "desc", e.target.value)} /></label>
                  <label className="prod-label">Features (comma separated)<input className="cred-input" value={pl.featsStr} onChange={(e) => setRow("plans", i, "featsStr", e.target.value)} /></label>
                  <div className="prod-form-grid">
                    <label>Delivery label<input className="cred-input" value={pl.delivery_label} onChange={(e) => setRow("plans", i, "delivery_label", e.target.value)} /></label>
                    <label>Delivery note<input className="cred-input" value={pl.delivery_note} onChange={(e) => setRow("plans", i, "delivery_note", e.target.value)} /></label>
                  </div>
                  <div className="prod-checks">
                    <label className="prod-check"><input type="checkbox" checked={pl.featured} onChange={(e) => setRow("plans", i, "featured", e.target.checked)} /> Featured (Best value)</label>
                    <label className="prod-check"><input type="checkbox" checked={pl.shared} onChange={(e) => setRow("plans", i, "shared", e.target.checked)} /> Shared seat (months picker)</label>
                    {!pl.shared && ["preplanned", "recharge"].map((dt) => (
                      <label className="prod-check" key={dt}>
                        <input
                          type="checkbox"
                          checked={pl.delivery_types.includes(dt)}
                          onChange={(e) => setRow("plans", i, "delivery_types", e.target.checked ? [...pl.delivery_types, dt] : pl.delivery_types.filter((x) => x !== dt))}
                        /> {dt === "preplanned" ? "Pre-planned account" : "Recharge service"}
                      </label>
                    ))}
                    <button type="button" className="prod-del" onClick={() => delRow("plans", i)}>Remove plan</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="prod-section">
              <div className="prod-section-head"><h4>Perks ("What you get")</h4><button type="button" className="prod-add" onClick={() => addRow("perks", { t: "", d: "", path: "M20 6 9 17l-5-5" })}>+ Add perk</button></div>
              {form.perks.map((p, i) => (
                <div className="prod-inline-row" key={i}>
                  <input className="cred-input" placeholder="Title" value={p.t} onChange={(e) => setRow("perks", i, "t", e.target.value)} />
                  <input className="cred-input" placeholder="Description" value={p.d} onChange={(e) => setRow("perks", i, "d", e.target.value)} />
                  <button type="button" className="prod-del" onClick={() => delRow("perks", i)}>✕</button>
                </div>
              ))}
            </div>

            <div className="prod-section">
              <div className="prod-section-head"><h4>FAQs</h4><button type="button" className="prod-add" onClick={() => addRow("faqs", { q: "", a: "" })}>+ Add FAQ</button></div>
              {form.faqs.map((f, i) => (
                <div className="prod-inline-row" key={i}>
                  <input className="cred-input" placeholder="Question" value={f.q} onChange={(e) => setRow("faqs", i, "q", e.target.value)} />
                  <input className="cred-input" placeholder="Answer" value={f.a} onChange={(e) => setRow("faqs", i, "a", e.target.value)} />
                  <button type="button" className="prod-del" onClick={() => delRow("faqs", i)}>✕</button>
                </div>
              ))}
            </div>

            {msg && <p className="modal-error" data-testid="prod-save-msg">{msg}</p>}
            <div className="prod-actions">
              <button className="modal-cta" data-testid="prod-save" type="submit" disabled={saving} style={{ width: "auto", padding: "12px 28px" }}>
                {saving ? "Saving…" : form.id ? "Save changes" : "Create product"}
              </button>
              {form.id && (
                <button type="button" className="prod-del" data-testid="prod-delete" onClick={() => remove(form)}>Delete product</button>
              )}
              <button type="button" className="modal-share" style={{ width: "auto", margin: 0 }} onClick={() => setForm(null)}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export const AdminSignups = ({ headers, onAuthFail }) => {
  const { data: signups = [] } = useQuery({
    queryKey: ["notify-signups"],
    queryFn: async () => {
      try {
        return (await axios.get(`${API}/api/admin/notify-signups`, { headers })).data;
      } catch (e) {
        if (e.response?.status === 401) onAuthFail();
        return [];
      }
    },
  });
  return (
    <div className="admin-signups" data-testid="admin-signups">
      {signups.length === 0 && <p className="chat-empty" style={{ padding: 32 }}>No "notify me" signups yet.</p>}
      {signups.map((s) => (
        <div className="admin-signup-row" key={s.id || `${s.product_slug}-${s.email}`}>
          <strong>{s.email}</strong>
          <span>{s.product_slug}</span>
          <em>{new Date(s.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</em>
        </div>
      ))}
    </div>
  );
};
