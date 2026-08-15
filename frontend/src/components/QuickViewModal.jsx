import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ServiceIcon, productChip } from "@/components/Shared";
import { money } from "@/data";

export const QuickViewModal = ({ product, onClose }) => {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!product) return null;
  const chip = productChip(product.slug, product.color);

  return (
    <motion.div
      className="modal-overlay"
      data-testid="quickview-modal"
      data-lenis-prevent
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
          <button className="modal-close" onClick={onClose} data-testid="quickview-close" aria-label="Close">×</button>
          <div className="modal-plan-title" data-testid="quickview-title">{product.name} at a glance</div>
          <p className="qv-brief">{product.brief}</p>
        </div>

        <div className="qv-plans">
          {product.plans.map((p) => (
            <div className="qv-plan-row" key={p.plan_id} data-testid={`qv-row-${p.plan_id}`}>
              <div>
                <span className="qv-plan-name">{p.name}</span>
                <span className="qv-plan-period">{p.shared ? "cheapest per month" : p.period_label}</span>
              </div>
              <div className="qv-plan-price">
                <span className="qv-old">{money(p.official)}</span>
                <span className="qv-new">{p.shared ? `${money(p.price)}/mo` : money(p.price)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="qv-chips">
          {product.highlights.map((h) => (
            <span className="qv-chip" key={h}>{h}</span>
          ))}
        </div>

        <div className="modal-actions">
          <button
            className="modal-cta"
            data-testid="quickview-choose-plan"
            onClick={() => { onClose(); navigate(`/${product.slug}`); }}
          >
            Choose plan →
          </button>
          <p className="modal-fineprint">Full details, reviews and FAQ on the {product.name} page</p>
        </div>
      </motion.div>
    </motion.div>
  );
};
