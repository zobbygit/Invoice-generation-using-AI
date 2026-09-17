import React, { useState, useEffect } from "react"; // 🔥 added useState, useEffect

const features = [
  { icon: "fas fa-wand-magic-sparkles", title: "AI-Powered Generation", desc: "Describe your work and let AI compose a polished, professional invoice instantly.", gradient: "linear-gradient(135deg, #6366f1, #4f46e5)" },
  { icon: "fas fa-calculator", title: "Automatic Calculations", desc: "Subtotal, discount, GST, and grand total — calculated perfectly every time.", gradient: "linear-gradient(135deg, #10b981, #059669)" },
  { icon: "fas fa-percent", title: "GST & Discount Support", desc: "Simple GST or per-item CGST / SGST / IGST splits — your choice.", gradient: "linear-gradient(135deg, #f59e0b, #d97706)" },
  { icon: "fas fa-palette", title: "Professional Templates", desc: "Clean layouts that make every invoice look like it came from a design studio.", gradient: "linear-gradient(135deg, #ec4899, #db2777)" },
  { icon: "fas fa-file-pdf", title: "PDF Download", desc: "Export print-ready A4 PDFs with a single click, ready to email to clients.", gradient: "linear-gradient(135deg, #ef4444, #dc2626)" },
  { icon: "fas fa-database", title: "MongoDB Storage", desc: "Every invoice is securely stored and retrievable anytime from your dashboard.", gradient: "linear-gradient(135deg, #06b6d4, #0891b2)" },
  { icon: "fas fa-microchip", title: "Free AI Models", desc: "Powered by free Hugging Face models with dynamic provider discovery.", gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)" },
  { icon: "fas fa-mobile-screen", title: "Fully Responsive", desc: "Beautiful on desktop, tablet, and mobile — invoice from anywhere.", gradient: "linear-gradient(135deg, #14b8a6, #0d9488)" },
];

const steps = [
  { icon: "fas fa-pen-to-square", title: "Enter Invoice Details", desc: "Add your business, client, and line items. We remember everything for next time." },
  { icon: "fas fa-wand-magic-sparkles", title: "Generate with AI", desc: "Our AI composes a clean, professional invoice in a matter of seconds." },
  { icon: "fas fa-eye", title: "Preview & Review", desc: "Check the totals, adjust anything, and see the live invoice preview." },
  { icon: "fas fa-download", title: "Download as PDF", desc: "One click exports a print-ready A4 PDF, ready to send to your client." },
];

const benefits = [
  { icon: "fas fa-clock", title: "Save Hours Every Week", desc: "Stop fighting with Word templates. Get invoices out in minutes." },
  { icon: "fas fa-shield-halved", title: "Accurate Every Time", desc: "No math errors. Taxes and discounts are always calculated correctly." },
  { icon: "fas fa-briefcase", title: "Look More Professional", desc: "Polished invoices build trust with clients and speed up payments." },
  { icon: "fas fa-mobile-screen-button", title: "Works Anywhere", desc: "Generate invoices from your phone, tablet, or laptop — no install needed." },
];

const testimonials = [
  { name: "Priya Sharma", role: "Freelance Designer", initials: "PS", quote: "I used to dread invoicing. Now I generate a beautiful, GST-ready invoice before my coffee gets cold." },
  { name: "Arjun Mehta", role: "Agency Owner", initials: "AM", quote: "The GST auto-calculation alone has saved me from countless accounting headaches. Absolute lifesaver." },
  { name: "Neha Kapoor", role: "Independent Consultant", initials: "NK", quote: "The invoices look like they came from a design studio. My clients noticed immediately." },
];

