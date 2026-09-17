import React, { useState, useEffect } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import "./App.css";
import Dashboard from "./Dashboard";
import LandingPage from "./pages/LandingPage";
import {
  numberToWords,
  generateInvoiceNumber,
  saveInvoiceToHistory,
} from "./utils/numberToWords";

const DRAFT_KEY = "invoiceDraft";
const THEME_KEY = "invoiceTheme";

const getInitialInvoice = () => ({
  company: {
    name: "Zohaib Company",
    address: "71/A Colootola Street",
    email: "iamzohaib777@gmail.com",
    phone: "7003026496",
    gst: "29ABCDE1234F1Z2",
    bank: {
      name: "HDFC Bank",
      account: "XXXX XXXX 1234",
      ifsc: "HDFC0001234",
      branch: "Park Street, Kolkata",
      upi: "zohaib@upi",
    },
  },
  client: { name: "", address: "", phone: "" },
  invoiceMeta: {
    number: generateInvoiceNumber(),
    date: new Date().toISOString().split("T")[0],
    due: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    terms: "",
    po: "",
  },
  items: [{ description: "", quantity: "", price: "", taxType: "gst18" }],
  notes: "Thanks for your business with us! Hope to see you soon.",
  discount: "",
  gstPercent: "",
  taxMode: "simple", // 'simple' | 'split'
});

