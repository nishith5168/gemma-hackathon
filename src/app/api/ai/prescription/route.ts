import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, bad, parseBody } from '@/lib/api';
import { extractPrescription, matchMedicine } from '@/lib/gemma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const data = await parseBody<{ image?: string }>(req);

  try {
    const result = await extractPrescription(data?.image);
    const store = db();

    // Match each item against catalogue
    const matched = result.items.map((line) => {
      const { exactMatch, candidates } = matchMedicine(store.medicines, line);
      return {
        ...line,
        exactMatch,
        candidates,
      };
    });

    return ok({
      items: matched,
      unreadable: result.unreadable,
      notes: result.notes,
      mock: result.mock,
      model: result.model,
    });
  } catch (err) {
    console.error('Prescription extraction failed:', err);
    return bad(
      `AI Vision reading failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      502
    );
  }
}