// 🔥 NEW: content shown in the "Coming Soon" modal
const comingSoonContent = {
  Documentation: {
    icon: "fas fa-book",
    title: "Documentation",
    text: "Step-by-step guides, setup instructions, and best practices for getting the most out of InvoiceAI.",
    tag: "Docs",
  },
  "API Reference": {
    icon: "fas fa-code",
    title: "API Reference",
    text: "REST endpoints, request/response schemas, and SDK examples for integrating InvoiceAI into your stack.",
    tag: "Developers",
  },
  Support: {
    icon: "fas fa-headset",
    title: "Support",
    text: "Get help from our team. Email support@invoiceai.app or browse the knowledge base.",
    tag: "Help",
  },
  Changelog: {
    icon: "fas fa-clock-rotate-left",
    title: "Changelog",
    text: "v1.4 — Per-item CGST/SGST/IGST, dark mode, dashboard analytics, MongoDB history.",
    tag: "Releases",
  },
  Privacy: {
    icon: "fas fa-user-shield",
    title: "Privacy Policy",
    text: "We never share your data. Invoices are stored securely and only accessible to you.",
    tag: "Legal",
  },
  Terms: {
    icon: "fas fa-file-contract",
    title: "Terms of Service",
    text: "Fair-use terms for using InvoiceAI. You own your data. We own the software.",
    tag: "Legal",
  },
  Cookies: {
    icon: "fas fa-cookie-bite",
    title: "Cookie Policy",
    text: "We use essential cookies only — for theme preference and session storage. No tracking.",
    tag: "Legal",
  },
  "GST Compliance": {
    icon: "fas fa-receipt",
    title: "GST Compliance",
    text: "InvoiceAI follows Indian GST guidelines: CGST, SGST, IGST, and HSN/SAC-ready invoices.",
    tag: "Compliance",
  },
};

