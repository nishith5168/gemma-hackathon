import { GoogleGenAI, Type } from '@google/genai';
import { Forecast, Medicine } from './types';
import { computeForecast } from './forecast';
import { db, medLabel } from './db';
import { forecastNoSeries } from './ops';

export function hasKey(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return !!key && key.trim().length > 10 && !key.includes('your_gemini_api_key');
}

export function getModelName(): string {
  return process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it';
}

function getClient(): GoogleGenAI | null {
  if (!hasKey()) return null;
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

export function parseDataUrl(dataUrl: string): { mimeType: string; base64Data: string } {
  const matches = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (!matches || matches.length < 3) {
    throw new Error('Invalid data URL format. Expected data:<mime-type>;base64,<data>');
  }
  return { mimeType: matches[1], base64Data: matches[2] };
}

export function extractJson<T>(raw: string): T {
  // Strip markdown code fences if present
  let clean = raw.trim();
  clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const firstBrace = clean.indexOf('{');
  const firstBracket = clean.indexOf('[');
  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = clean.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = clean.lastIndexOf(']');
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    clean = clean.substring(startIdx, endIdx + 1);
  }

  return JSON.parse(clean) as T;
}

// --------------------------------------------------------------------
// 9.3 Exact-variant catalogue matching
// --------------------------------------------------------------------
export interface MatchedVariant {
  item: {
    generic: string;
    brand: string;
    strength: string;
    form: string;
    quantity: number;
    batch?: string;
    expiry?: string;
  };
  exactMatch: Medicine | null;
  candidates: Medicine[];
}

export function normalizeStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9./]/g, '');
}

export function matchMedicine(
  medicines: Medicine[],
  line: { generic: string; brand: string; strength: string; form: string }
): { exactMatch: Medicine | null; candidates: Medicine[] } {
  const normGen = normalizeStr(line.generic);
  const normBrand = normalizeStr(line.brand);
  const normStrength = normalizeStr(line.strength);
  const normForm = normalizeStr(line.form);

  const candidates = medicines.filter((m) => {
    const mGen = normalizeStr(m.generic);
    const mBrand = normalizeStr(m.brand);
    if (normGen && (mGen.includes(normGen) || normGen.includes(mGen))) return true;
    if (normBrand && (mBrand.includes(normBrand) || normBrand.includes(mBrand))) return true;
    return false;
  });

  if (candidates.length === 0) {
    return { exactMatch: null, candidates: [] };
  }

  // Exact variant match: strength matches AND form contains/contained
  const exact = candidates.filter((m) => {
    const mStr = normalizeStr(m.strength);
    const mFrm = normalizeStr(m.form);
    const strengthMatch = normStrength !== '' && (mStr === normStrength || mStr.includes(normStrength));
    const formMatch = normForm !== '' && (mFrm.includes(normForm) || normForm.includes(mFrm));
    return strengthMatch && formMatch;
  });

  // Safe medical rule: Auto-select ONLY if strength AND form were read and exactly one candidate matches
  if (normStrength !== '' && normForm !== '' && exact.length === 1) {
    return { exactMatch: exact[0], candidates };
  }

  return { exactMatch: null, candidates };
}

// --------------------------------------------------------------------
// 9.1 Prescription Vision OCR
// --------------------------------------------------------------------
export interface PrescriptionResult {
  items: {
    generic: string;
    brand: string;
    strength: string;
    form: string;
    quantity: number;
  }[];
  unreadable: boolean;
  notes: string;
  mock: boolean;
  model: string;
}

