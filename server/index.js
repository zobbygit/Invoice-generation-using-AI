const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();



// In server/index.js

const allowedOrigins = [
    'http://localhost:3000', 
    // We will add your live frontend URL here later
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));



app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log('MongoDB connection error:', err));

const InvoiceSchema = new mongoose.Schema({
    clientName: String,
    invoiceHtml: String,
    createdAt: { type: Date, default: Date.now }
});
const Invoice = mongoose.model('Invoice', InvoiceSchema);

app.post('/generate-invoice', async (req, res) => {
    const { company, client, items, notes, discount, invoiceMeta, totals } = req.body;

    try {
        // FIXED: Changed to v1 API compatible model name
       model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            

        const prompt = `
            Generate a professional and modern HTML invoice with inline CSS.

            **Instructions for AI:**
            - Use the exact data provided below. Do not change or recalculate any values.
            - Create a clean layout with a header for company/client info, a main table for items, and a footer for totals and notes.
            - The items table should have columns: "Description", "Quantity", "Unit Price", and "Line Total".
            - The financial summary must be clearly displayed and highlighted.
            - The Grand Total should be the most prominent figure.
            - Return ONLY the raw HTML code, with no markdown formatting like \`\`\`html.
            - Use modern, professional styling with a color scheme (blues, grays).
            - Make it print-friendly.

            ---
            **DATA STARTS HERE**
            ---

            **Company Details:**
            - Name: ${company.name}
            - Address: ${company.address}
            - Email: ${company.email}
            - Phone: ${company.phone}

            **Client Details:**
            - Name: ${client.name}
            - Address: ${client.address}
            - Phone: ${client.phone}

            **Invoice Details:**
            - Invoice #: ${invoiceMeta.number || '001'}
            - Issue Date: ${invoiceMeta.date || new Date().toLocaleDateString()}
            - Due Date: ${invoiceMeta.due || 'Not Specified'}
            - PO Number: ${invoiceMeta.po || 'N/A'}

            **Items:**
            ${items.map((item, index) => {
                const qty = parseFloat(item.quantity || 0);
                const price = parseFloat(item.price || 0);
                const lineTotal = qty * price;
          return `- Item ${index + 1}: ${item.description}, Quantity: ${qty}, Unit Price: ₹${price.toFixed(2)}, Line Total: ₹${lineTotal.toFixed(2)}`;

            }).join('\n')}

            **Financial Summary (Use these exact values):**
            - Subtotal: ₹${totals.subtotal.toFixed(2)}
            - Discount: ${discount}% (-₹${totals.discountAmount.toFixed(2)})
            - **Grand Total: ₹${totals.total.toFixed(2)}**

 **Financial Summary:**
      - Subtotal: ₹${totals.subtotal.toFixed(2)}
      - Discount: ${discount}% (-₹${totals.discountAmount.toFixed(2)})
      - CGST (9%): ₹${(totals.subtotal * 0.09).toFixed(2)}
      - SGST (9%): ₹${(totals.subtotal * 0.09).toFixed(2)}
      - Grand Total: ₹${(totals.total + (totals.subtotal * 0.18)).toFixed(2)}

      **Bank Details:**
      - Bank Name: HDFC Bank
      - Account Number: XXXX XXXX 1234
      - IFSC Code: HDFC0001234
      - Branch: Park Street, Kolkata
      - UPI ID: zohaib@upi


      **Authorized Signature:**
      - Add a “Signature” section with a placeholder line and label "Authorized Signatory"
      - Add a "Signature" name "Zohaib Aslam" above the Authorized Signatory field(mandatory to add)





      **Footer:**
      - “Thank you for your business!”
      - “This is a computer-generated invoice — no signature required if paid digitally.”
      - Center this text at the bottom in small gray font.

  



            **Payment & Notes:**
            - Payment Method: ${invoiceMeta.terms || 'Not Specified'}
            - Notes: ${notes}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const htmlContent = response.text();

        const newInvoice = new Invoice({
            clientName: client.name,
            invoiceHtml: htmlContent
        });
        await newInvoice.save();

        res.json({ html: htmlContent });
    } catch (error) {
        console.error("Error generating invoice:", error);
        res.status(500).json({ 
            error: "Failed to generate invoice.",
            details: error.message 
        });
    }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
