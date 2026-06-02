# 🧠💸 Capital Advisor: Personal Finance Assistant

Capital Advisor is a highly polished, zero-trust full-stack Personal Finance Assistant. It enables users to securely sign in, maintain fully private transaction ledgers, parse statement CSVs with duplicate filtering, scan receipt photos using visual AI OCR, establish category budgets, and converse in natural language with an AI financial advisor powered by Gemini.

---

## 🚀 Key Features Accomplished

1. **Private Identity & Multiple Users**
   - Built a secure sandbox using **Firebase Authentication**. Every user has their own workspace, ensuring that transactions, budgets, guidelines, and conversation history are isolated under their UID.
   
2. **Dynamic Financial Ledger**
   - Real-time transaction journal powered by **Firestore live snapshot listeners**, allowing instant adding, deleting, and updating transitions.
   - Built an **Onboarding Simulator**, allowing users to inject 4 months of realistic, structured historical transactions (income, rent, dining, subscription anomalies) with a single tap.

3. **Conversational Assistant Console**
   - Fully interactive chat sandbox powered by **Gemini-3.5-Flash**.
   - Sends the current transaction ledger dynamically as context, enabling precise answers regarding calculations, May budgets, and monthly spends.

4. **Visual OCR Receipt Scanner**
   - Image upload interface supporting both **click-to-browse** and **drag-and-drop** file behaviors.
   - Leverages **Gemini-3.5-Flash** server-side multipart analysis to extract merchant name, transaction dates, classification categories, and total amounts, presenting details for review before writing.

5. **Messy CSV Statements Parser**
   - Robust column-mapping algorithm that reads messy CSV files, corrects odd dates/formatting, filters out double-charges using transaction signatures (`date_merchant_amount`), and commits records in batches using Firestore transactions.

6. **Category Budget Trackers**
   - Custom threshold setups with progress visualizers that turn amber or rose when users approach or exceed limits.

7. **Google Web Search Grounding**
   - When users query about unrecognizable merchants (e.g. `MOMENTUM*RETAIL GROUP NY`), Gemini runs a web lookup to report on search grounding chunks.

8. **Aesthetic Dashboard Pairing**
   - High-contrast Inter sans-serif paired with JetBrains Mono, backed by Recharts multi-month bar comparison charts.

---

## 🛠️ Technical and Architectural Decisions

### 1. Full-Stack Express + Vite Integration
- **Why**: Keeps our Gemini API keys and image scanning payloads secure from client exposure. All `@google/genai` connections reside behind server endpoints `/api/assistant/chat` and `/api/receipt/scan`.
- **Hosting Port**: Consolidated onto port `3000` inside our node ecosystem, with Vite mounted directly inside Express during development. This simplifies networking and ensures zero-CORS configuration issues.

### 2. Live Database Snapshot Listeners
- **Why**: Attaching standard standard Firestore listeners (`onSnapshot`) keeps the UI synced in real-time, instantly refreshing Recharts visualizations and budget alerts as soon as CSVs are parsed or receipts are scanned.

### 3. Safe Lazy Client Initializers
- **Why**: Initializing structural SDK objects (such as Gemini GenAI client) at request-time (instead of module compilation) prevents startup crashes when keys are temporarily absent.

---

## ⚖️ Trade-offs and Limitations

- **Google-Only Authentications**: Sticking strictly to Google OAuth as recommended under container preview systems.
- **Client CSV Processing**: CSV parsing runs client-side inside the browser thread, keeping server resources cheap. This is economical for up to several thousand rows, but would need worker delegations for massive enterprise statements.

---

## 📁 Setup and Execution

1. Build production bundles:
   ```bash
   npm run build
   ```
2. Launch full-stack Express server on port 3000:
   ```bash
   npm run start
   ```
