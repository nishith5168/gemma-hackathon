import { NextRequest } from 'next/server';
import { db, medLabel } from '@/lib/db';
import { ok, requireRole } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const guard = requireRole(req, ['analyst', 'admin']);
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'all';

  const store = db();
  let list = store.alerts;
  if (status !== 'all') {
    list = list.filter((a) => a.status === status);
  }

  const enriched = list.map((a) => {
    const med = store.medicines.find((m) => m.id === a.medicineId);
    return {
      ...a,
      medicineLabel: med ? medLabel(med) : a.medicineId,
    };
  });

  return ok(enriched);
}
