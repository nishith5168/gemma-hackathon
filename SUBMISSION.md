# MLH Hackathon Submission Form — MedSignal LK

Use the sections below to copy and paste directly into the **MLH OrganizerHQ Challenge Submission Form**.

---

## 1. Project Details

### Project name *
```text
MedSignal LK
```

### Source code *
```text
https://github.com/nishith5168/gemma-hackathon
```

---

## 2. Description *

```markdown
# MedSignal LK (ශ්‍රී ලංකා ඖෂධ සංඥා)
### Connecting Patients · Empowering Pharmacies · Anticipating Shortages

**MedSignal LK** is a real-time medicine availability network and 21-day shortage early-warning platform designed specifically for Sri Lanka's healthcare ecosystem.

---

### The Problem
Sri Lanka frequently experiences severe regional medicine shortages due to supply chain volatility, import disruptions, and lack of visibility between state suppliers (SPC, SPMC) and community pharmacies:
- **Patients** travel from pharmacy to pharmacy searching for critical life-saving medications (e.g., Salbutamol inhalers, Metformin, Losartan), facing stockouts, price exploitation, or counterfeit risks.
- **Pharmacists** rely on manual paper delivery notes and phone calls, leaving inventory stale and uncoordinated.
- **Health Officials & Regulators (NMRA)** only discover critical shortages weeks after hospital shelves are empty, when it is too late to redirect emergency buffer stock.

---

### The Solution: MedSignal LK
MedSignal LK unifies the healthcare supply chain with four synchronized stakeholder views:

#### 1. Patient Portal (Trilingual & Geolocation-Enabled)
- **Live GPS Proximity Search**: Tap *"Use my location"* to discover verified pharmacies carrying your exact medicine within walking or driving distance, displayed on an interactive Leaflet map with a live radar pulse marker.
- **Exact-Variant Matching**: Protects patients by ensuring exact generic, dosage, and formulation matching (e.g. Salbutamol 100mcg Inhaler vs 2mg Tablet) to eliminate dangerous accidental substitutions.
- **Gemma 4 Multimodal Prescription Scanner**: Patients snap a photo of paper prescriptions; Gemma extracts the prescribed drugs and checks catalogue stock in real-time.
- **Client-Side High-Efficiency OCR Compression**: Custom canvas compressor reduces mobile camera photos by **85%–96%** (from 4 MB to ~140 KB in <40ms) prior to upload, maximizing speed on 3G/4G connections while keeping handwriting sharp for OCR.
- **Reservation Hold Requests**: Request a stock hold to avoid travelling across town only to find the medicine sold out.

#### 2. Pharmacy Desk (Rapid Stock Ingestion)
- **Gemma 4 Supplier Invoice Vision OCR**: Pharmacists photograph delivery notes from distributors (Emerchemie, SPMC, SPC). Gemma automatically extracts medicine line items, quantities, batch numbers, and expiry dates into an editable verification table.
- **Strict All-or-Nothing CSV Import**: Fast bulk-inventory upload with row-by-row validation.
- **Reservation Management**: Approve, dispense, or decline patient medicine hold requests with real-time inventory deduction.

#### 3. Government & Public Health Analyst (Predictive Early Warning)
- **21-Day Shortage Forecasting Engine**: Reconstructs 30-day transaction history and applies **Holt's Linear Smoothing ($\alpha=0.35, \beta=0.15$)** to forecast days-of-supply depletion.
- **Demand Surge Anomaly Detection ($Z$-Score)**: Alerts health authorities when prescription demand surges beyond $2\sigma$ above historical baseline.
- **Gemma 4 Tool-Calling Explanations**: Gemma queries the live forecast engine using function calling (`get_shortage_forecast`) to produce trilingual explanations (English, Sinhala, Tamil) detailing root causes and recommended supply actions.
- **Supply Surge Simulator**: Interactive *"Simulate Surge"* tool testing policy interventions and emergency replenishments.

#### 4. NMRA Regulator & Admin Console
- **Licensing Verification**: Manage NMRA pharmacy licenses, inspect audit logs, and calibrate risk thresholds.
- **1-Click Synthetic Demo Reset**: Resets 32 verified pharmacies across 8 districts with 11,300+ deterministic transactions and 4 verified shortage test scenarios.

---

### How AI & Gemma 4 Are Used
1. **Multimodal Prescription OCR**: `gemma-4-26b-a4b-it` extracts prescribed medications, dosages, and quantities from handwritten and printed doctor prescriptions.
2. **Supplier Delivery Note OCR**: `gemma-4-26b-a4b-it` parses multi-column distributor invoices (batch numbers, expiry dates, quantities) to eliminate manual entry errors.
3. **Agentic Function Calling**: Gemma autonomously invokes the predictive forecast engine via structured tool-calling, synthesizing analytical telemetry into clear English, Sinhala, and Tamil advisories with full data provenance.

---

### Tech Stack
- **Frontend & Server**: Next.js 16.4.3 (Turbopack, App Router, Server Components), React 19, TypeScript
- **Styling & UI**: Tailwind CSS v4, Lucide Icons, Recharts (forecast sparklines)
- **Database & Auth**: Supabase (PostgreSQL with relational constraints), `@supabase/ssr` with session refresh middleware
- **Mapping & Geolocation**: Leaflet, OpenStreetMap, HTML5 Geolocation API
- **AI Models & SDK**: Google Gemma 4 (`gemma-4-26b-a4b-it`) via `@google/genai` (Google AI Studio)

---

### Responsible AI & Social Impact
- **Anti-Hoarding Safeguard**: Exact stock counts are hidden from the public portal; stock is categorized into semantic bands (*In Stock*, *Low Stock*, *Out of Stock*) to prevent speculative hoarding.
- **Zero Medical Hallucination Rule**: MedSignal LK never recommends medical substitutions or dosage alterations. A licensed pharmacist must verify physical prescriptions upon collection.
- **Open-Source & Privacy First**: Images processed for OCR are compressed in-browser and never permanently stored.
```

