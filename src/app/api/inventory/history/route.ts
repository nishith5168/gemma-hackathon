import { NextRequest } from 'next/server';
import { db, medLabel } from '@/lib/db';
import { ok, bad, requirePharmacy } from '@/lib/api';


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pharmacyId = searchParams.get('pharmacyId');
  const limit = parseInt(searchParams.get('limit') || '100', 10);

  if (!pharmacyId) {
    return bad('Missing required parameter: pharmacyId.');
  }

  const guard = requirePharmacy(req, pharmacyId);
  if (guard) return guard;

  const store = db();
  const records = store.history
    .filter((h) => h.pharmacyId === pharmacyId)
    .slice(0, limit)
    .map((h) => {
      const med = store.medicines.find((m) => m.id === h.medicineId);
      return {
        ...h,
        medicineLabel: med ? medLabel(med) : h.medicineId,
      };
    });

  return ok(records);
}