function LandingPage({ darkMode, setDarkMode, onNavigate }) {
  // 🔥 NEW: modal state
  const [modal, setModal] = useState(null);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // 🔥 NEW: open the modal for a given footer link
  const openModal = (key) => setModal(comingSoonContent[key] || null);

  // 🔥 NEW: lock body scroll when modal is open
  useEffect(() => {
    if (modal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [modal]);

  // 🔥 NEW: close on Escape key
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setModal(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="landing-root">
      {/* ============== NAV ============== */}
      <nav className="top-nav landing-nav">
        <div className="landing-logo">
          <span className="logo-icon">🤖</span>
          <span className="logo-text">InvoiceAI</span>
        </div>

        <div className="landing-nav-links">
          <button className="nav-btn" onClick={() => scrollTo("features")}>
            <i className="fas fa-star"></i> Features
          </button>
          <button className="nav-btn" onClick={() => scrollTo("how")}>
            <i className="fas fa-list-ol"></i> How It Works
          </button>
          <button className="nav-btn" onClick={() => scrollTo("showcase")}>
            <i className="fas fa-image"></i> Showcase
          </button>
        </div>

        <div className="landing-nav-actions">
          <button
            className="nav-btn theme-toggle"
            onClick={() => setDarkMode((d) => !d)}
            title="Toggle theme"
          >
            <i className={`fas ${darkMode ? "fa-sun" : "fa-moon"}`}></i>
          </button>
          <button className="button landing-cta-btn" onClick={() => onNavigate("home")}>
            <i className="fas fa-rocket"></i> Create Invoice
          </button>
        </div>
      </nav>

      {/* ============== HERO ============== */}
      <section className="landing-hero">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="pulse-dot"></span>
            AI Powered · PDF Ready · Fast & Simple
          </div>

          <h1 className="hero-title">
            Create Professional <br />
            <span className="gradient-text">Invoices with AI</span>
          </h1>

          <p className="hero-subtitle">
            Generate clean, accurate, business-ready invoices in seconds.
            AI handles the numbers, layout, and polish — you just hit download.
          </p>

          <div className="hero-ctas">
            <button className="button hero-primary" onClick={() => onNavigate("home")}>
              <i className="fas fa-magic"></i> Create Invoice
            </button>
            <button className="button hero-secondary" onClick={() => scrollTo("features")}>
              Get Started <i className="fas fa-arrow-right"></i>
            </button>
          </div>

          <div className="hero-trust">
            <div className="trust-item"><i className="fas fa-check-circle"></i> No sign-up</div>
            <div className="trust-item"><i className="fas fa-check-circle"></i> Instant PDF</div>
            <div className="trust-item"><i className="fas fa-check-circle"></i> GST ready</div>
          </div>
        </div>

        {/* Invoice mockup */}
        <div className="hero-mockup-wrap">
          <div className="hero-mockup-glow"></div>

          <div className="invoice-mockup">
            <div className="mockup-header">
              <div>
                <div className="mockup-company">Zohaib Co.</div>
                <div className="mockup-sub">71/A Colootola Street</div>
              </div>
              <div className="mockup-badge">INVOICE</div>
            </div>

            <div className="mockup-meta">
              <div><span>Invoice #</span><strong>INV-2025-001</strong></div>
              <div><span>Date</span><strong>17 Sep 2026</strong></div>
            </div>

            <div className="mockup-rows">
              <div className="mockup-row"><span>Web Design</span><span>1 × ₹25,000</span></div>
              <div className="mockup-row"><span>SEO Setup</span><span>2 × ₹5,000</span></div>
              <div className="mockup-row"><span>Hosting (1y)</span><span>1 × ₹4,500</span></div>
            </div>

            <div className="mockup-totals">
              <div><span>Subtotal</span><span>₹39,500</span></div>
              <div><span>GST 18%</span><span>₹7,110</span></div>
              <div className="mockup-total-row"><span>Total</span><span>₹46,610</span></div>
            </div>

            <div className="mockup-footer">
              <span>✓ AI generated</span>
              <span>✓ Auto-calculated</span>
            </div>
          </div>

          <div className="floating-card floating-card-1">
            <i className="fas fa-check"></i> GST Auto-calc
          </div>
          <div className="floating-card floating-card-2">
            <i className="fas fa-file-pdf"></i> PDF Ready
          </div>
          <div className="floating-card floating-card-3">
            <i className="fas fa-bolt"></i> In Seconds
          </div>
        </div>
      </section>

      {/* ============== FEATURES ============== */}
      <section id="features" className="landing-section">
        <div className="section-head">
          <div className="section-tag">Features</div>
          <h2 className="section-title">Everything you need to invoice like a pro</h2>
          <p className="section-desc">
            Built for freelancers, agencies, and small businesses who want to look
            professional without the busywork.
          </p>
        </div>

        <div className="features-grid">
          {features.map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="feature-icon" style={{ background: f.gradient }}>
                <i className={f.icon}></i>
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============== HOW IT WORKS ============== */}
      <section id="how" className="landing-section">
        <div className="section-head">
          <div className="section-tag">How It Works</div>
          <h2 className="section-title">From blank page to finished invoice in 4 steps</h2>
          <p className="section-desc">
            No learning curve. No setup. Just a beautiful invoice, ready to send.
          </p>
        </div>

        <div className="steps-grid">
          {steps.map((s, i) => (
            <div className="step-card" key={s.title}>
              <div className="step-num">{i + 1}</div>
              <div className="step-icon"><i className={s.icon}></i></div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============== SHOWCASE ============== */}
      <section id="showcase" className="landing-section">
        <div className="showcase-wrap">
          <div className="showcase-content">
            <div className="section-tag">Showcase</div>
            <h2 className="section-title">
              Invoices that look like they came from a design studio
            </h2>
            <p className="section-desc">
              Beautiful typography, balanced spacing, clear totals — every invoice
              is production-ready for your clients.
            </p>

            <ul className="showcase-list">
              <li><i className="fas fa-check"></i> Clean, modern layout</li>
              <li><i className="fas fa-check"></i> Bank & UPI payment block</li>
              <li><i className="fas fa-check"></i> QR code for instant payment</li>
              <li><i className="fas fa-check"></i> Amount in words</li>
              <li><i className="fas fa-check"></i> A4 print-ready</li>
            </ul>
          </div>

          <div className="showcase-visual">
            <div className="showcase-invoice">
              <div className="showcase-row header">
                <div className="showcase-dot" style={{ background: "#ef4444" }}></div>
                <div className="showcase-dot" style={{ background: "#f59e0b" }}></div>
                <div className="showcase-dot" style={{ background: "#10b981" }}></div>
              </div>

              <div className="showcase-lines">
                <div className="showcase-line w-70"></div>
                <div className="showcase-line w-40"></div>
                <div className="showcase-divider"></div>
                <div className="showcase-line w-90"></div>
                <div className="showcase-line w-80"></div>
                <div className="showcase-line w-60"></div>
                <div className="showcase-divider"></div>
                <div className="showcase-total">
                  <div className="showcase-line w-30"></div>
                  <div className="showcase-line w-30 strong"></div>
                </div>
              </div>

              <div className="showcase-qr"></div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== BENEFITS ============== */}
      <section className="landing-section">
        <div className="section-head">
          <div className="section-tag">Why InvoiceAI</div>
          <h2 className="section-title">Built to save you time and impress your clients</h2>
        </div>

        <div className="benefits-grid">
          {benefits.map((b) => (
            <div className="benefit-card" key={b.title}>
              <div className="benefit-icon"><i className={b.icon}></i></div>
              <div>
                <h3>{b.title}</h3>
                <p>{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============== TESTIMONIALS ============== */}
      <section className="landing-section">
        <div className="section-head">
          <div className="section-tag">Loved by Freelancers</div>
          <h2 className="section-title">Trusted by people who hate invoicing</h2>
        </div>

        <div className="testimonials-grid">
          {testimonials.map((t) => (
            <div className="testimonial-card" key={t.name}>
              <div className="testimonial-stars">{"★".repeat(5)}</div>
              <p className="testimonial-quote">"{t.quote}"</p>
              <div className="testimonial-author">
                <div className="testimonial-avatar">{t.initials}</div>
                <div>
                  <div className="testimonial-name">{t.name}</div>
                  <div className="testimonial-role">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============== FINAL CTA ============== */}
      <section className="landing-cta">
        <div className="cta-glow"></div>
        <div className="cta-content">
          <h2>Ready to send your next invoice in 30 seconds?</h2>
          <p>No signup. No credit card. Just a beautiful invoice, ready to download.</p>
          <button className="button cta-primary" onClick={() => onNavigate("home")}>
            <i className="fas fa-rocket"></i> Create Invoice Now
          </button>
        </div>
      </section>

      {/* ============== FOOTER ============== */}
      <footer className="landing-footer">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="landing-logo">
              <span className="logo-icon">🤖</span>
              <span className="logo-text">InvoiceAI</span>
            </div>
            <p>AI-powered invoices for modern businesses. Beautiful, accurate, fast.</p>
          </div>

          <div className="footer-col">
            <h4>Product</h4>
            <button onClick={() => onNavigate("home")}>Create Invoice</button>
            <button onClick={() => scrollTo("features")}>Features</button>
            <button onClick={() => scrollTo("how")}>How It Works</button>
            <button onClick={() => onNavigate("dashboard")}>Dashboard</button>
          </div>

          {/* 🔥 UPDATED: Resources now open the modal */}
          <div className="footer-col">
            <h4>Resources</h4>
            <button onClick={() => openModal("Documentation")}>Documentation</button>
            <button onClick={() => openModal("API Reference")}>API Reference</button>
            <button onClick={() => openModal("Support")}>Support</button>
            <button onClick={() => openModal("Changelog")}>Changelog</button>
          </div>

          {/* 🔥 UPDATED: Legal now open the modal */}
          <div className="footer-col">
            <h4>Legal</h4>
            <button onClick={() => openModal("Privacy")}>Privacy</button>
            <button onClick={() => openModal("Terms")}>Terms</button>
            <button onClick={() => openModal("Cookies")}>Cookies</button>
            <button onClick={() => openModal("GST Compliance")}>GST Compliance</button>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} InvoiceAI. All rights reserved.</span>
          <span>Made with ❤️ for freelancers</span>
        </div>
      </footer>

      {/* 🔥 NEW: Coming Soon modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModal(null)} title="Close">
              <i className="fas fa-times"></i>
            </button>

            <div className="modal-icon">
              <i className={modal.icon}></i>
            </div>

            <div className="modal-tag">{modal.tag}</div>
            <h3 className="modal-title">{modal.title}</h3>
            <p className="modal-text">{modal.text}</p>

            <div className="modal-actions">
              <button className="button modal-primary" onClick={() => onNavigate("home")}>
                <i className="fas fa-rocket"></i> Create Invoice
              </button>
              <button className="button modal-secondary" onClick={() => setModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LandingPage;