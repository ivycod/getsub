import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import "@/styles/getsub.css";

/* ─── Edit these placeholders in one place ─── */
export const LEGAL_CONFIG = {
  supportEmail: "support@getsub.shop",
  lastUpdated: "[date]",
  responseTime: "a few hours",
  refundResolution: "3 business days",
  refundWindow: "14 days",
  fulfillmentHighDemand: "24 hours",
};

const Mail = () => (
  <a href={`mailto:${LEGAL_CONFIG.supportEmail}`}>{LEGAL_CONFIG.supportEmail}</a>
);

const LegalLayout = ({ chapter, title, children }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="legal-page">
      <header>
        <div className="nav">
          <Link to="/" data-testid="legal-logo-home"><img src="/getsub-logo.png" alt="getsub" className="logo-img" /></Link>
          <Link to="/" className="nav-cta" data-testid="legal-back-home">← Back to home</Link>
        </div>
      </header>

      <div className="legal-hero">
        <div className="wrap">
          <span className="chapter">{chapter}</span>
          <h1 className="legal-title">{title}</h1>
          <p className="legal-updated">Last updated: {LEGAL_CONFIG.lastUpdated}</p>
        </div>
      </div>

      <motion.main className="legal-body" data-testid="legal-body" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        {children}
      </motion.main>

      <footer>
        <div className="wrap footer-row">
          <Link to="/"><img src="/getsub-logo.png" alt="getsub" className="logo-img" style={{ height: 30 }} /></Link>
          <div className="footer-links">
            <Link to="/refunds">Refund policy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/contact">Contact</Link>
          </div>
          <p className="footer-copy">© 2026 getsub.shop</p>
        </div>
      </footer>
    </div>
  );
};

/* ───────────────── Terms of Service ───────────────── */
export const TermsPage = () => (
  <LegalLayout chapter="Legal" title="Terms of Service">
    <p>Welcome to getsub ("we," "us," "our"). These Terms of Service ("Terms") govern your use of getsub.shop (the "Site") and the services we provide. By placing an order or using the Site, you agree to these Terms.</p>

    <h3>1. What We Offer</h3>
    <p>getsub provides access to premium subscription plans (including but not limited to Spotify and YouTube Premium) at reduced prices. We source this access through regional pricing options offered by these platforms, which allows us to pass savings on to customers.</p>
    <p>Depending on the product you purchase, access is delivered in one of three ways:</p>
    <ul>
      <li><strong>New Account</strong> — a freshly created account, with login credentials sent to you after purchase.</li>
      <li><strong>Add-to-Existing-Account</strong> — you provide the login of your own account, and after manual verification we add premium access to it.</li>
      <li><strong>Shared/Family Invite</strong> — you receive an invitation link by email to join a shared family or group plan.</li>
    </ul>
    <p>The delivery method for each product is stated on the product page at checkout.</p>

    <h3>2. Order Fulfillment</h3>
    <p>Orders are typically fulfilled within 10 minutes to 2 hours of purchase, depending on delivery method and availability. We'll notify you by email once your order is fulfilled.</p>

    <h3>3. Eligibility & Your Responsibilities</h3>
    <ul>
      <li>You must be at least 18, or the age of majority in your jurisdiction, to place an order.</li>
      <li>You're responsible for providing accurate information where required (e.g., for Add-to-Existing-Account orders).</li>
      <li>You agree not to resell, redistribute, or share access purchased through getsub with third parties outside the scope of your purchased plan.</li>
      <li>You're responsible for keeping any credentials we provide confidential.</li>
    </ul>

    <h3>4. Our Guarantee</h3>
    <p>If your access is revoked, suspended, or stops working due to an issue on our end, you're entitled to a full refund or a free replacement, at your choice. See our <Link to="/refunds">Refund Policy</Link> for details.</p>

    <h3>5. Relationship to Third-Party Platforms</h3>
    <p>getsub is an independent reseller and is not affiliated with, endorsed by, or officially partnered with Spotify, YouTube, Google, or any other platform referenced on this Site. All trademarks belong to their respective owners.</p>

    <h3>6. Limitation of Liability</h3>
    <p>To the maximum extent permitted by law, getsub is not liable for indirect, incidental, or consequential damages arising from use of the Site. Our total liability for any claim is limited to the amount you paid for the relevant order.</p>

    <h3>7. Changes to These Terms</h3>
    <p>We may update these Terms periodically. Continued use of the Site after changes are posted means you accept the updated Terms.</p>

    <h3>8. Contact</h3>
    <p>Questions? Reach us at <Mail />.</p>
  </LegalLayout>
);

