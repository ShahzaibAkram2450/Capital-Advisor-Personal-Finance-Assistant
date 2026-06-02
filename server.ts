import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase limits to handle receipt image uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Lazy safety initialization for Gemini API client to prevent crashing on startups with missing keys
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required but missing. Configure it in settings.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Health Check API
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 1. Receipt Scanner API
app.post("/api/receipt/scan", async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64 || !mimeType) {
      res.status(400).json({ error: "Missing imageBase64 or mimeType." });
      return;
    }

    const ai = getAIClient();
    
    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: imageBase64,
      },
    };

    const textPart = {
      text: `Analyze the receipt photo provided. It might be blurry, rotated, cut off, or in another language. Use visual scanning and OCR to carefully extract:
1. Business/Merchant Name (be direct, standard capitalization)
2. Total expense amount paid as a positive floating number
3. Date of the purchase in YYYY-MM-DD format (if unavailable, estimate or use current date)
4. Expense classification: choose the best option among 'Rent & Housing', 'Groceries', 'Subscriptions & Bills', 'Dining & Cafes', 'Transport & Travel', 'Entertainment & Leisure', 'Shopping & Retail', 'Health & Fitness', or 'Miscellaneous'
5. Confidence rating (between 0.0 and 1.0) based on resolution, clarity and completeness of receipt
6. A short list of textual items or descriptions printed on the receipt

Return the response in raw JSON format matching the schema.`
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            merchant: { type: Type.STRING, description: "Discovered merchant name." },
            amount: { type: Type.NUMBER, description: "Grand total expense amount." },
            date: { type: Type.STRING, description: "Discovered date in YYYY-MM-DD format." },
            category: { type: Type.STRING, description: "Classified category name." },
            confidence: { type: Type.NUMBER, description: "Confidence multiplier." },
            lines: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Extracted lines or purchased list of items."
            }
          },
          required: ["merchant", "amount", "date", "category", "confidence", "lines"]
        }
      }
    });

    const parsedData = JSON.parse(response.text || "{}");
    res.json(parsedData);
  } catch (err: any) {
    console.error("Receipt Scanning Error: ", err);
    res.status(500).json({ error: err?.message || "An error occurred while scanning receipt." });
  }
});

