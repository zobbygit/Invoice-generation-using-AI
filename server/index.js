import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();

// ===============================
// MIDDLEWARE
// ===============================
app.use(express.json({ limit: "2mb" }));

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://invoice-generation-live.onrender.com",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ===============================
// ENV
// ===============================
const PORT = process.env.PORT || 5001;
const HF_TOKEN = process.env.HF_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

const HF_BASE_URL = "https://router.huggingface.co/v1";

if (!HF_TOKEN) console.error("❌ HF_TOKEN is missing");
if (!MONGO_URI) console.error("❌ MONGO_URI is missing");

// ===============================
// HUGGING FACE CLIENT
// ===============================
const openai = new OpenAI({
  apiKey: HF_TOKEN,
  baseURL: HF_BASE_URL,
});

// ===============================
// MONGODB
// ===============================
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err.message));

// ===============================
// INVOICE SCHEMA
// ===============================
const InvoiceSchema = new mongoose.Schema({
  clientName: {
    type: String,
    required: true,
    index: true,
  },

  invoiceNumber: {
    type: String,
    index: true,
  },

  companyName: {
    type: String,
  },

  totals: {
    subtotal: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },

  snapshot: {
    type: mongoose.Schema.Types.Mixed,
  },

  invoiceHtml: {
    type: String,
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

const Invoice = mongoose.model("Invoice", InvoiceSchema);

// ===============================
// FREE MODEL CACHE
// ===============================
let modelCache = [];
let modelCacheTime = 0;
const MODEL_CACHE_TTL = 10 * 60 * 1000;

// ===============================
// CHECK FREE PROVIDER
// ===============================
function isFreeProvider(provider) {
  if (!provider) return false;
  if (provider.is_free === true) return true;
  const inputPrice = Number(provider?.pricing?.input);
  const outputPrice = Number(provider?.pricing?.output);
  return inputPrice === 0 && outputPrice === 0;
}

// ===============================
// FETCH FREE MODELS
// ===============================
async function fetchFreeModels(forceRefresh = false) {
  const now = Date.now();

  if (
    !forceRefresh &&
    modelCache.length > 0 &&
    now - modelCacheTime < MODEL_CACHE_TTL
  ) {
    return modelCache;
  }

  if (!HF_TOKEN) {
    throw new Error("HF_TOKEN is missing from environment variables.");
  }

  console.log("🔎 Fetching Hugging Face models...");

  const response = await fetch(`${HF_BASE_URL}/models`, {
    method: "GET",
    headers: { Authorization: `Bearer ${HF_TOKEN}` },
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `HF returned invalid JSON. HTTP ${response.status}: ${text.slice(0, 500)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `HF /models failed HTTP ${response.status}: ${
        data?.error || text.slice(0, 500)
      }`
    );
  }

  const models = Array.isArray(data?.data) ? data.data : [];
  const freeProviders = [];

  for (const model of models) {
    const providers = Array.isArray(model.providers) ? model.providers : [];
    for (const provider of providers) {
      if (provider.status !== "live") continue;
      if (!isFreeProvider(provider)) continue;

      freeProviders.push({
        id: model.id,
        model: `${model.id}:${provider.provider}`,
        provider: provider.provider,
        contextLength:
          provider.context_length || model.context_length || null,
        isFree: provider.is_free === true,
        pricing: provider.pricing || null,
      });
    }
  }

  const unique = Array.from(
    new Map(
      freeProviders.map((item) => [`${item.id}:${item.provider}`, item])
    ).values()
  );

  modelCache = unique;
  modelCacheTime = now;

  console.log(`✅ Found ${unique.length} free model providers`);
  return unique;
}

// ===============================
// MODEL SCORING
// ===============================
function scoreModel(item) {
  const name = item.model.toLowerCase();
  let score = 0;

  if (name.includes("gpt-oss")) score += 100;
  if (name.includes("qwen")) score += 80;
  if (name.includes("llama")) score += 70;
  if (name.includes("mistral")) score += 60;
  if (name.includes("gemma")) score += 50;

  if (name.includes("120b")) score += 30;
  if (name.includes("70b")) score += 25;
  if (name.includes("32b")) score += 20;
  if (name.includes("27b")) score += 15;
  if (name.includes("14b")) score += 10;

  return score;
}

async function getRoutableModels() {
  const models = await fetchFreeModels();
  return [...models].sort((a, b) => scoreModel(b) - scoreModel(a));
}

// ===============================
// GENERATE WITH FALLBACK
// ===============================
async function generateWithRouter(prompt) {
  const models = await getRoutableModels();

  if (!models.length) {
    throw new Error(
      "No currently-free HF Inference Provider models are available."
    );
  }

  let lastError = null;

  for (const item of models) {
    try {
      console.log(`🤖 Trying: ${item.model}`);

      const completion = await openai.chat.completions.create({
        model: item.model,
        messages: [
          {
            role: "system",
            content:
              "You generate clean professional HTML invoices. Return ONLY valid HTML. Do not use Markdown fences.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 5000,
      });

      const content = completion?.choices?.[0]?.message?.content;
      if (!content) throw new Error("Model returned an empty response.");

      console.log(`✅ Successful model: ${item.model}`);
      return { html: content, model: item.model, provider: item.provider };
    } catch (error) {
      lastError = error;
      console.error(`❌ Failed model ${item.model}:`, error?.message || error);
    }
  }

  throw new Error(
    `All free HF models failed. Last error: ${
      lastError?.message || "Unknown error"
    }`
  );
}

// ===============================
// CLEAN HTML
// ===============================
function cleanHtml(html) {
  return html.replace(/```html/gi, "").replace(/```/g, "").trim();
}

// ===============================
// HEALTH CHECK
// ===============================
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Invoice Generator API",
    ai: "Hugging Face Inference Providers",
  });
});

// ===============================
// DEBUG HUGGING FACE
// ===============================
app.get("/debug/huggingface", async (req, res) => {
  try {
    if (!HF_TOKEN) {
      return res
        .status(500)
        .json({ success: false, error: "HF_TOKEN is missing." });
    }

    const response = await fetch(`${HF_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${HF_TOKEN}` },
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(response.status).json({
        success: false,
        status: response.status,
        raw: text.slice(0, 1000),
      });
    }

    const models = Array.isArray(data?.data) ? data.data : [];
    const free = [];

    for (const model of models) {
      for (const provider of model.providers || []) {
        if (provider.status === "live" && isFreeProvider(provider)) {
          free.push({
            model: model.id,
            provider: provider.provider,
            is_free: provider.is_free ?? null,
            pricing: provider.pricing ?? null,
            context_length:
              provider.context_length ?? model.context_length ?? null,
          });
        }
      }
    }

    res.status(response.status).json({
      success: response.ok,
      huggingfaceStatus: response.status,
      totalModels: models.length,
      freeProviderCount: free.length,
      freeProviders: free,
      rawError: response.ok ? null : data?.error || data,
    });
  } catch (error) {
    console.error("HF DEBUG ERROR:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// LIST FREE MODELS
// ===============================
app.get("/ai/models", async (req, res) => {
  try {
    const models = await getRoutableModels();
    res.json({ success: true, count: models.length, models });
  } catch (error) {
    console.error("MODEL LIST ERROR:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// REFRESH MODELS
// ===============================
app.post("/ai/models/refresh", async (req, res) => {
  try {
    const models = await fetchFreeModels(true);
    res.json({ success: true, count: models.length, models });
  } catch (error) {
    console.error("MODEL REFRESH ERROR:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// GENERATE INVOICE
// ===============================
app.post("/generate-invoice", async (req, res) => {
  try {
    console.log("====================================");
    console.log("📄 GENERATE INVOICE REQUEST");
    console.log("====================================");

    const {
      company,
      client,
      invoiceMeta,
      items,
      notes,
      discount,
      gstPercent,
      totals,
      taxMode,
    } = req.body;

    if (!company?.name) {
      return res.status(400).json({ error: "Company name is required." });
    }
    if (!client?.name) {
      return res.status(400).json({ error: "Client name is required." });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: "At least one invoice item is required." });
    }

    // Human-readable tax label per item
    const taxLabel = (taxType) => {
      const map = {
        gst0: "GST 0%",
        gst5: "GST 5%",
        gst12: "GST 12%",
        gst18: "GST 18%",
        gst28: "GST 28%",
        cgst9: "CGST 9%",
        sgst9: "SGST 9%",
        igst18: "IGST 18%",
      };
      return map[taxType] || "GST 0%";
    };

    // Build tax breakdown block for the prompt
    const taxModeUsed = taxMode || "simple";
    let taxBreakdownText = "";

    if (taxModeUsed === "simple") {
      taxBreakdownText = `GST (${gstPercent || 0}%): ₹${
        totals?.gstAmount ?? 0
      }`;
    } else {
      const lines = [];
      if ((totals?.cgstAmount || 0) > 0)
        lines.push(`CGST: ₹${totals.cgstAmount}`);
      if ((totals?.sgstAmount || 0) > 0)
        lines.push(`SGST: ₹${totals.sgstAmount}`);
      if ((totals?.igstAmount || 0) > 0)
        lines.push(`IGST: ₹${totals.igstAmount}`);
      lines.push(`Total Tax: ₹${totals?.gstAmount ?? 0}`);
      taxBreakdownText = lines.join("\n");
    }

    // Amount in words (mirror of frontend)
    const numberToWords = (num) => {
      const a = [
        "",
        "One",
        "Two",
        "Three",
        "Four",
        "Five",
        "Six",
        "Seven",
        "Eight",
        "Nine",
        "Ten",
        "Eleven",
        "Twelve",
        "Thirteen",
        "Fourteen",
        "Fifteen",
        "Sixteen",
        "Seventeen",
        "Eighteen",
        "Nineteen",
      ];
      const b = [
        "",
        "",
        "Twenty",
        "Thirty",
        "Forty",
        "Fifty",
        "Sixty",
        "Seventy",
        "Eighty",
        "Ninety",
      ];
      const inWords = (n) => {
        if (n < 20) return a[n];
        if (n < 100)
          return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
        if (n < 1000)
          return (
            a[Math.floor(n / 100)] +
            " Hundred" +
            (n % 100 ? " " + inWords(n % 100) : "")
          );
        if (n < 100000)
          return (
            inWords(Math.floor(n / 1000)) +
            " Thousand" +
            (n % 1000 ? " " + inWords(n % 1000) : "")
          );
        if (n < 10000000)
          return (
            inWords(Math.floor(n / 100000)) +
            " Lakh" +
            (n % 100000 ? " " + inWords(n % 100000) : "")
          );
        return (
          inWords(Math.floor(n / 10000000)) +
          " Crore" +
          (n % 10000000 ? " " + inWords(n % 10000000) : "")
        );
      };
      const rupees = Math.floor(num || 0);
      const paise = Math.round(((num || 0) - rupees) * 100);
      let result = rupees ? inWords(rupees) + " Rupees" : "";
      if (paise) result += (result ? " and " : "") + inWords(paise) + " Paise";
      return result ? result + " Only" : "Zero Rupees Only";
    };

    const amountInWords = numberToWords(totals?.total ?? 0);

    const prompt = `
Create a professional, modern, print-ready HTML invoice.

IMPORTANT:
- Return ONLY HTML.
- Do NOT return Markdown.
- Do NOT use \`\`\`.
- Do NOT explain anything.
- Do NOT recalculate financial totals.
- Use the exact totals supplied below.
- Do not invent financial information.
- Make the invoice visually polished.
- Use ONLY inline CSS (style="..."). Do NOT use <style> tags.
- Do NOT include <html>, <head>, or <body> tags. Return only the inner content.
- Make it suitable for A4 PDF printing.

COMPANY INFORMATION:
Company Name: ${company.name}
Address: ${company.address || ""}
Email: ${company.email || ""}
Phone: ${company.phone || ""}
GST: ${company.gst || ""}

BANK INFORMATION:
Bank: ${company.bank?.name || ""}
Account: ${company.bank?.account || ""}
IFSC: ${company.bank?.ifsc || ""}
Branch: ${company.bank?.branch || ""}
UPI: ${company.bank?.upi || ""}

CLIENT INFORMATION:
Client Name: ${client.name}
Address: ${client.address || ""}
Phone: ${client.phone || ""}

INVOICE INFORMATION:
Invoice Number: ${invoiceMeta?.number || ""}
Invoice Date: ${invoiceMeta?.date || ""}
Due Date: ${invoiceMeta?.due || ""}
Payment Terms: ${invoiceMeta?.terms || ""}
PO Number: ${invoiceMeta?.po || ""}

ITEMS:
${items
  .map(
    (item, index) => `
${index + 1}. ${item.description || "Item"}
Quantity: ${item.quantity || 0}
Unit Price: ${item.price || 0}
${taxModeUsed === "split" ? `Tax: ${taxLabel(item.taxType)}` : ""}
Line Total: ₹${(
      (Number(item.quantity) || 0) * (Number(item.price) || 0)
    ).toFixed(2)}
`
  )
  .join("\n")}

DISCOUNT:
${discount || 0}%

TAX MODE:
${
  taxModeUsed === "simple"
    ? `Simple GST (${gstPercent || 0}%)`
    : "Per-item Tax (CGST / SGST / IGST)"
}

EXACT FINANCIAL TOTALS:
Subtotal: ${totals?.subtotal ?? 0}
Discount Amount: ${totals?.discountAmount ?? 0}
${taxBreakdownText}
Grand Total: ${totals?.total ?? 0}
Amount in Words: ${amountInWords}

NOTES:
${notes || ""}

SIGNATURE:
Zohaib Aslam
Authorized Signatory

The invoice should contain:

1. Company header
2. Client/billing section
3. Invoice metadata
4. Professional item table (include Tax column when in per-item tax mode)
5. Subtotal
6. Discount
7. ${taxModeUsed === "simple" ? "GST" : "CGST / SGST / IGST breakdown"}
8. Grand total
9. Amount in words
10. Bank/payment details
11. Notes
12. Authorized signature section
13. Professional footer

Use a clean professional business-invoice design.
`;

    const result = await generateWithRouter(prompt);
    const cleanedHtml = cleanHtml(result.html);

    // Save invoice
    const invoice = new Invoice({
      clientName: client.name,
      invoiceNumber: invoiceMeta?.number || "",
      companyName: company.name,
      totals: {
        subtotal: totals?.subtotal ?? 0,
        discountAmount: totals?.discountAmount ?? 0,
        gstAmount: totals?.gstAmount ?? 0,
        cgstAmount: totals?.cgstAmount ?? 0,
        sgstAmount: totals?.sgstAmount ?? 0,
        igstAmount: totals?.igstAmount ?? 0,
        total: totals?.total ?? 0,
      },
      snapshot: {
        company,
        client,
        invoiceMeta,
        items,
        notes,
        discount,
        gstPercent,
        taxMode: taxModeUsed,
      },
      invoiceHtml: cleanedHtml,
    });

    await invoice.save();

    console.log("✅ Invoice saved to MongoDB");
    console.log(`🤖 Model: ${result.model}`);
    console.log(`🏭 Provider: ${result.provider}`);
    console.log(`💰 Total: ₹${totals?.total ?? 0}`);

    res.json({
      success: true,
      html: cleanedHtml,
      model: result.model,
      provider: result.provider,
      invoiceId: invoice._id,
    });
  } catch (error) {
    console.error("====================================");
    console.error("❌ GENERATE INVOICE ERROR");
    console.error("====================================");
    console.error(error);
    console.error(error?.stack);

    res.status(500).json({
      success: false,
      error: error?.message || "Failed to generate invoice.",
      details: error?.response?.data || null,
    });
  }
});

// ===============================
// LIST INVOICES (with filters + pagination)
// ===============================
app.get("/invoices", async (req, res) => {
  try {
    const { page = 1, limit = 20, client, from, to, search } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const filter = {};

    if (client) filter.clientName = new RegExp(client, "i");

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    if (search) {
      filter.$or = [
        { clientName: new RegExp(search, "i") },
        { invoiceNumber: new RegExp(search, "i") },
        { companyName: new RegExp(search, "i") },
      ];
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .select("-invoiceHtml -snapshot"),
      Invoice.countDocuments(filter),
    ]);

    res.json({
      success: true,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
      invoices,
    });
  } catch (error) {
    console.error("LIST INVOICES ERROR:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// GET SINGLE INVOICE
// ===============================
app.get("/invoices/:id", async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res
        .status(404)
        .json({ success: false, error: "Invoice not found" });
    }
    res.json({ success: true, invoice });
  } catch (error) {
    console.error("GET INVOICE ERROR:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// DELETE INVOICE
// ===============================
app.delete("/invoices/:id", async (req, res) => {
  try {
    const deleted = await Invoice.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, error: "Invoice not found" });
    }
    res.json({ success: true, message: "Invoice deleted" });
  } catch (error) {
    console.error("DELETE INVOICE ERROR:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// STATS FOR DASHBOARD
// ===============================
app.get("/stats", async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );
    const endOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59
    );
    const last14Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [allAgg, monthAgg, lastMonthAgg] = await Promise.all([
      Invoice.aggregate([
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: { $sum: "$totals.total" },
            avg: { $avg: "$totals.total" },
          },
        },
      ]),
      Invoice.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: { $sum: "$totals.total" },
          },
        },
      ]),
      Invoice.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: { $sum: "$totals.total" },
          },
        },
      ]),
    ]);

    // Last 14 days grouped by day
    const daily = await Invoice.aggregate([
      { $match: { createdAt: { $gte: last14Days } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          total: { $sum: "$totals.total" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const all = allAgg[0] || { count: 0, total: 0, avg: 0 };
    const month = monthAgg[0] || { count: 0, total: 0 };
    const lastMonth = lastMonthAgg[0] || { count: 0, total: 0 };

    const growth =
      lastMonth.total > 0
        ? ((month.total - lastMonth.total) / lastMonth.total) * 100
        : month.total > 0
        ? 100
        : 0;

    res.json({
      success: true,
      stats: {
        totalCount: all.count,
        totalRevenue: all.total,
        avgInvoice: all.avg || 0,
        monthCount: month.count,
        monthRevenue: month.total,
        lastMonthRevenue: lastMonth.total,
        growthPercent: Number(growth.toFixed(2)),
        daily,
      },
    });
  } catch (error) {
    console.error("STATS ERROR:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===============================
// START SERVER
// ===============================
app.listen(PORT, () => {
  console.log("====================================");
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("🤖 AI: Hugging Face");
  console.log("====================================");
});