function App() {
  const [page, setPage] = useState("landing"); // default to landing
  const [invoiceData, setInvoiceData] = useState(getInitialInvoice);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem(THEME_KEY) === "dark"
  );
  const [draftLoaded, setDraftLoaded] = useState(false);

  // ---------- Dark mode ----------
  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
    localStorage.setItem(THEME_KEY, darkMode ? "dark" : "light");
  }, [darkMode]);

  // ---------- Draft persistence ----------
  useEffect(() => {
    if (!draftLoaded) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(invoiceData));
  }, [invoiceData, draftLoaded]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setInvoiceData((prev) => ({
          ...prev,
          ...parsed,
          items: (parsed.items || prev.items).map((it) => ({
            ...it,
            taxType: it.taxType || "gst18",
          })),
          taxMode: parsed.taxMode || "simple",
        }));
      }
    } catch (e) {
      console.error("Draft load failed", e);
    }
    setDraftLoaded(true);
  }, []);

  // ---------- Handlers ----------
  const handleInputChange = (e, index, section) => {
    const { name, value } = e.target;
    if (section) {
      setInvoiceData((prev) => ({
        ...prev,
        [section]: { ...prev[section], [name]: value },
      }));
    } else if (index !== undefined) {
      const newItems = [...invoiceData.items];
      newItems[index][name] = value;
      setInvoiceData((prev) => ({ ...prev, items: newItems }));
    } else {
      setInvoiceData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const addItem = () => {
    setInvoiceData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { description: "", quantity: "", price: "", taxType: "gst18" },
      ],
    }));
  };

  const removeItem = (index) => {
    if (invoiceData.items.length === 1) return;
    setInvoiceData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const duplicateItem = (index) => {
    setInvoiceData((prev) => {
      const items = [...prev.items];
      items.splice(index + 1, 0, { ...items[index] });
      return { ...prev, items };
    });
  };

  const resetInvoice = () => {
    if (!window.confirm("Reset the entire form? This will clear your draft."))
      return;
    setInvoiceData(getInitialInvoice());
    setGeneratedHtml("");
    localStorage.removeItem(DRAFT_KEY);
  };

  // ---------- Totals with per-item tax ----------
  const calculateTotals = () => {
    const sub = invoiceData.items.reduce(
      (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.price) || 0),
      0
    );

    const discountAmount = (sub * (Number(invoiceData.discount) || 0)) / 100;
    const afterDiscount = sub - discountAmount;

    let gstAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (invoiceData.taxMode === "split") {
      // per-item tax
      invoiceData.items.forEach((it) => {
        const lineTotal =
          ((Number(it.quantity) || 0) * (Number(it.price) || 0)) *
          (1 - (Number(invoiceData.discount) || 0) / 100);

        const rateMap = {
          gst0: 0,
          gst5: 5,
          gst12: 12,
          gst18: 18,
          gst28: 28,
          cgst9: 9,
          sgst9: 9,
          igst18: 18,
        };
        const rate = rateMap[it.taxType] ?? 0;
        const taxAmt = (lineTotal * rate) / 100;
        gstAmount += taxAmt;

        if (it.taxType === "cgst9") cgstAmount += taxAmt;
        else if (it.taxType === "sgst9") sgstAmount += taxAmt;
        else if (it.taxType === "igst18") igstAmount += taxAmt;
      });
    } else {
      // simple single GST %
      gstAmount =
        (afterDiscount * (Number(invoiceData.gstPercent) || 0)) / 100;
    }

    const total = afterDiscount + gstAmount;
    return {
      subtotal: sub,
      discountAmount,
      gstAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      total,
    };
  };

  const generateInvoice = async () => {
    setLoading(true);
    try {
      const totals = calculateTotals();
const response = await axios.post('https://invoice-generation-xa14.onrender.com/generate-invoice', {
  
  ...invoiceData,
  totals
});

// const response = await axios.post(
//   "http://localhost:5001/generate-invoice",{

      let cleanedHtml = response.data.html
        .replace(/```html|```/g, "")
        .trim();

      // 🔥 Strip out global tags and styles that break the app's theme
      cleanedHtml = cleanedHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
      cleanedHtml = cleanedHtml.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
      cleanedHtml = cleanedHtml
        .replace(/<html[^>]*>/gi, "")
        .replace(/<\/html>/gi, "");
      cleanedHtml = cleanedHtml.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");
      cleanedHtml = cleanedHtml
        .replace(/<body[^>]*>/gi, "")
        .replace(/<\/body>/gi, "");

      // Add QR code, bank, and GST info to invoice HTML
      const fakeQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=fake@upi&pn=${encodeURIComponent(
        invoiceData.company.name
      )}`;

      cleanedHtml += `
        <div style="text-align:center; margin-top:20px; padding-top: 20px; border-top: 1px solid #eee;">
          <img src="${fakeQrUrl}" alt="QR Code" style="width:120px; height:120px;"/>
          <p style="font-size:0.8rem; color:#555;">Scan for payment</p>
          <p style="font-size:0.8rem; color:#555;">
            Bank: ${invoiceData.company.bank.name} | A/C: ${invoiceData.company.bank.account} | IFSC: ${invoiceData.company.bank.ifsc}
          </p>
          <p style="font-size:0.8rem; color:#555;">GST: ${invoiceData.company.gst}</p>
          <p style="font-size:0.85rem; color:#222; font-weight:600; margin-top:8px;">
            Amount in words: ${numberToWords(totals.total)}
          </p>
        </div>
      `;

      setGeneratedHtml(cleanedHtml);

      // Save to local history (dashboard fallback)
      saveInvoiceToHistory({
        invoiceMeta: invoiceData.invoiceMeta,
        client: invoiceData.client,
        company: invoiceData.company,
        items: invoiceData.items,
        totals,
        total: totals.total,
      });
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to generate invoice.");
    }
    setLoading(false);
  };

  const downloadPdf = () => {
    const invoiceElement = document.getElementById("invoice-preview");
    const options = { scale: 4, useCORS: true, logging: false };
    html2canvas(invoiceElement, options).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const margin = 10;
      const pdfWidth = pdf.internal.pageSize.getWidth() - margin * 2;
      const pdfHeight = pdf.internal.pageSize.getHeight() - margin * 2;
      const imgProps = pdf.getImageProperties(imgData);
      const ratio = Math.min(
        pdfWidth / imgProps.width,
        pdfHeight / imgProps.height
      );
      const scaledWidth = imgProps.width * ratio;
      const scaledHeight = imgProps.height * ratio;
      const x = (pdf.internal.pageSize.getWidth() - scaledWidth) / 2;
      const y = margin;
      pdf.addImage(imgData, "PNG", x, y, scaledWidth, scaledHeight);
      pdf.save(`Invoice_${invoiceData.invoiceMeta.number || "001"}.pdf`);
    });
  };

  const clearInvoice = () => setGeneratedHtml("");

  const {
    subtotal,
    discountAmount,
    gstAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    total,
  } = calculateTotals();

  // ============================
  // RENDER
  // ============================

  // ---------- LANDING PAGE ----------
  if (page === "landing") {
    return (
      <>
        <div className="bg-orb bg-orb-1"></div>
        <div className="bg-orb bg-orb-2"></div>
        <div className="bg-orb bg-orb-3"></div>
        <LandingPage
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          onNavigate={setPage}
        />
      </>
    );
  }

  // ---------- DASHBOARD ----------
  if (page === "dashboard") {
    return (
      <div className="app-container">
        <div className="bg-orb bg-orb-1"></div>
        <div className="bg-orb bg-orb-2"></div>
        <div className="bg-orb bg-orb-3"></div>

        <nav className="top-nav">
          <button className="nav-btn" onClick={() => setPage("landing")}>
            <i className="fas fa-home"></i> Home
          </button>
          <button className="nav-btn active">
            <i className="fas fa-chart-bar"></i> Dashboard
          </button>
          <button className="nav-btn" onClick={() => setPage("home")}>
            <i className="fas fa-file-invoice"></i> Generator
          </button>
          <button
            className="nav-btn theme-toggle"
            onClick={() => setDarkMode((d) => !d)}
            title="Toggle theme"
          >
            <i className={`fas ${darkMode ? "fa-sun" : "fa-moon"}`}></i>
          </button>
        </nav>

        <Dashboard onNavigateHome={() => setPage("home")} />
      </div>
    );
  }

  // ---------- GENERATOR (default) ----------
  return (
    <div className="app-container">
      <div className="bg-orb bg-orb-1"></div>
      <div className="bg-orb bg-orb-2"></div>
      <div className="bg-orb bg-orb-3"></div>

      <nav className="top-nav">
        <button className="nav-btn" onClick={() => setPage("landing")}>
          <i className="fas fa-home"></i> Home
        </button>
        <button className="nav-btn active">
          <i className="fas fa-file-invoice"></i> Generator
        </button>
        <button className="nav-btn" onClick={() => setPage("dashboard")}>
          <i className="fas fa-chart-bar"></i> Dashboard
        </button>
        <button
          className="nav-btn theme-toggle"
          onClick={() => setDarkMode((d) => !d)}
          title="Toggle theme"
        >
          <i className={`fas ${darkMode ? "fa-sun" : "fa-moon"}`}></i>
        </button>
      </nav>

      <header className="app-header">
        <h1 className="main-title">
          <span className="title-icon">🤖</span>
          <span className="title-text">AI-Powered Invoice Generator</span>
        </h1>
        <p className="subtitle">
          Create stunning, professional invoices in seconds
        </p>
      </header>

      <div className="card glass">
        {/* Business Info */}
        <div className="form-section">
          <h2 className="section-header">
            <span className="section-icon">🏢</span> Business Info
          </h2>
          <div className="input-grid">
            <div className="input-wrapper">
              <i className="fas fa-building input-icon"></i>
              <input
                className="input-field"
                name="name"
                placeholder="Company Name"
                value={invoiceData.company.name}
                onChange={(e) => handleInputChange(e, null, "company")}
              />
            </div>
            <div className="input-wrapper">
              <i className="fas fa-map-marker-alt input-icon"></i>
              <input
                className="input-field"
                name="address"
                placeholder="Company Address"
                value={invoiceData.company.address}
                onChange={(e) => handleInputChange(e, null, "company")}
              />
            </div>
            <div className="input-wrapper">
              <i className="fas fa-envelope input-icon"></i>
              <input
                className="input-field"
                name="email"
                placeholder="Email"
                value={invoiceData.company.email}
                onChange={(e) => handleInputChange(e, null, "company")}
              />
            </div>
            <div className="input-wrapper">
              <i className="fas fa-phone input-icon"></i>
              <input
                className="input-field"
                name="phone"
                placeholder="Phone"
                value={invoiceData.company.phone}
                onChange={(e) => handleInputChange(e, null, "company")}
              />
            </div>
            <div className="input-wrapper">
              <i className="fas fa-file-invoice input-icon"></i>
              <input
                className="input-field"
                name="gst"
                placeholder="GST Number"
                value={invoiceData.company.gst}
                onChange={(e) => handleInputChange(e, null, "company")}
              />
            </div>
          </div>
        </div>

        {/* Client Info */}
        <div className="form-section">
          <h2 className="section-header">
            <span className="section-icon">👤</span> Client Info
          </h2>
          <div className="input-grid">
            <div className="input-wrapper">
              <i className="fas fa-user input-icon"></i>
              <input
                className="input-field"
                name="name"
                placeholder="Client Name"
                value={invoiceData.client.name}
                onChange={(e) => handleInputChange(e, null, "client")}
              />
            </div>
            <div className="input-wrapper">
              <i className="fas fa-map-pin input-icon"></i>
              <input
                className="input-field"
                name="address"
                placeholder="Client Address"
                value={invoiceData.client.address}
                onChange={(e) => handleInputChange(e, null, "client")}
              />
            </div>
            <div className="input-wrapper">
              <i className="fas fa-mobile-alt input-icon"></i>
              <input
                className="input-field"
                name="phone"
                placeholder="Client Phone"
                value={invoiceData.client.phone}
                onChange={(e) => handleInputChange(e, null, "client")}
              />
            </div>
          </div>
        </div>

        {/* Invoice Details */}
        <div className="form-section">
          <h2 className="section-header">
            <span className="section-icon">📋</span> Invoice Details
          </h2>
          <div className="input-grid">
            <div className="input-wrapper">
              <i className="fas fa-hashtag input-icon"></i>
              <input
                className="input-field"
                name="number"
                placeholder="Invoice #"
                value={invoiceData.invoiceMeta.number}
                onChange={(e) => handleInputChange(e, null, "invoiceMeta")}
              />
            </div>
            <div className="input-wrapper">
              <i className="fas fa-calendar-alt input-icon"></i>
              <input
                className="input-field date-field"
                type="date"
                name="date"
                value={invoiceData.invoiceMeta.date}
                onChange={(e) => handleInputChange(e, null, "invoiceMeta")}
              />
            </div>
            <div className="input-wrapper">
              <i className="fas fa-calendar-check input-icon"></i>
              <input
                className="input-field date-field"
                type="date"
                name="due"
                value={invoiceData.invoiceMeta.due}
                onChange={(e) => handleInputChange(e, null, "invoiceMeta")}
              />
            </div>
            <div className="input-wrapper">
              <i className="fas fa-credit-card input-icon"></i>
              <select
                className="input-field"
                name="terms"
                value={invoiceData.invoiceMeta.terms}
                onChange={(e) => handleInputChange(e, null, "invoiceMeta")}
              >
                <option value="">Select Payment Method</option>
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>
            <div className="input-wrapper">
              <i className="fas fa-mail-bulk input-icon"></i>
              <input
                className="input-field"
                name="po"
                placeholder="Post Office"
                value={invoiceData.invoiceMeta.po}
                onChange={(e) => handleInputChange(e, null, "invoiceMeta")}
              />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="form-section">
          <div className="items-heading-row">
            <h2 className="section-header" style={{ marginBottom: 0 }}>
              <span className="section-icon">📦</span> Items
            </h2>
            <div className="tax-mode-toggle">
              <button
                className={`pill-btn ${
                  invoiceData.taxMode === "simple" ? "active" : ""
                }`}
                onClick={() =>
                  setInvoiceData((p) => ({ ...p, taxMode: "simple" }))
                }
              >
                Simple GST
              </button>
              <button
                className={`pill-btn ${
                  invoiceData.taxMode === "split" ? "active" : ""
                }`}
                onClick={() =>
                  setInvoiceData((p) => ({ ...p, taxMode: "split" }))
                }
              >
                Per-item Tax
              </button>
            </div>
          </div>

          <div
            className={`items-header ${
              invoiceData.taxMode === "split" ? "with-tax" : ""
            }`}
          >
            <span>Description</span>
            <span>Qty</span>
            <span>Price (₹)</span>
            {invoiceData.taxMode === "split" && <span>Tax</span>}
            <span>Total</span>
            <span></span>
          </div>

          {invoiceData.items.map((item, index) => (
            <div
              className={`flex-row item-row ${
                invoiceData.taxMode === "split" ? "with-tax" : ""
              }`}
              key={index}
            >
              <input
                className="input-field"
                name="description"
                placeholder="Item description"
                value={item.description}
                onChange={(e) => handleInputChange(e, index)}
              />
              <input
                className="input-field"
                name="quantity"
                type="number"
                placeholder="0"
                value={item.quantity}
                onChange={(e) => handleInputChange(e, index)}
              />
              <input
                className="input-field"
                name="price"
                type="number"
                placeholder="0.00"
                value={item.price}
                onChange={(e) => handleInputChange(e, index)}
              />

              {invoiceData.taxMode === "split" && (
                <select
                  className="input-field tax-select"
                  name="taxType"
                  value={item.taxType || "gst18"}
                  onChange={(e) => handleInputChange(e, index)}
                >
                  <option value="gst0">0%</option>
                  <option value="gst5">GST 5%</option>
                  <option value="gst12">GST 12%</option>
                  <option value="gst18">GST 18%</option>
                  <option value="gst28">GST 28%</option>
                  <option value="cgst9">CGST 9%</option>
                  <option value="sgst9">SGST 9%</option>
                  <option value="igst18">IGST 18%</option>
                </select>
              )}

              <div className="line-total">
                ₹
                {(
                  (Number(item.quantity) || 0) * (Number(item.price) || 0)
                ).toFixed(2)}
              </div>

              <div className="item-actions">
                <button
                  className="icon-btn"
                  onClick={() => duplicateItem(index)}
                  title="Duplicate"
                >
                  <i className="fas fa-copy"></i>
                </button>
                <button
                  className="icon-btn danger"
                  onClick={() => removeItem(index)}
                  disabled={invoiceData.items.length === 1}
                  title="Remove"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>
          ))}

          <button className="button add-btn" onClick={addItem}>
            <i className="fas fa-plus-circle"></i> Add Item
          </button>
        </div>

        {/* Discount & GST */}
        <div className="form-section">
          <h2 className="section-header">
            <span className="section-icon">💰</span> Discount & GST
          </h2>
          <div className="input-grid">
            <div className="input-wrapper">
              <i className="fas fa-percent input-icon"></i>
              <input
                className="input-field"
                type="number"
                placeholder="Discount %"
                value={invoiceData.discount}
                onChange={(e) =>
                  setInvoiceData((prev) => ({
                    ...prev,
                    discount: Number(e.target.value),
                  }))
                }
              />
            </div>
            {invoiceData.taxMode === "simple" && (
              <div className="input-wrapper">
                <i className="fas fa-receipt input-icon"></i>
                <input
                  className="input-field"
                  type="number"
                  placeholder="GST %"
                  value={invoiceData.gstPercent}
                  onChange={(e) =>
                    setInvoiceData((prev) => ({
                      ...prev,
                      gstPercent: Number(e.target.value),
                    }))
                  }
                />
              </div>
            )}
          </div>
        </div>

        {/* Totals */}
        <div className="totals">
          <p>
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </p>
          <p>
            <span>Discount</span>
            <span className="negative">-₹{discountAmount.toFixed(2)}</span>
          </p>

          {invoiceData.taxMode === "simple" ? (
            <p>
              <span>GST</span>
              <span>₹{gstAmount.toFixed(2)}</span>
            </p>
          ) : (
            <>
              {cgstAmount > 0 && (
                <p>
                  <span>CGST</span>
                  <span>₹{cgstAmount.toFixed(2)}</span>
                </p>
              )}
              {sgstAmount > 0 && (
                <p>
                  <span>SGST</span>
                  <span>₹{sgstAmount.toFixed(2)}</span>
                </p>
              )}
              {igstAmount > 0 && (
                <p>
                  <span>IGST</span>
                  <span>₹{igstAmount.toFixed(2)}</span>
                </p>
              )}
              <p>
                <span>Total Tax</span>
                <span>₹{gstAmount.toFixed(2)}</span>
              </p>
            </>
          )}

          <h3>
            <span>Total</span>
            <span className="total-amount">₹{total.toFixed(2)}</span>
          </h3>
          <p className="amount-words">
            <em>{numberToWords(total)}</em>
          </p>
        </div>

        <div className="action-row">
          <button
            className="button generate-btn"
            onClick={generateInvoice}
            disabled={loading}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Generating...
              </>
            ) : (
              <>
                <i className="fas fa-rocket"></i> Generate Invoice
              </>
            )}
          </button>
          <button
            className="button reset-btn"
            onClick={resetInvoice}
            title="Reset form"
          >
            <i className="fas fa-redo-alt"></i> Reset
          </button>
        </div>
      </div>

      {generatedHtml && (
        <div className="card glass preview-card">
          <h2 className="section-header">
            <span className="section-icon">✨</span> Preview
          </h2>
          <div
            id="invoice-preview"
            className="invoice-preview"
            dangerouslySetInnerHTML={{ __html: generatedHtml }}
          />
          <div className="flex-buttons">
            <button className="button download-btn" onClick={downloadPdf}>
              <i className="fas fa-download"></i> Download PDF
            </button>
            <button className="button clear-btn" onClick={clearInvoice}>
              <i className="fas fa-trash-alt"></i> Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;