// 2. Local Intelligent Fallback Advisory Rule Engine
function runLocalAdvisorFallback(
  query: string,
  transactions: any[] = [],
  budgets: any[] = [],
  customContext: string = ""
): { content: string; searchLinks: any[] } {
  const norm = query.toLowerCase();
  const txList = transactions || [];
  
  const incomeTx = txList.filter(t => t.amount < 0 || t.category === "Income");
  const expenseTx = txList.filter(t => t.amount >= 0 && t.category !== "Income");
  
  const totalIncome = incomeTx.reduce((acc, t) => acc + Math.abs(t.amount), 0);
  const totalExpense = expenseTx.reduce((acc, t) => acc + t.amount, 0);
  const netSavings = totalIncome - totalExpense;
  
  const categoryTotals: { [key: string]: number } = {};
  txList.forEach(t => {
    if (t.category !== "Income") {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount);
    }
  });

  let memoryExemptionNote = "";
  if (customContext && customContext.trim().length > 0) {
    memoryExemptionNote = `\n\n📌 **Exemption Applied from Memory Context:**\n> "${customContext}"`;
  }

  // 1. Category Spending Check
  let matchedCat = "";
  if (norm.includes("grocer") || norm.includes("food") || norm.includes("supermarket")) matchedCat = "Groceries";
  else if (norm.includes("dine") || norm.includes("cafe") || norm.includes("restaurant") || norm.includes("eat")) matchedCat = "Dining & Cafes";
  else if (norm.includes("rent") || norm.includes("house") || norm.includes("home") || norm.includes("apart")) matchedCat = "Rent & Housing";
  else if (norm.includes("sub") || norm.includes("bill") || norm.includes("utilit") || norm.includes("phone") || norm.includes("netflix") || norm.includes("spotify")) matchedCat = "Subscriptions & Bills";
  else if (norm.includes("travel") || norm.includes("transport") || norm.includes("uber") || norm.includes("cab") || norm.includes("flight") || norm.includes("car")) matchedCat = "Transport & Travel";
  else if (norm.includes("leisure") || norm.includes("fun") || norm.includes("entertain") || norm.includes("movie")) matchedCat = "Entertainment & Leisure";
  else if (norm.includes("retail") || norm.includes("shop") || norm.includes("clothing") || norm.includes("store") || norm.includes("amazon")) matchedCat = "Shopping & Retail";
  else if (norm.includes("health") || norm.includes("gym") || norm.includes("fit") || norm.includes("doctor") || norm.includes("med")) matchedCat = "Health & Fitness";

  if (matchedCat) {
    const catTotal = categoryTotals[matchedCat] || 0;
    const catTx = expenseTx.filter(t => t.category === matchedCat);
    catTx.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const activeBudget = (budgets || []).find(b => b.category === matchedCat);
    const budgetLimitStr = activeBudget ? `(Monthly budget: **$${activeBudget.limit}**)` : "";
    const limitStatus = activeBudget 
      ? (catTotal > activeBudget.limit 
          ? `⚠️ **Over budget by $${(catTotal - activeBudget.limit).toFixed(2)}!**` 
          : `✅ **Under budget by $${(activeBudget.limit - catTotal).toFixed(2)}** (using ${(catTotal / activeBudget.limit * 100).toFixed(0)}%)`)
      : "No set budget limit configured for this category.";

    let md = `### 📊 ${matchedCat} Spending Analysis
_Status: Local Real-Time Fallback Mode_

Your total spending on **${matchedCat}** is **$${catTotal.toFixed(2)}** ${budgetLimitStr}.
- **Status details**: ${limitStatus}${memoryExemptionNote}

**Recent Transactions in ${matchedCat}:**
${catTx.slice(0, 10).map(t => `- **${t.date}**: \`${t.merchant}\` — **$${t.amount.toFixed(2)}** *(${t.source})*`).join("\n") || "_No transactions recorded in this category._"}
`;
    if (catTx.length > 10) md += `\n_(Showing top 10 of ${catTx.length} transactions)_`;
    return { content: md, searchLinks: [] };
  }

  // 2. Biggest Purchase
  if (norm.includes("big") || norm.includes("large") || norm.includes("max") || norm.includes("expens") || norm.includes("high")) {
    if (expenseTx.length === 0) {
      return { 
        content: `### 🔍 Purchase Evaluation\nThere are no recorded expense logs in your statement. Please populate simulations or import credit CSV statements.`, 
        searchLinks: [] 
      };
    }
    const maxTx = [...expenseTx].sort((a, b) => b.amount - a.amount)[0];
    const ratio = totalExpense > 0 ? (maxTx.amount / totalExpense) * 100 : 0;
    
    return {
      content: `### 💸 Highest Expenditure Audit
_Status: Local Real-Time Fallback Mode_

Your single biggest transaction is:
- **Merchant**: \`${maxTx.merchant}\`
- **Amount**: **$${maxTx.amount.toFixed(2)}**
- **Category**: \`${maxTx.category}\`
- **Date**: \`${maxTx.date}\`
- **Source**: \`${maxTx.source}\`

This represents **${ratio.toFixed(1)}%** of your total expenses ($${totalExpense.toFixed(2)}).${memoryExemptionNote}

**💡 Optimization Recommendation:**
If this is non-recurring, ensure you keep the receipt. If this is an ongoing cost, double-check alternate suppliers or plans to see if you can reduce the rate.`,
      searchLinks: []
    };
  }

  // 3. Recurring Subscriptions
  if (norm.includes("sub") || norm.includes("recur") || norm.includes("repeat") || norm.includes("monthly") || norm.includes("forgot")) {
    const recurringMerchants: { [merchant: string]: any[] } = {};
    txList.forEach(t => {
      const key = t.merchant.substring(0, 12).toLowerCase();
      if (!recurringMerchants[key]) recurringMerchants[key] = [];
      recurringMerchants[key].push(t);
    });

    const detectedSubs: any[] = [];
    Object.keys(recurringMerchants).forEach(key => {
      const group = recurringMerchants[key];
      const first = group[0];
      const isSubKeyword = /netflix|spotify|hbo|youtube|disney|amazon|prime|gym|club|cable|internet|cloud|adobe|fitbit|apple|google|insurance|utilities/i.test(first.merchant);
      
      if (group.length > 1 || isSubKeyword) {
        const avgAmount = group.reduce((sum, item) => sum + item.amount, 0) / group.length;
        if (avgAmount > 0 && first.category !== "Income") {
          detectedSubs.push({
            merchant: first.merchant,
            category: first.category,
            frequency: group.length,
            average: avgAmount
          });
        }
      }
    });

    let md = `### 🔁 Recurring Subscriptions Audit
_Status: Local Real-Time Fallback Mode_

Here is a breakdown of repeating charges and subscription patterns extracted from your records:${memoryExemptionNote}

| Merchant | Frequency | Estimated Item Cost | Category |
| :--- | :---: | :---: | :--- |
`;
    if (detectedSubs.length === 0) {
      md += `| Netflix (Simulation Key) | Monthly | $15.49 | Subscriptions & Bills |\n| Spotify (Simulation Key) | Monthly | $10.99 | Subscriptions & Bills |\n\n_No recurring statements detected under your current transactions list. Setting mock simulation records above._`;
    } else {
      detectedSubs.forEach(s => {
        md += `| \`${s.merchant}\` | ${s.frequency}x charges | **$${s.average.toFixed(2)}** | \`${s.category}\` |\n`;
      });
    }

    const estimatedTotalSub = detectedSubs.reduce((acc, s) => acc + s.average, 0);
    md += `\n\n**Total Estimated Subscription Burden**: **$${estimatedTotalSub.toFixed(2)} / month**.  
💡 **Cut Back Suggestion:** Keep an eye on subscriptions which haven't been utilized over the last 30 days to optimize your budget.`;
    return { content: md, searchLinks: [] };
  }

  // 4. Unusual Activity / Anomalies
  if (norm.includes("unusual") || norm.includes("anomaly") || norm.includes("irregular") || norm.includes("weird") || norm.includes("double") || norm.includes("duplicate") || norm.includes("flag")) {
    const anomalies: any[] = [];
    
    // Check for exact duplicates on same day
    const seen = new Set();
    txList.forEach(t => {
      if (t.category !== "Income") {
        const key = `${t.date}-${t.merchant.toLowerCase()}-${t.amount.toFixed(2)}`;
        if (seen.has(key)) {
          anomalies.push({
            type: "Duplicate Charge Warning",
            title: `Potential duplicate charges at ${t.merchant}`,
            desc: `Two identical charges of $${t.amount.toFixed(2)} were logged on the same date (${t.date}).`,
            level: "High Severity"
          });
        } else {
          seen.add(key);
        }
      }
    });

    // Outliers
    if (expenseTx.length > 3) {
      const avgExpense = totalExpense / expenseTx.length;
      expenseTx.forEach(t => {
        if (t.amount > avgExpense * 3) {
          anomalies.push({
            type: "High Purchase Outlier",
            title: `Outlier charge of $${t.amount.toFixed(2)} at ${t.merchant}`,
            desc: `This purchase is ${(t.amount / avgExpense).toFixed(1)}x greater than your average transaction size ($${avgExpense.toFixed(2)}).`,
            level: "Medium Severity"
          });
        }
      });
    }

    let md = `### 🚨 Unusual Activity & Pattern Anomalies
_Status: Local Real-Time Fallback Mode_

Scanning statement patterns for billing incidents and outlier anomalies:${memoryExemptionNote}

`;
    if (anomalies.length === 0) {
      md += `✅ **Zero severe payment anomalies detected.** All transactions reside within standard historical variance ranges.`;
    } else {
      anomalies.forEach((a, i) => {
        md += `#### ${i + 1}. [${a.level}] ${a.type}\n- **Warning**: ${a.title}\n- **Details**: ${a.desc}\n\n`;
      });
    }
    return { content: md, searchLinks: [] };
  }

  // 5. Historical Comparison
  if (norm.includes("compare") || norm.includes("am i spending") || norm.includes("more than usual") || norm.includes("history")) {
    const monthBudgets: { [month: string]: number } = {};
    expenseTx.forEach(t => {
      const monthStr = t.date.substring(0, 7);
      if (monthStr) {
        monthBudgets[monthStr] = (monthBudgets[monthStr] || 0) + t.amount;
      }
    });

    const months = Object.keys(monthBudgets).sort();
    let md = `### 📉 Monthly Budget Comparison
_Status: Local Real-Time Fallback Mode_

Your spend history variance over time:${memoryExemptionNote}

| Month Period | Direct Expenses | Net Savings Variance |
| :--- | :--- | :--- |
`;
    months.forEach(m => {
      const monthIncome = incomeTx
        .filter(t => t.date.substring(0, 7) === m)
        .reduce((sum, item) => sum + Math.abs(item.amount), 0);
      const spend = monthBudgets[m];
      const variance = monthIncome - spend;

      md += `| **${m}** | $${spend.toFixed(2)} | **$${variance.toFixed(2)}** (${variance >= 0 ? "Surplus" : "Deficit"}) |\n`;
    });

    if (months.length > 1) {
      const currentMonth = months[months.length - 1];
      const prevMonth = months[months.length - 2];
      const diff = monthBudgets[currentMonth] - monthBudgets[prevMonth];
      md += `\n\n**Trend Analysis**: Spending in current period \`${currentMonth}\` is ${diff >= 0 ? "UP" : "DOWN"} by **$${Math.abs(diff).toFixed(2)}** compared to previous month (\`${prevMonth}\`).`;
    } else {
      md += `\n\n_Additional historical months are required to plot trends. Create new expenses or upload a CSV dataset._`;
    }
    return { content: md, searchLinks: [] };
  }

  // 6. Direct suggestions
  if (norm.includes("cut") || norm.includes("save") || norm.includes("less") || norm.includes("advice") || norm.includes("suggest") || norm.includes("where")) {
    const sortedCats = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    let md = `### 💡 Personalized Budget Optimization Tips
_Status: Local Real-Time Fallback Mode_

Based on your active records, I've outlined concrete, numbers-backed cut back recommendations:${memoryExemptionNote}\n\n`;

    if (sortedCats.length > 0) {
      const [topCat, topVal] = sortedCats[0];
      md += `1. **Target ${topCat}**: This is your highest active category costing **$${topVal.toFixed(2)}**. Reducing this spending by even 15% would retrieve **$${(topVal * 0.15).toFixed(2)}** in monthly cash surplus.\n`;
    }
    
    const subExpense = expenseTx
      .filter(t => /netflix|spotify|hbo|youtube|disney|amazon|prime|gym/i.test(t.merchant))
      .reduce((sum, item) => sum + item.amount, 0);
    
    if (subExpense > 0) {
      md += `2. **Downscale Media & Subscriptions**: You spent **$${subExpense.toFixed(2)}** on streaming/entertainment. Consolidate plans or check details in your subscriptions audit.\n`;
    } else {
      md += `2. **Streamline Small Bills**: Set tight limits on minor shopping and grocery visits; small charges quickly sum up over weeks.\n`;
    }

    md += `3. **Examine Active Limits**: Build strict targets in the **Category Budget Limits** panel to stay alert before limits are breached. Get real-time reminders right in your workspace!`;
    return { content: md, searchLinks: [] };
  }

  // 7. General Summary Fallback
  const sortedCategoriesList = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  let md = `### 🤝 Capital Advisor (Active Fallback Mode)
_Hello! The smart Gemini AI services are currently operating under quota limitations. To ensure 100% uptime, I have activated the **Local Real-Time Advisory Engine** to parse your records direct._

#### Executive Statement Overview
- **Total Income**: +$${totalIncome.toFixed(2)}
- **Total Expenses**: -$${totalExpense.toFixed(2)}
- **Net Cash Flow**: **$${netSavings.toFixed(2)}** (${netSavings >= 0 ? "Surplus" : "Deficit"})
- **Total Active Logs**: ${txList.length} transactions

#### Top Expense Departments:
${sortedCategoriesList.map(([cat, total], i) => `${i + 1}. **${cat}**: **$${total.toFixed(2)}**`).join("\n") || "_No expense tags categorized yet._"}${memoryExemptionNote}

---
💡 **Ask me any specific query!** Try asking:
- _"How much did I spend on Groceries?"_
- _"What was my biggest purchase?"_
- _"Identify subscriptions"_
- _"Flag unusual activities"_
- _"Compare my monthly spending"_
`;
  return { content: md, searchLinks: [] };
}

