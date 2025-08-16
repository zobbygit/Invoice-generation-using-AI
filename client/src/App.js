import React, { useState } from 'react'; 
import axios from 'axios';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './App.css';

function App() {
  const [invoiceData, setInvoiceData] = useState({
    company: { name: '', address: '', email: '', phone: '' },
    client: { name: '', address: '', phone: '' },
    invoiceMeta: { number: '', date: new Date().toLocaleDateString(), due: '', terms: '', po: '' },
    items: [{ description: '', quantity: '', price: '' }],
    notes: 'Thanks for your business with us!',
    discount: 0,
  });
  const [generatedHtml, setGeneratedHtml] = useState('');
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
      items: [...prev.items, { description: '', quantity: '', price: '' }]
    }));
  };

  const calculateTotals = () => {
    const subtotal = invoiceData.items.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.price) || 0),
      0
    );
    const discountAmount = (subtotal * (invoiceData.discount || 0)) / 100;
    const total = subtotal - discountAmount;
    return { subtotal, discountAmount, total };
  };

  const generateInvoice = async () => {
    setLoading(true);
    try {
      const totals = calculateTotals();
      const response = await axios.post('http://localhost:5001/generate-invoice', {
        ...invoiceData,
        totals
      });

      let cleanedHtml = response.data.html.replace(/```html|```/g, '').trim();
      cleanedHtml = cleanedHtml.replace(/<img[^>]*>/gi, '');
      cleanedHtml = cleanedHtml.replace(/<h[1-6][^>]*>Invoice<\/h[1-6]>/i, '');
      cleanedHtml = cleanedHtml.replace(
        /<body>/i,
        `<body><h1 style="text-align:center; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">INVOICE</h1>`
      );

      setGeneratedHtml(cleanedHtml);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to generate invoice.');
    }
    setLoading(false);
  };

// Replace your old downloadPdf function with this one

