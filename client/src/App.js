import React, { useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import "./App.css";

function App() {
  const [invoiceData, setInvoiceData] = useState({
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
        upi: "zohaib@upi"
      }
    },
    client: { name: "", address: "", phone: "" },
    invoiceMeta: { number: "", date: new Date().toLocaleDateString(), due: "", terms: "", po: "" },
    items: [{ description: "", quantity: "", price: "" }],
    notes: "Thanks for your business with us! Hope to see you soon.",
    discount: "",
    gstPercent: "",
  });

  const [generatedHtml, setGeneratedHtml] = useState("");
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e, index, section) => {
    const { name, value } = e.target;
    if (section) {
      setInvoiceData(prev => ({ ...prev, [section]: { ...prev[section], [name]: value } }));
    } else if (index !== undefined) {
      const newItems = [...invoiceData.items];
      newItems[index][name] = value;
      setInvoiceData(prev => ({ ...prev, items: newItems }));
    } else {
      setInvoiceData(prev => ({ ...prev, [name]: value }));
    }
  };

  const addItem = () => {
    setInvoiceData(prev => ({
      ...prev,
      items: [...prev.items, { description: "", quantity: "", price: "" }]
    }));
  };

  const calculateTotals = () => {
    const subtotal = invoiceData.items.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.price) || 0),
      0
    );
    const discountAmount = (subtotal * (invoiceData.discount || 0)) / 100;
    const gstAmount = ((subtotal - discountAmount) * (invoiceData.gstPercent || 0)) / 100;
    const total = subtotal - discountAmount + gstAmount;
    return { subtotal, discountAmount, gstAmount, total };
  };

  const generateInvoice = async () => {
    setLoading(true);
    try {
      const totals = calculateTotals();
const response = await axios.post('https://your-backend-url-goes-here/generate-invoice', {
        ...invoiceData,
        totals
      });

      let cleanedHtml = response.data.html.replace(/```html|```/g, "").trim();

      // Add QR code, bank, and GST info to invoice HTML
      const fakeQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=fake@upi&pn=${encodeURIComponent(invoiceData.company.name)}`;
      cleanedHtml = cleanedHtml.replace(
        /<\/body>/i,
        `
        <div style="text-align:center; margin-top:20px;">
          <img src="${fakeQrUrl}" alt="QR Code" style="width:120px; height:120px;"/>
          <p style="font-size:0.8rem; color:#555;">Scan for payment</p>
          <p style="font-size:0.8rem; color:#555;">
            Bank: ${invoiceData.company.bank.name} | A/C: ${invoiceData.company.bank.account} | IFSC: ${invoiceData.company.bank.ifsc}
          </p>
          <p style="font-size:0.8rem; color:#555;">GST: ${invoiceData.company.gst}</p>
        </div>
        </body>`
      );

      setGeneratedHtml(cleanedHtml);
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to generate invoice.");
    }
    setLoading(false);
  };

  const downloadPdf = () => {
    const invoiceElement = document.getElementById("invoice-preview");
    const options = { scale: 4, useCORS: true, logging: false };
    html2canvas(invoiceElement, options).then(canvas => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const margin = 10;
      const pdfWidth = pdf.internal.pageSize.getWidth() - margin * 2;
      const pdfHeight = pdf.internal.pageSize.getHeight() - margin * 2;
      const imgProps = pdf.getImageProperties(imgData);
      const ratio = Math.min(pdfWidth / imgProps.width, pdfHeight / imgProps.height);
      const scaledWidth = imgProps.width * ratio;
      const scaledHeight = imgProps.height * ratio;
      const x = (pdf.internal.pageSize.getWidth() - scaledWidth) / 2;
      const y = margin;
      pdf.addImage(imgData, "PNG", x, y, scaledWidth, scaledHeight);
      pdf.save(`Invoice_${invoiceData.invoiceMeta.number || "001"}.pdf`);
    });
  };

  const clearInvoice = () => setGeneratedHtml("");
  const { subtotal, discountAmount, gstAmount, total } = calculateTotals();

  return (
    <div className="app-container">
      <h1 className="main-title">🤖 AI-Powered Invoice Generator</h1>

      <div className="card glass">
        <h2 className="section-header">Business Info</h2>
        <input className="input-field" name="name" placeholder="Company Name" value={invoiceData.company.name} onChange={e => handleInputChange(e, null, "company")} />
        <input className="input-field" name="address" placeholder="Company Address" value={invoiceData.company.address} onChange={e => handleInputChange(e, null, "company")} />
        <input className="input-field" name="email" placeholder="Email" value={invoiceData.company.email} onChange={e => handleInputChange(e, null, "company")} />
        <input className="input-field" name="phone" placeholder="Phone" value={invoiceData.company.phone} onChange={e => handleInputChange(e, null, "company")} />
        <input className="input-field" name="gst" placeholder="GST Number" value={invoiceData.company.gst} onChange={e => handleInputChange(e, null, "company")} />

        <h2 className="section-header">Client Info</h2>
        <input className="input-field" name="name" placeholder="Client Name" value={invoiceData.client.name} onChange={e => handleInputChange(e, null, "client")} />
        <input className="input-field" name="address" placeholder="Client Address" value={invoiceData.client.address} onChange={e => handleInputChange(e, null, "client")} />
        <input className="input-field" name="phone" placeholder="Client Phone" value={invoiceData.client.phone} onChange={e => handleInputChange(e, null, "client")} />

        <h2 className="section-header">Invoice Details</h2>
        <input className="input-field" name="number" placeholder="Invoice #" value={invoiceData.invoiceMeta.number} onChange={e => handleInputChange(e, null, "invoiceMeta")} />
        <input className="input-field" name="date" placeholder="Invoice Date" value={invoiceData.invoiceMeta.date} onChange={e => handleInputChange(e, null, "invoiceMeta")} />
        <input className="input-field" name="due" placeholder="Due Date" value={invoiceData.invoiceMeta.due} onChange={e => handleInputChange(e, null, "invoiceMeta")} />
        <select className="input-field" name="terms" value={invoiceData.invoiceMeta.terms} onChange={e => handleInputChange(e, null, "invoiceMeta")}>
          <option value="">Select Payment Method</option>
          <option value="UPI">UPI</option>
          <option value="Cash">Cash</option>
          <option value="Debit Card">Debit Card</option>
          <option value="Credit Card">Credit Card</option>
          <option value="Bank Transfer">Bank Transfer</option>
        </select>
        <input className="input-field" name="po" placeholder="Post Office" value={invoiceData.invoiceMeta.po} onChange={e => handleInputChange(e, null, "invoiceMeta")} />

        <h2 className="section-header">Items</h2>
        {invoiceData.items.map((item, index) => (
          <div className="flex-row" key={index}>
            <input className="input-field" name="description" placeholder="Description" value={item.description} onChange={e => handleInputChange(e, index)} />
            <input className="input-field" name="quantity" type="number" placeholder="Qty" value={item.quantity} onChange={e => handleInputChange(e, index)} />
            <input className="input-field" name="price" type="number" placeholder="Price (₹)" value={item.price} onChange={e => handleInputChange(e, index)} />
          </div>
        ))}
        <button className="button add-btn" onClick={addItem}>+ Add Item</button>

        <h2 className="section-header">Discount & GST</h2>
        <input className="input-field" type="number" placeholder="Discount %" value={invoiceData.discount} onChange={e => setInvoiceData(prev => ({ ...prev, discount: Number(e.target.value) }))} />
        <input className="input-field" type="number" placeholder="GST %" value={invoiceData.gstPercent} onChange={e => setInvoiceData(prev => ({ ...prev, gstPercent: Number(e.target.value) }))} />

        <div className="totals">
          <p>Subtotal: ₹{subtotal.toFixed(2)}</p>
          <p>Discount: -₹{discountAmount.toFixed(2)}</p>
          <p>GST: ₹{gstAmount.toFixed(2)}</p>
          <h3>Total: ₹{total.toFixed(2)}</h3>
        </div>

        <button className="button generate-btn" onClick={generateInvoice} disabled={loading}>
          {loading ? "Generating..." : "🚀 Generate Invoice"}
        </button>
      </div>

      {generatedHtml && (
        <div className="card glass preview-card">
          <h2 className="section-header">Preview</h2>
          <div id="invoice-preview" className="invoice-preview" dangerouslySetInnerHTML={{ __html: generatedHtml }} />
          <div className="flex-buttons">
            <button className="button download-btn" onClick={downloadPdf}>⬇ Download PDF</button>
            <button className="button clear-btn" onClick={clearInvoice}>🗑 Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