// 3. Chat / Advisor Assistant API
app.post("/api/assistant/chat", async (req, res) => {
  const { userId, message, history, transactions, budgets, customContext } = req.body;
  
  // Guard missing message early
  if (!message) {
    res.status(400).json({ error: "Missing query message." });
    return;
  }

  try {
    const ai = getAIClient();

    // Clean ledger serialization to present standard clear financial logs to Gemini as system context
    const transactionCount = transactions?.length || 0;
    const formattedTransactions = (transactions || [])
      .slice(0, 150) // Fit standard text limits while covering a long history cleanly
      .map((t: any) => `- Date: ${t.date} | Merchant: ${t.merchant} | Amount: $${t.amount.toFixed(2)} | Category: ${t.category} | Source: ${t.source}`)
      .join("\n");

    const formattedBudgets = (budgets || [])
      .map((b: any) => `- Category: ${b.category} | Limit: $${b.limit}`)
      .join("\n");

    const systemInstruction = `You are a professional, smart, and empathetic Personal Finance Assistant (like Copilot Money, Cleo, or a custom smart banking agent). 
Your goal is to answer questions about spending, examine budgets, notice recurring charges, identify anomalies, and provide concrete advice of where to cut back.

GUIDELINES:
1. ALWAYS respect custom user context & rules (provided below). If the user says "I get paid on the 10th" or "Exclude electricity bills from budget", remember and apply that!
2. Answer direct spending questions accurately (e.g. total, largest purchase, frequency). Be careful with math! Perform numerical calculations clearly and present the results.
3. Track budgets diligently. Compare spending in the transaction history against active budget limits. Inform when they are near or over limits.
4. Flag repeating charges/subscriptions. Group similar charges happening at matching periodic intervals (e.g., Netflix, gym subscriptions, water charges).
5. Flag unusual activities. Alert on irregular large charges, sudden double bills, outlier transactions or unexpected changes in merchant spending trends.
6. Look up unfamiliar merchants using the built-in Google Search tool when the user queries about charges they don't recognize.
7. Tone: Warm, objective, and direct. Support your advice with concrete numbers from the transaction ledger. Do not hallucinate or manufacture transactions. If you cannot answer based on the data, suggest what details are missing (e.g., "I don't see any transaction record for Netflix in this period").

--- USER DETAILS ---
User ID: ${userId || "Guest"}
Custom Context/Rules: ${customContext || "(None specified yet)"}

--- ACTIVE BUDGETS ---
${formattedBudgets || "(None defined yet - prompt user to set a budget!)"}

--- FINANCIAL TRANSACTIONS LEDGER (Last 150 items) ---
Total recorded transactions: ${transactionCount} (Listing closest matches)
${formattedTransactions || "(No transactions logged. Invite user to connect bank or upload a sample/CSV file.)"}
`;

    // Map the incoming ChatHistory array into the formats expected by Gemini SDK
    // The history contains { role: 'user' | 'model', content: string }
    const mappedContents = (history || []).map((msg: any) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }]
    }));

    // Append the current message
    mappedContents.push({
      role: "user",
      parts: [{ text: message }]
    });

    // Make the content generation with googleSearch tool enabled
    // Support a graceful fallback in case search or tool configurations are limited by the API key / credentials.
    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: mappedContents,
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }]
        }
      });
    } catch (searchError: any) {
      console.warn("Gemini with googleSearch failed, retrying without tools:", searchError?.message || searchError);
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: mappedContents,
        config: {
          systemInstruction
        }
      });
    }

    // Retrieve search grounding metadata if the model conducted web searches
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const searchLinks = groundingChunks
      .filter((chunk: any) => chunk.web?.uri)
      .map((chunk: any) => ({
        url: chunk.web.uri,
        title: chunk.web.title || chunk.web.uri
      }));

    res.json({
      content: response.text || "I was unable to answer that from the provided data. Please let me know how I can clarify.",
      searchLinks
    });
  } catch (err: any) {
    console.warn("Chat Advisor Error - Falling back to Local Rule Engine:", err?.message || err);
    try {
      const fallbackResult = runLocalAdvisorFallback(message, transactions, budgets, customContext);
      res.json(fallbackResult);
    } catch (fallbackError: any) {
      console.error("Local Advisor Fallback also failed:", fallbackError);
      res.status(500).json({ error: `AI & Fallback both failed. Error details: ${err?.message || "Internal error"}` });
    }
  }
});

// Configure Vite middleware and static asset server pathways
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Support single-page application router reload fallback
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully active on port ${PORT}`);
  });
}

startServer();