/* ───────────────── Privacy Policy ───────────────── */
export const PrivacyPage = () => (
  <LegalLayout chapter="Legal" title="Privacy Policy">
    <p>This Privacy Policy explains how getsub ("we," "us," "our") collects, uses, and protects your information on getsub.shop.</p>

    <h3>1. Information We Collect</h3>
    <ul>
      <li><strong>Contact information</strong> — name and email, provided at checkout.</li>
      <li><strong>Payment information</strong> — processed by our third-party payment providers (Paddle and our crypto payment partner). We do not store your full card details.</li>
      <li><strong>Account credentials</strong> (where applicable) — if you choose Add-to-Existing-Account delivery, you provide login details for the account being upgraded. See Section 4 for how this is handled.</li>
      <li><strong>Usage data</strong> — pages visited, browser type, collected automatically to help us improve the Site.</li>
    </ul>

    <h3>2. How We Use Your Information</h3>
    <p>To fulfill and deliver orders, communicate with you about your order, process payments and prevent fraud, and improve the Site.</p>

    <h3>3. Sharing Your Information</h3>
    <p>We share information only with: payment processors (to complete your transaction), review platforms like Trustpilot (only if you choose to leave a review), and service providers who help us run the Site (hosting, email delivery). We do not sell your personal information.</p>

    <h3>4. Handling of Account Credentials</h3>
    <p>For Add-to-Existing-Account orders, we require temporary access to your account login solely to complete verification and fulfillment. Your password is used only for this purpose and is permanently deleted from our systems once your order is fulfilled — we do not retain it. We recommend changing your password after upgrade, as good practice with any account you've shared access to.</p>

    <h3>5. Data Retention</h3>
    <p>We keep your information only as long as necessary to fulfill orders, meet legal obligations, and resolve disputes.</p>

    <h3>6. Your Rights</h3>
    <p>Depending on your location, you may have the right to access, correct, or delete your personal data. Contact <Mail /> to exercise these rights.</p>

    <h3>7. Cookies</h3>
    <p>We use cookies to operate the Site and understand visitor behavior. You can control these through your browser settings.</p>

    <h3>8. Children's Privacy</h3>
    <p>getsub is not intended for anyone under 18. We do not knowingly collect data from minors.</p>

    <h3>9. Changes to This Policy</h3>
    <p>We'll post updates here with a new "Last updated" date.</p>

    <h3>10. Contact</h3>
    <p>Questions? Email <Mail />.</p>
  </LegalLayout>
);

/* ───────────────── Refund & Cancellation ───────────────── */
export const RefundsPage = () => (
  <LegalLayout chapter="Legal" title="Refund & Cancellation Policy">
    <h3>Full Refund Guarantee</h3>
    <p>You're entitled to a full refund if:</p>
    <ul>
      <li>Your account access is revoked or suspended due to an issue on our end.</li>
      <li>We can't fulfill your order within the stated window (10 min–2 hrs; up to {LEGAL_CONFIG.fulfillmentHighDemand} during high demand).</li>
      <li>What you received doesn't match what you purchased.</li>
    </ul>

    <h3>How to Request a Refund</h3>
    <p>Email <Mail /> with your order number and a short description of the issue. We aim to respond within {LEGAL_CONFIG.responseTime} and resolve valid claims within {LEGAL_CONFIG.refundResolution}.</p>

    <h3>Refund Method</h3>
    <p>Refunds go back to your original payment method. Processing typically takes 3–10 business days depending on your provider.</p>

    <h3>Exceptions</h3>
    <ul>
      <li>Change of mind after an account has already been delivered and accessed.</li>
      <li>Issues caused by sharing your credentials or access with others outside our Terms.</li>
      <li>Requests made more than {LEGAL_CONFIG.refundWindow} after delivery.</li>
    </ul>
    <p>Unsure if your situation qualifies? Reach out anyway — we'll take a look.</p>
  </LegalLayout>
);

/* ───────────────── Contact ───────────────── */
export const ContactPage = () => (
  <LegalLayout chapter="Support" title="Contact Us">
    <p>Have a question about your order, or something else on your mind? We're here to help.</p>
    <div className="legal-card">
      <p style={{ marginBottom: 8 }}><strong>Email:</strong> <Mail /></p>
      <p style={{ marginBottom: 0 }}><strong>Response time:</strong> We typically reply within {LEGAL_CONFIG.responseTime}.</p>
    </div>
    <p>Check our <a href="/#faq">FAQ</a> — you might find your answer faster.</p>
  </LegalLayout>
);