export async function extractPrescription(
  dataUrl?: string
): Promise<PrescriptionResult> {
  const modelName = getModelName();

  if (!hasKey() || !dataUrl) {
    return {
      items: [
        { generic: 'Salbutamol', brand: 'Breathex', strength: '100 mcg/dose', form: 'Inhaler', quantity: 1 },
        { generic: 'Metformin', brand: 'Glucofine', strength: '500 mg', form: 'Tablet', quantity: 60 },
      ],
      unreadable: false,
      notes: 'MOCK prescription extraction (no API key configured).',
      mock: true,
      model: `${modelName} (mock)`,
    };
  }

  try {
    const client = getClient()!;
    const { mimeType, base64Data } = parseDataUrl(dataUrl);

    const prompt = `You are helping a patient in Sri Lanka SEARCH for medicines at pharmacies.
Read the prescription image and list each prescribed medicine.
Return ONLY JSON: {"items":[{"generic":"...","brand":"...","strength":"...","form":"...","quantity":0}],"unreadable":false,"notes":"..."}
Rules:
- generic = active ingredient (e.g. "Metformin"). brand only if written.
- strength exactly as written (e.g. "500 mg", "100 mcg/dose"). form e.g. Tablet, Capsule, Inhaler, Syrup, Injection.
- If a field is not legible use "" - never guess a strength or dose.
- If the image is not a prescription or is unreadable, set "unreadable": true and items [].
- Do NOT give medical advice, dosing advice or substitutions.`;

    const response = await client.models.generateContent({
      model: modelName,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      config: {
        temperature: 0.1,
      },
    });

    const text = response.text || '';
    const parsed = extractJson<{
      items: { generic: string; brand: string; strength: string; form: string; quantity: number }[];
      unreadable: boolean;
      notes: string;
    }>(text);

    return {
      items: parsed.items || [],
      unreadable: !!parsed.unreadable,
      notes: parsed.notes || '',
      mock: false,
      model: modelName,
    };
  } catch (err) {
    console.warn('[Gemma Vision] Failed live prescription call, returning mock:', err);
    return {
      items: [
        { generic: 'Salbutamol', brand: 'Breathex', strength: '100 mcg/dose', form: 'Inhaler', quantity: 1 },
        { generic: 'Metformin', brand: 'Glucofine', strength: '500 mg', form: 'Tablet', quantity: 60 },
      ],
      unreadable: false,
      notes: `MOCK fallback: ${err instanceof Error ? err.message : 'API call failed'}`,
      mock: true,
      model: `${modelName} (fallback)`,
    };
  }
}

// --------------------------------------------------------------------
// 9.2 Invoice Vision OCR
// --------------------------------------------------------------------
export interface InvoiceResult {
  supplier: string;
  items: {
    generic: string;
    brand: string;
    strength: string;
    form: string;
    quantity: number;
    batch: string;
    expiry: string;
  }[];
  mock: boolean;
  model: string;
}

export async function extractInvoice(dataUrl?: string): Promise<InvoiceResult> {
  const modelName = getModelName();

  if (!hasKey() || !dataUrl) {
    return {
      supplier: 'State Pharmaceuticals Corporation (SPC) Colombo Hub',
      items: [
        { generic: 'Amoxicillin', brand: 'Amoxa', strength: '500 mg', form: 'Capsule', quantity: 200, batch: 'B829104', expiry: '2027-08-30' },
        { generic: 'Paracetamol', brand: 'Paralief', strength: '500 mg', form: 'Tablet', quantity: 500, batch: 'B773192', expiry: '2027-11-15' },
        { generic: 'Salbutamol', brand: 'Breathex', strength: '100 mcg/dose', form: 'Inhaler', quantity: 20, batch: 'B441203', expiry: '2027-05-10' },
      ],
      mock: true,
      model: `${modelName} (mock)`,
    };
  }

  try {
    const client = getClient()!;
    const { mimeType, base64Data } = parseDataUrl(dataUrl);

    const prompt = `Read this pharmacy supplier invoice / delivery note.
Return ONLY JSON: {"supplier":"...","items":[{"generic":"...","brand":"...","strength":"...","form":"...","quantity":0,"batch":"...","expiry":"YYYY-MM-DD"}]}
- quantity = number of individual units (tablets/capsules/inhalers/vials) delivered. If packs are given with a pack size, multiply.
- Use "" for anything not legible. Never invent values.`;

    const response = await client.models.generateContent({
      model: modelName,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      config: {
        temperature: 0.1,
      },
    });

    const text = response.text || '';
    const parsed = extractJson<{
      supplier: string;
      items: { generic: string; brand: string; strength: string; form: string; quantity: number; batch: string; expiry: string }[];
    }>(text);

    return {
      supplier: parsed.supplier || 'Medical Distributor',
      items: parsed.items || [],
      mock: false,
      model: modelName,
    };
  } catch (err) {
    console.warn('[Gemma Vision] Failed invoice call, returning mock:', err);
    return {
      supplier: 'State Pharmaceuticals Corporation (SPC) Colombo Hub',
      items: [
        { generic: 'Amoxicillin', brand: 'Amoxa', strength: '500 mg', form: 'Capsule', quantity: 200, batch: 'B829104', expiry: '2027-08-30' },
        { generic: 'Paracetamol', brand: 'Paralief', strength: '500 mg', form: 'Tablet', quantity: 500, batch: 'B773192', expiry: '2027-11-15' },
        { generic: 'Salbutamol', brand: 'Breathex', strength: '100 mcg/dose', form: 'Inhaler', quantity: 20, batch: 'B441203', expiry: '2027-05-10' },
      ],
      mock: true,
      model: `${modelName} (fallback)`,
    };
  }
}

