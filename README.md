# VIKMO DealerDesk — B2B Automotive Spare Parts & AI Dealer Portal

VIKMO DealerDesk is an enterprise-grade B2B platform engineered for automotive spare parts distributors and multi-brand dealerships across India. It integrates inventory management, live order lifecycles with 18% per-line GST calculation, automated upstream supplier catalog synchronization, machine learning demand forecasting, and an autonomous AI dealer assistant.

---

## 🚀 Key Modules Built

1. **Core Catalog & Inventory Management (§4, §5, §6)**
   - Complete 600-product automotive parts catalog with multi-field search and vehicle fitment matching.
   - Real-time inventory tracking and audit logging.
   - 25 commercial dealership profiles across India with sanction credit line limits.

2. **Order Engine & Concurrency Lifecycle (§7)**
   - Idempotent draft order creation via `POST /api/orders/`.
   - Per-line 18% GST calculation exact to the paisa with `ROUND_HALF_UP`.
   - Strict status transition pipeline (`DRAFT` ➔ `CONFIRMED` ➔ `DISPATCHED` ➔ `DELIVERED`, or `CANCELLED`).
   - Atomic all-or-nothing stock deduction and price-locking on confirmation.

3. **Supplier Catalog Sync (§8)**
   - Fault-tolerant ingestion pipeline pulling from upstream supplier feed.
   - Cursor-based pagination, rate-limit retry backoff (`429`), exponential backoff on `5xx`.
   - Deduplication by latest `updated_at`, without altering local warehouse stock.

4. **Dealer Operations Assistant (§9)**
   - Autonomous conversational agent with function calling: `search_parts`, `check_stock`, `create_draft_order`.
   - Multi-turn conversation context with session memory (`session_id`).
   - Supported LLM Providers:
     - **Google Gemini**: `gemini-2.0-flash` (via `GEMINI_API_KEY`)
     - **OpenAI**: `gpt-4o-mini` (via `OPENAI_API_KEY`)
     - **Groq**: `llama-3.3-70b-versatile` (via `GROQ_API_KEY`)
     - **Anthropic**: `claude-3-5-haiku-20241022` (via `ANTHROPIC_API_KEY`)
   - Includes deterministic engine fallback to ensure zero downtime and sub-50ms response times.

5. **ML Demand Forecasting & Reorders (§10)**
   - Committed 4-week sales forecast in `ml/forecast.csv` (160 rows covering 40 SKUs across weeks `2026-09-28`, `2026-10-05`, `2026-10-12`, and `2026-10-19`).
   - Dynamic Reorder Point (ROP) algorithm: $\text{ROP} = \text{Lead Time Demand} + \lceil 1.65 \times \sigma \times \sqrt{L} \rceil$.

6. **Web Application Frontend**
   - React + Vite dashboard at `http://localhost:5173`.
   - Catalog browser, interactive order builder, demand curve SVG visualizer, supplier sync console, and live AI assistant chat.

---

## 🛠️ Setup & Run

### 1. Requirements
- Python 3.11+
- PostgreSQL
- Node.js 18+ (for frontend portal)

### 2. Backend Setup
```bash
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate --noinput
python manage.py seed_data
python manage.py runserver 0.0.0.0:8000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Smoke Test Verification
Run the contract test suite:
```bash
python smoke_test.py --base-url http://localhost:8000 --all
```
All 12/12 contract checks pass cleanly.