---

## 3. Technologies Used *

```text
Next.js 16, React 19, TypeScript, Supabase, PostgreSQL, @supabase/ssr, Google Gemma 4, Google AI Studio, Leaflet, Tailwind CSS, Recharts, Lucide React, HTML5 Canvas API
```

---

## 4. AI Your Project Calls

Check the following boxes on the form:
- [x] **Gemma**
- [x] **Gemini**

---

## 5. Links

### Live demo link
```text
https://gemma-hackathon.vercel.app
```
*(Or your active deployed Vercel URL)*

### Other links
- **Public GitHub Repository**:
```text
https://github.com/nishith5168/gemma-hackathon
```

---

## 6. Which Prize Categories Are You Entering? *

Select all 3 categories:

1. **Deepmind Google — Best Use of Gemma 4**
   - *Why it qualifies*: Deep integration of Gemma 4 across 3 distinct multimodal and agentic workflows: multimodal handwritten prescription OCR, supplier delivery note invoice line extraction, and function-calling (`get_shortage_forecast`) generating trilingual early-warning advisories in English, Sinhala, and Tamil.

2. **DigitalOcean — Best Open-Source AI Project**
   - *Why it qualifies*: Completely open-source under MIT license, featuring an open mathematical shortage forecasting engine (Holt's linear smoothing + Z-score anomaly detection), reproducible deterministic seed simulation, and modular client-side image optimization.

3. **Event Prize — HACK FOR HUMANITY (Hack for Humanity in Sri Lanka)**
   - *Why it qualifies*: Directly tackles Sri Lanka's healthcare accessibility crisis by connecting patients to nearby stocked pharmacies, preventing speculative hoarding, and giving public health authorities a 21-day advance warning of district-level medicine stockouts.

---

## 7. AI Coding Tools

Check the following box on the form:
- [x] **Antigravity**

---

## 8. Models Your Coding Tools Ran On

Under Google, check:
- [x] **Gemini 4 Argon** *(or **Gemma 4 26B A4B** / **Gemini 3.8 Flash**)*

---

## 9. 3-Minute Live Demo Script (For Judges)

- **00:00 - 00:30 (Problem Statement)**:
  *"Sri Lanka's ongoing medical crisis means patients travel for hours seeking basic inhalers or insulin, while health authorities only learn of shortages weeks after district stocks empty. MedSignal LK solves this by connecting patients, pharmacies, and regulators in one real-time network."*

- **00:30 - 02:00 (Live Platform Walkthrough)**:
  1. **Patient View (`/patient`)**: Show clicking *"Use my location"* → map zooms to show user location with radar pulse and nearest pharmacies. Snap/upload a prescription photo → show instant 96% client-side compression → Gemma 4 reads the medication and matches exact catalogue variants.
  2. **Pharmacy View (`/pharmacy`)**: Switch role via Demo switcher. Upload supplier invoice photo → Gemma extracts lines, quantities, batch, expiry into stock table → 1-click receive stock.
  3. **Analyst View (`/analyst`)**: Show 21-day shortage curve, demand surge anomaly $Z > 2.0$, and Gemma's tool-calling trilingual explanation in English, Sinhala, and Tamil.

- **02:00 - 02:30 (Technical & AI Highlights)**:
  *"Powered by Next.js 16, Supabase PostgreSQL, and Google Gemma 4. We use Holt's linear smoothing for mathematical rigor and client-side canvas downsampling to minimize mobile payload sizes by up to 96%."*

- **02:30 - 03:00 (Q&A with Judges)**:
  Answer questions regarding anti-hoarding safeguards, NMRA licensing, and real-world deployment feasibility.