const downloadPdf = () => {
  const invoiceElement = document.getElementById('invoice-preview');

  // 1. Define options for html2canvas for better quality
  const options = {
    scale: 4, // Increase scale for higher resolution
    useCORS: true, // Use this if your invoice includes images from other domains
    logging: false,
  };

  // 2. Capture the canvas using the defined options
  html2canvas(invoiceElement, options).then(canvas => {
    // 3. Get the image data from the canvas
    const imgData = canvas.toDataURL('image/png');

    // 4. Initialize jsPDF. 'p' for portrait, 'mm' for millimeters, 'a4' for page size.
    const pdf = new jsPDF('p', 'mm', 'a4');

    // 5. Define margins and calculate the usable width and height of the page
    const margin = 10; // 10mm margin on all sides
    const pdfWidth = pdf.internal.pageSize.getWidth() - (margin * 2);
    const pdfHeight = pdf.internal.pageSize.getHeight() - (margin * 2);

    // 6. Get the properties of the captured image
    const imgProps = pdf.getImageProperties(imgData);
    const imgWidth = imgProps.width;
    const imgHeight = imgProps.height;

    // 7. Calculate the aspect ratio to scale the image correctly
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const scaledWidth = imgWidth * ratio;
    const scaledHeight = imgHeight * ratio;

    // 8. Add the image to the PDF, centered and with margins
    const x = (pdf.internal.pageSize.getWidth() - scaledWidth) / 2;
    const y = margin;
    pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight);

    // 9. Save the PDF
    pdf.save(`Invoice_${invoiceData.invoiceMeta.number || '001'}.pdf`);
  });
};
  const clearInvoice = () => {
    setGeneratedHtml('');
  };

  const { subtotal, discountAmount, total } = calculateTotals();

  return (
    <div className="app-container">
      <h1 style={{ textAlign: 'center', color: '#1f2937' }}>Invoice Generator Using AI 🤖</h1>

      {/* Form Container */}
      <div className="card">
        <h2 className="section-header">Business Info</h2>
        <input className="input-field" name="name" placeholder="Company Name" value={invoiceData.company.name} onChange={e => handleInputChange(e, null, 'company')} />
        <input className="input-field" name="address" placeholder="Company Address" value={invoiceData.company.address} onChange={e => handleInputChange(e, null, 'company')} />
        <input className="input-field" name="email" placeholder="Email" value={invoiceData.company.email} onChange={e => handleInputChange(e, null, 'company')} />
        <input className="input-field" name="phone" placeholder="Phone" value={invoiceData.company.phone} onChange={e => handleInputChange(e, null, 'company')} />

        <h2 className="section-header">Client Info</h2>
        <input className="input-field" name="name" placeholder="Client Name" value={invoiceData.client.name} onChange={e => handleInputChange(e, null, 'client')} />
        <input className="input-field" name="address" placeholder="Client Address" value={invoiceData.client.address} onChange={e => handleInputChange(e, null, 'client')} />
        <input className="input-field" name="phone" placeholder="Client Phone" value={invoiceData.client.phone} onChange={e => handleInputChange(e, null, 'client')} />

        <h2 className="section-header">Invoice Details</h2>
        <input className="input-field" name="number" placeholder="Invoice #" value={invoiceData.invoiceMeta.number} onChange={e => handleInputChange(e, null, 'invoiceMeta')} />
        <input className="input-field" name="date" placeholder="Invoice Date" value={invoiceData.invoiceMeta.date} onChange={e => handleInputChange(e, null, 'invoiceMeta')} />
        <input className="input-field" name="due" placeholder="Due Date" value={invoiceData.invoiceMeta.due} onChange={e => handleInputChange(e, null, 'invoiceMeta')} />

        <select className="input-field" name="terms" value={invoiceData.invoiceMeta.terms} onChange={e => handleInputChange(e, null, 'invoiceMeta')}>
          <option value="">Select Payment Method</option>
          <option value="UPI">UPI</option>
          <option value="Cash">Cash</option>
          <option value="Debit Card">Debit Card</option>
          <option value="Bank Transfer">Bank Transfer</option>
        </select>

        <input className="input-field" name="po" placeholder="PO Number" value={invoiceData.invoiceMeta.po} onChange={e => handleInputChange(e, null, 'invoiceMeta')} />

        <h2 className="section-header">Items</h2>
        {invoiceData.items.map((item, index) => (
          <div className="flex-row" key={index}>
            <input className="input-field" name="description" placeholder="Description" value={item.description} onChange={e => handleInputChange(e, index)} />
            <input className="input-field" name="quantity" type="number" placeholder="Qty" value={item.quantity} onChange={e => handleInputChange(e, index)} />
            <input className="input-field" name="price" type="number" placeholder="Price" value={item.price} onChange={e => handleInputChange(e, index)} />
          </div>
        ))}
        <button className="button-blue" onClick={addItem}>Add Item</button>

        <h2 className="section-header">Discount (%)</h2>
        <input className="input-field" type="number" placeholder="Discount %" value={invoiceData.discount} onChange={e => setInvoiceData(prev => ({ ...prev, discount: Number(e.target.value) }))} />

        <h2 className="section-header">Totals</h2>
        <p>Subtotal: ${subtotal.toFixed(2)}</p>
        <p>Discount: -${discountAmount.toFixed(2)}</p>
        <p><strong>Total: ${total.toFixed(2)}</strong></p>

        <button className="button-green" onClick={generateInvoice} disabled={loading}>
          {loading ? 'Generating...' : 'Generate Invoice'}
        </button>
      </div>

      {/* Preview Container */}
      {generatedHtml && (
        <div className="card">
          <h2 className="section-header">Preview</h2>
          <div id="invoice-preview" className="invoice-preview" dangerouslySetInnerHTML={{ __html: generatedHtml }} />
          <div className="flex-buttons">
            <button className="button-orange" onClick={downloadPdf}>Download PDF</button>
            <button className="button-orange" style={{ backgroundColor: '#e61f1fff' }} onClick={clearInvoice}>Clear Invoice</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
