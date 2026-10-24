# MedSignal LK

> **"Connecting Patients. Empowering Pharmacies. Anticipating Shortages."**

A unified medicine availability and predictive shortage early-warning web platform for Sri Lanka. Built for the **Hack for Humanity (Hack Day Colombo)** and **Gemma 4 Challenge**.

---

## 1. Problem Statement
Sri Lanka faces frequent localized medicine access disparities and supply volatility across its 25 administrative districts. Patients waste crucial hours traveling between community pharmacies searching for essential prescription medicines. At the same time, small pharmacies rely on manual paper logbooks and paper delivery notes, while health ministry supply analysts lack real-time predictive visibility into localized district-level stock depletions until acute stock-outs occur.

---

## 2. Solution: The Closed-Loop Network
MedSignal LK demonstrates how **one single inventory update** reported by a community pharmacy simultaneously powers:
1. **Patient Availability**: Instant lookup of exact medicine variants (strength + form) with stock bands (`In Stock` / `Low Stock` / `Out of Stock`) and freshness timestamps (no raw quantities to prevent speculative hoarding).
2. **National Shortage Intelligence**: Feeds a deterministic Holt-smoothed forecast engine that alerts government health analysts 21 days before stock depletion.

```
+-----------------------------------------------------------------------------------+
|                              COMMUNITY PHARMACY                                   |
|   Quick Stock +/-  •  CSV Bulk Import  •  Gemma 4 Multimodal Invoice Scan         |
+-----------------------------------------------------------------------------------+
                                         |
                     +-------------------+-------------------+
                     |                                       |
                     v                                       v
+----------------------------------------+   +--------------------------------------+
|             PATIENT PORTAL             |   |        GOVERNMENT ANALYST            |
| • Search exact generic/brand variants  |   | • 21-day predictive stock depletion  |
| • Gemma vision prescription OCR        |   | • Holt's linear trend smoothing      |
| • Distance sort & GPS map pins         |   | • Z-score demand anomaly detection   |
| • Reservation hold requests            |   | • Gemma 4 function-calling summaries |
| • Trilingual (English, සිංහල, தமிழ்)   |   | • Simulated NMRA escalation workflow |
+----------------------------------------+   +--------------------------------------+
```

---

## 3. Synthetic & Legal Disclaimer
> [!IMPORTANT]
> **Synthetic Data Only**: All pharmacy names, addresses, inventory levels, supplier invoices, and patient profiles in this prototype are **entirely fictional and synthetically generated** for demonstration purposes. Generic medicine names and strengths reflect standard formulations.
>
> **Medical Advice Safety**: This software does **NOT** provide clinical advice, prescribe medicines, suggest therapeutic substitutions, or modify dosages. Community pharmacists verify physical prescriptions upon patient collection.
>
> **Early-Warning Indicator**: Shortage alerts represent **potential supply risks exclusively among participating reporting pharmacies** and do not constitute confirmed national stock-outs.

---

## 4. Key Features by Portal

### 🏥 1. Patient Portal (`/patient`)
- **Exact-Variant Search**: Filter by generic molecule, brand, exact strength, and dosage form (e.g. *Salbutamol 100 mcg/dose Inhaler* vs *Salbutamol 2 mg Tablet*).
- **Gemma 4 Prescription Vision OCR**: Photograph handwritten/printed prescriptions; Gemma extracts medicine lines without storing patient images.
- **Stock Band Transparency**: Displays `In Stock` / `Low Stock` / `Out of Stock` with honest freshness timestamps (e.g. *"Verified 2h ago"*, *"Unverified in >48h"*).
- **Hold Requests**: Request confirmation or reservation hold directly from the pharmacy.
- **Interactive Map**: Leaflet & OpenStreetMap view colored by availability.
- **Trilingual Interface**: Toggle between English, Sinhala (සිංහල), and Tamil (தமிழ்).

### 💊 2. Pharmacy Desk (`/pharmacy`)
- **Rapid Inventory Controls**: One-click quick updates (`Dispensed -`, `Received +`, `Set =`, `Still Correct`).
- **Gemma 4 Invoice OCR**: Scan supplier delivery notes (SPMC, SPC, Emerchemie) into an editable review table before receiving into stock.
- **Strict CSV Import**: All-or-nothing validation against the NMRA catalogue with row-by-row error reporting.
- **Patient Request Inbox**: State machine workflow (`Confirm` $\rightarrow$ `Reserve` $\rightarrow$ `Collect` or `Reject`).
- **Deliveries & Audit**: Track expected replenishments and full historical transaction ledger.

