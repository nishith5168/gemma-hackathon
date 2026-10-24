import { NextRequest } from 'next/server';
import { db, save } from '@/lib/db';
import { ok, bad, parseBody } from '@/lib/api';
import { explainAlert } from '@/lib/gemma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const data = await parseBody<{
    medicineId: string;
    district: string;
    language?: 'en' | 'si' | 'ta';
    alertId?: string;
    refresh?: boolean;
  }>(req);

  if (!data?.medicineId || !data?.district) {
    return bad('Missing required medicineId or district.');
  }

  const lang = data.language || 'en';
  const store = db();

  // Check alert cache if alertId is provided and refresh is false
  if (data.alertId && !data.refresh) {
    const alert = store.alerts.find((a) => a.id === data.alertId);
    if (alert && alert.explanations && alert.explanations[lang]) {
      return ok({
        explanation: alert.explanations[lang],
        language: lang,
        usedTool: true,
        mock: false,
        cached: true,
        provenance: 'Loaded from cached Gemma explanation.',
      });
    }
  }

  try {
    const result = await explainAlert(data.medicineId, data.district, lang);

    // Save to cache if non-mock and alert exists
    if (!result.mock && data.alertId) {
      const alert = store.alerts.find((a) => a.id === data.alertId);
      if (alert) {
        if (!alert.explanations) alert.explanations = {};
        alert.explanations[lang] = result.explanation;
        save();
      }
    }

    return ok(result);
  } catch (err) {
    console.error('Explanation generation failed:', err);
    return bad(
      `AI explanation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      502
    );
  }
}