// --------------------------------------------------------------------
// 9.4 Shortage Alert Explanation with Function Calling
// --------------------------------------------------------------------
export interface ExplainResult {
  explanation: string;
  language: 'en' | 'si' | 'ta';
  usedTool: boolean;
  mock: boolean;
  model: string;
  provenance: string;
}

export async function explainAlert(
  medicineId: string,
  district: string,
  language: 'en' | 'si' | 'ta' = 'en'
): Promise<ExplainResult> {
  const modelName = getModelName();
  const langLabel = language === 'si' ? 'Sinhala (සිංහල script)' : language === 'ta' ? 'Tamil (தமிழ் script)' : 'English';

  const store = db();
  const forecast = computeForecast(store, medicineId, district);
  const med = store.medicines.find((m) => m.id === medicineId);
  const medTitle = med ? medLabel(med) : medicineId;

  if (!hasKey() || !forecast) {
    const mockTexts: Record<'en' | 'si' | 'ta', string> = {
      en: `[MOCK EXPLANATION] Early warning analysis indicates a ${forecast?.risk.toUpperCase() || 'POTENTIAL'} supply depletion risk for ${medTitle} in ${district} district among participating reporting pharmacies.
• Stock-out estimated in ${forecast?.depletionDay ? `${forecast.depletionDay} days` : `${forecast?.daysOfSupply ?? 'N/A'} days of supply`}.
• Available stock: ${forecast?.available ?? 0} units across ${forecast?.pharmaciesFresh ?? 0} reporting pharmacies (${((forecast?.coverage ?? 0) * 100).toFixed(0)}% reporting freshness).
• Average consumption rate: ${forecast?.avgDemand ?? 0} units/day.
• Limitations: Relies on voluntary network disclosures; does not represent total national imports or public hospital reserves.
• Recommended action: Analyst should verify stock at central distributor warehouses and cross-check stale pharmacy records.`,
      si: `[MOCK EXPLANATION] ${district} දිස්ත්‍රික්කයේ සහභාගී වන ෆාමසි අතර ${medTitle} සඳහා සැපයුම් අවදානමක් පවතී.
• ඇස්තමේන්තුගත තොග අවසන් වීම දින ${forecast?.depletionDay ?? 5} කින්.
• ලබාගත හැකි තොගය: ඒකක ${forecast?.available ?? 0}.
• නිර්දේශය: ජාතික හිඟයක් තහවුරු කිරීමට පෙර ප්‍රධාන බෙදාහරින්නන් හා සම්බන්ධ වන්න.`,
      ta: `[MOCK EXPLANATION] ${district} மாவட்டத்தில் பங்குபெறும் மருந்தகங்களில் ${medTitle} மருந்துக்கான பற்றாக்குறை அபாயம் கண்டறியப்பட்டுள்ளது.
• கையிருப்பு தீரும் நாள்: ${forecast?.depletionDay ?? 5} நாட்கள்.
• தற்போதைய இருப்பு: ${forecast?.available ?? 0} அலகுகள்.
• பரிந்துரை: விநியோகஸ்தர்களைத் தொடர்பு கொண்டு சரிபார்க்கவும்.`,
    };

    return {
      explanation: mockTexts[language] || mockTexts.en,
      language,
      usedTool: false,
      mock: true,
      model: `${modelName} (mock)`,
      provenance: 'Generated by Gemma 4 MOCK simulation. AI text explains the deterministic engine numbers; verify before acting.',
    };
  }

  const prompt = `You are an assistant for a government health supply analyst in Sri Lanka.
Explain a POTENTIAL medicine shortage alert in ${langLabel}.
Use ONLY the numbers returned by the get_shortage_forecast tool. Do not invent figures, causes, or national statistics.
Structure: 1) one-sentence summary, 2) the key evidence (3-4 short bullets), 3) data limitations / confidence, 4) 2-3 suggested checks for the analyst (e.g. contact distributor, verify stale pharmacies).
State clearly that this is a potential risk among participating pharmacies, not a confirmed national shortage. Keep it under 180 words.`;

  try {
    const client = getClient()!;

    // Turn 1: Call with function definition
    const turn1 = await client.models.generateContent({
      model: modelName,
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${prompt}\n\nAlert parameters: medicine_id="${medicineId}", district="${district}". Call the tool first.` },
          ],
        },
      ],
      config: {
        temperature: 0.15,
        tools: [
          {
            functionDeclarations: [
              {
                name: 'get_shortage_forecast',
                description: 'Fetches deterministic shortage forecast metrics for a medicine and district in Sri Lanka.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    medicine_id: { type: Type.STRING, description: 'The medicine ID e.g. m1' },
                    district: { type: Type.STRING, description: 'The district name e.g. Colombo' },
                  },
                  required: ['medicine_id', 'district'],
                },
              },
            ],
          },
        ],
      },
    });

    // Check if tool call requested
    const call = turn1.functionCalls?.[0];
    if (call && call.name === 'get_shortage_forecast') {
      const summarySnapshot = forecastNoSeries(forecast);

      // Turn 2: Provide tool output
      const turn2 = await client.models.generateContent({
        model: modelName,
        contents: [
          { role: 'user', parts: [{ text: `${prompt}\n\nAlert parameters: medicine_id="${medicineId}", district="${district}". Call the tool first.` }] },
          { role: 'model', parts: [{ functionCall: call }] },
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: 'get_shortage_forecast',
                  response: { result: summarySnapshot },
                },
              },
            ],
          },
        ],
        config: {
          temperature: 0.15,
        },
      });

      const explanation = turn2.text || '';
      return {
        explanation,
        language,
        usedTool: true,
        mock: false,
        model: modelName,
        provenance: 'Generated by Gemma 4 via function calling (get_shortage_forecast). AI text explains the engine\'s numbers; verify before acting.',
      };
    }

    // If model didn't call tool or single turn fallback
    const fallbackResponse = await client.models.generateContent({
      model: modelName,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${prompt}\n\nDeterministic Forecast Metrics:\n${JSON.stringify(forecastNoSeries(forecast), null, 2)}`,
            },
          ],
        },
      ],
      config: { temperature: 0.15 },
    });

    return {
      explanation: fallbackResponse.text || '',
      language,
      usedTool: false,
      mock: false,
      model: modelName,
      provenance: 'Generated by Gemma 4 (direct synthesis). AI text explains the engine\'s numbers; verify before acting.',
    };
  } catch (err) {
    console.warn('[Gemma Explain] API call failed, using graceful fallback:', err);
    return {
      explanation: `[AI SYNTHESIS] Potential supply depletion risk projected for ${medTitle} in ${district} district among participating reporting pharmacies.
• Depletion projected: ${forecast.depletionDay ? `Day ${forecast.depletionDay}` : `${forecast.daysOfSupply ?? 'N/A'} days of supply`}.
• Available stock: ${forecast.available} units across ${forecast.pharmaciesFresh} fresh pharmacies (${(forecast.coverage * 100).toFixed(0)}% reporting freshness).
• Smoothed daily demand: ${forecast.avgDemand} units/day.
• Limitations: Voluntary pharmacy network sample only; excludes direct hospital imports.
• Suggested action: Contact district distributors to verify pending replenishments and cross-reference non-reporting pharmacies.`,
      language,
      usedTool: false,
      mock: true,
      model: `${modelName} (fallback)`,
      provenance: 'Generated via engine synthesis fallback. AI text explains the deterministic numbers; verify before acting.',
    };
  }
}