### 📊 3. Government Analyst (`/analyst`)
- **Executive KPIs**: Real-time counts of reporting pharmacies, open alerts, data freshness percentage, and critical shortage risks across districts.
- **Predictive Forecast Chart**: Dual-series Recharts graph joining 30-day reported stock with a 21-day projected depletion curve.
- **Gemma 4 Function Calling**: Click *"Explain with Gemma"* in English, Sinhala, or Tamil. Gemma autonomously executes the `get_shortage_forecast` tool to ground its explanation in the mathematical engine metrics.
- **Alert Queue**: Review workflow with mandatory justification notes (`Acknowledge`, `Dismiss`, or `Escalate (Simulated)`).
- **Demand Surge Stress Simulator**: Interactive sensitivity simulator (deplete 5%–95% of district stock) with instant live recalculation.
- **CSV Intelligence Export**: One-click download of anonymized district aggregates with regulatory disclaimers.

### 🛡️ 4. Administration & Governance (`/admin`)
- **NMRA Pharmacy Verification**: Inspect and approve/reject pending pharmacy registrations (e.g. Matara branch `p17`).
- **Catalogue Management**: Add new exact medicine variants with strict duplicate prevention.
- **Engine Rules Calibration**: Live calibration of critical/high alert thresholds, freshness expiry hours, and anomaly Z-score limits.
- **Data Quality Monitor**: Automatic detection of stale non-reporting pharmacies, large adjustments ($\ge 500$ units), and expired stock.
- **System Audit Log**: Full security trail of all actor operations.
- **Demo Reset**: 1-click reset to the initial deterministic 30-day seed.

---

## 5. Shortage Engine: Mathematical Formulation

The deterministic shortage engine in `src/lib/forecast.ts` executes entirely server-side without LLM arithmetic:

1. **Reconstruction**: Rebuilds 30-day historical closing stock backward from current inventory using recorded transactions.
2. **Holt's Linear Trend Smoothing**:
   $$\text{Level}_t = \alpha Y_t + (1 - \alpha)(\text{Level}_{t-1} + \text{Trend}_{t-1})$$
   $$\text{Trend}_t = \beta(\text{Level}_t - \text{Level}_{t-1}) + (1 - \beta)\text{Trend}_{t-1}$$
   - Parameters: $\alpha = 0.35, \beta = 0.15$.
   - Trend clamped to $\pm\max(0.5, 0.08 \times \text{Level})$ to prevent unbounded drift.
3. **Depletion Projection**:
   $$\text{Stock}_{k} = \max\left(0, \text{Stock}_{k-1} - (\text{Level} + k \cdot \text{Trend}) + \text{Incoming}_k\right)$$
   - Depletion Day $D$: First day $k \le 21$ where projected stock reaches $0$.
4. **Demand Surge Anomaly (Z-Score)**:
   $$Z = \frac{\mu_{\text{last 7}} - \mu_{\text{prev 21}}}{\sigma_{\text{prev 21}}}$$
   - Flagged when $Z \ge 2.0$ or when $\ge 50\%$ of reporting pharmacies in the district reach low stock.
5. **Deterministic Risk Rating**:
   - `insufficient`: Data freshness coverage $< 50\%$ or $< 2$ reporting pharmacies.
   - `critical`: Depletion $D \le 5$ days **with** corroborating anomaly or clustering.
   - `high`: Depletion $D \le 10$ days without incoming replenishment.
   - `moderate`: Depletion $D \le 21$ days, anomaly detected, or incoming delivery scheduled.
   - `low`: Stable supply.

---

## 6. AI Usage & Gemma 4 Integration

| Feature | Model & SDK | Implementation Pattern | Safeguards & Fallbacks |
|---|---|---|---|
| **Alert Explanation** | `gemma-4-26b-a4b-it` via `@google/genai` | **Multi-Turn Function Calling** (`get_shortage_forecast` tool) | LLM never alters numbers. Caches explanations; provenance attribution shown; fallback synthesis if offline. |
| **Prescription OCR** | `gemma-4-26b-a4b-it` (Multimodal Vision) | Zero-shot structured JSON extraction | Never guesses strengths or forms; matches strictly to verified catalogue variants; human selects ambiguous items. |
| **Supplier Invoice OCR**| `gemma-4-26b-a4b-it` (Multimodal Vision) | Zero-shot structured delivery note extraction | Nothing is written directly to database; staged into an editable review table for pharmacist sign-off. |
| **Trilingual Summaries**| `gemma-4-26b-a4b-it` | Native prompt generation in English, Sinhala (සිංහල), and Tamil (தமிழ்) | Model instructed to remain strictly within engine metrics and keep summaries under 180 words. |

