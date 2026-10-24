import { ok } from '@/lib/api';
import { hasKey, getModelName } from '@/lib/gemma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const live = hasKey();
  const model = getModelName();

  return ok({
    live,
    model,
    provider: 'Google AI Studio (Gemini API)',
    mockMode: !live,
  });
}
