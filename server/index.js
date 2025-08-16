const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
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

// In server/index.js

app.post('/generate-invoice', async (req, res) => {
    // 1. RECEIVE the pre-calculated totals from the frontend
    const { company, client, items, notes, discount, invoiceMeta, totals } = req.body;

    // The backend now trusts the frontend's calculations. No more recalculating here!

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // 2. A CLEANER and more direct prompt using the frontend's data
        const prompt = `
            Generate a professional and modern HTML invoice with inline CSS.

            **Instructions for AI:**
            - Use the exact data provided below. Do not change or recalculate any values.
            - Create a clean layout with a header for company/client info, a main table for items, and a footer for totals and notes.
            - The items table should have columns: "Description", "Quantity", "Unit Price", and "Line Total".
            - The financial summary must be clearly displayed and highlighted.
            - The Grand Total should be the most prominent figure.
            - Return ONLY the raw HTML code, with no markdown formatting like \`\`\`html.

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

            **Invoice Details:**
            - Invoice #: ${invoiceMeta.number || '001'}
            - Issue Date: ${invoiceMeta.date || new Date().toLocaleDateString()}
            - Due Date: ${invoiceMeta.due || 'Not Specified'}
            - PO Number: ${invoiceMeta.po || 'N/A'}

            **Items:**
            ${items.map(item => `- Description: ${item.description}, Quantity: ${item.quantity}, Unit Price: $${parseFloat(item.price || 0).toFixed(2)}`).join('\n')}

            **Financial Summary (Use these exact values):**
            - Subtotal: $${totals.subtotal.toFixed(2)}
            - Discount: ${discount}% (-$${totals.discountAmount.toFixed(2)})
            - **Grand Total: $${totals.total.toFixed(2)}**

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
        res.status(500).send("Failed to generate invoice.");
    }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