---

## 7. Tech Stack

- **Framework**: [Next.js 16.4.3](https://nextjs.org/) (App Router, Turbopack, Cache Components)
- **UI & Components**: React 19, Tailwind CSS v4, [Lucide React](https://lucide.dev/) (Strict rule: zero emojis in UI)
- **Design System**: *Estilo de Fluxo de Rede* (`DESIGN.md`) & Anti-Slop Frontend Skill (`taste-SKILL.md`)
- **Database & Persistence**: [Supabase](https://supabase.com/) (PostgreSQL with RLS schema in `supabase/schema.sql`) + Resilient Local In-Memory/JSON Adapter
- **AI & Multimodal**: Google AI Studio (`@google/genai`) using **Gemma 4** open-weights
- **Visualizations**: [Recharts](https://recharts.org/) (Dual-series depletion curves)
- **Mapping**: [Leaflet](https://leafletjs.com/) with [OpenStreetMap](https://www.openstreetmap.org/) tiles

---

## 8. Local Setup & Getting Started

### Prerequisites
- Node.js $\ge 20.9$
- npm $\ge 10$

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/gemma-hackathon.git
   cd gemma-hackathon
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables in `.env`:
   ```bash
   # Google AI Studio (Get a free key at https://aistudio.google.com/)
   GEMINI_API_KEY=your_key_here
   GEMMA_MODEL=gemma-4-26b-a4b-it

   # Supabase Configuration (Optional - uses local fallback if unconfigured)
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_key
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 9. 90-Second Live Demo Script

1. **Step 1: Patient Search (30s)**
   - Open `/patient`. Toggle language to **සිංහල** or **தமிழ்** to show trilingual readiness, then back to **English**.
   - Select variant **Salbutamol 100 mcg/dose Inhaler**.
   - Observe **Colombo** results: *Lotus Care Pharmacy* shows **Low Stock** with *"Verified 3h ago"*.
   - Click **Request Hold** $\rightarrow$ submit 1 unit hold request.
2. **Step 2: Community Pharmacy Desk (30s)**
   - Switch Demo role in top navigation to **Pharmacist** (auto-routes to `/pharmacy`).
   - In **Requests Inbox**, see the patient's incoming hold request $\rightarrow$ click **Reserve Hold**.
   - Switch to **Inventory Tab**: available stock has decremented and reserved units incremented.
   - *(Optional P1)*: Switch to **Receive Stock** $\rightarrow$ scan supplier invoice $\rightarrow$ click **Receive into Stock**.
3. **Step 3: Shortage Intelligence & Gemma AI (30s)**
   - Switch Demo role in navigation to **Analyst** (routes to `/analyst`).
   - Click **Run Shortage Analysis** $\rightarrow$ engine calculates Holt smoothing across all districts.
   - Inspect **Western Province Salbutamol**: ranked **CRITICAL** (depletion Day 4–5).
   - Click the row to inspect the Recharts graph showing the dashed depletion line dropping to zero.
   - Click **Explain with Gemma** (or switch language to Tamil) $\rightarrow$ Gemma executes tool `get_shortage_forecast` via function calling to explain the mathematical evidence with full provenance attribution.
   - Enter justification note $\rightarrow$ click **Escalate (Simulated)**.
4. **Conclusion**:
   - *"One stock update feeds both the patient and the health ministry early-warning system — powered by an explainable engine and Gemma 4."*

---

## 10. Engineering Team & AI-Assisted Development Disclosure

### Built by
- **Nishith Siribaddana** — Full-Stack Architecture, Shortage Forecast Engine & Supabase Integration.
- **Ramiru Wanigathunga** — AI & Frontend Engineering, Gemma 4 Multimodal Pipelines & UI Design System.
- **Nishan Kumaratunga** — Systems & Data Engineering, Deterministic Simulation & Healthcare Compliance.

### Development Disclosure
This project was conceptualized, designed, and engineered during the official **Hack for Humanity Colombo Hack Day (MLH)** competing for the *Best Social Impact Web Platform* and *Gemma 4 Challenge*, utilizing Google Antigravity pair-programmed with Gemini/Gemma models.

---

## 11. License
This repository is open-sourced under the [MIT License](LICENSE).
