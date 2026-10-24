import { NextRequest } from 'next/server';
import { db, save, uid, nowIso, audit, medLabel } from '@/lib/db';
import { ok, bad, requirePharmacy, who, parseBody } from '@/lib/api';
import { Replenishment } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pharmacyId = searchParams.get('pharmacyId');

  if (!pharmacyId) {
    return bad('Missing required parameter: pharmacyId.');
  }

  const guard = requirePharmacy(req, pharmacyId);
  if (guard) return guard;

  const store = db();
  const list = store.replenishments
    .filter((r) => r.pharmacyId === pharmacyId)
    .map((r) => {
      const med = store.medicines.find((m) => m.id === r.medicineId);
      return {
        ...r,
        medicineLabel: med ? medLabel(med) : r.medicineId,
      };
    });

  return ok(list);
}

export async function POST(req: NextRequest) {
  const data = await parseBody<{
    pharmacyId: string;
    medicineId: string;
    quantity: number;
    expectedDate: string;
    supplier: string;
  }>(req);

  if (
    !data?.pharmacyId ||
    !data?.medicineId ||
    !data?.quantity ||
    !data?.expectedDate ||
    !data?.supplier
  ) {
    return bad('Missing required fields: pharmacyId, medicineId, quantity, expectedDate, supplier.');
  }

  const guard = requirePharmacy(req, data.pharmacyId);
  if (guard) return guard;

  const store = db();
  const med = store.medicines.find((m) => m.id === data.medicineId);
  if (!med) return bad('Medicine not found.', 404);

  const session = who(req);
  const rep: Replenishment = {
    id: uid('rep'),
    pharmacyId: data.pharmacyId,
    medicineId: data.medicineId,
    quantity: Number(data.quantity),
    expectedDate: data.expectedDate.trim(),
    supplier: data.supplier.trim(),
    status: 'expected',
    createdAt: nowIso(),
  };

  store.replenishments.unshift(rep);
  audit(
    session.user,
    'replenishment_scheduled',
    `Scheduled expected delivery: ${rep.quantity} units of ${medLabel(med)} from ${rep.supplier} for ${rep.expectedDate}`
  );

  save();
  return ok(rep, 201);
}
