import { NextRequest } from 'next/server';
import { db, save, uid, nowIso, notify, audit, medLabel } from '@/lib/db';
import { ok, bad, who, parseBody } from '@/lib/api';
import { StockRequest } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get('patientId');
  const pharmacyId = searchParams.get('pharmacyId');

  const store = db();
  let list = store.requests;

  if (patientId) {
    list = list.filter((r) => r.patientId === patientId);
  }
  if (pharmacyId) {
    list = list.filter((r) => r.pharmacyId === pharmacyId);
  }

  // Enrich with labels
  const enriched = list.map((r) => {
    const med = store.medicines.find((m) => m.id === r.medicineId);
    const pharma = store.pharmacies.find((p) => p.id === r.pharmacyId);
    return {
      ...r,
      medicineLabel: med ? medLabel(med) : r.medicineId,
      pharmacyName: pharma ? pharma.name : r.pharmacyId,
    };
  });

  return ok(enriched);
}

export async function POST(req: NextRequest) {
  const data = await parseBody<{
    patientId?: string;
    patientName?: string;
    medicineId: string;
    pharmacyId: string;
    quantity: number;
    type: 'confirm' | 'reserve';
    note?: string;
  }>(req);

  if (!data?.medicineId || !data?.pharmacyId || !data?.quantity || !data?.type) {
    return bad('Missing required fields: medicineId, pharmacyId, quantity, type.');
  }

  if (data.quantity < 1 || data.quantity > 1000) {
    return bad('Quantity must be between 1 and 1000.');
  }

  const store = db();
  const pharmacy = store.pharmacies.find((p) => p.id === data.pharmacyId);
  if (!pharmacy || pharmacy.status !== 'verified') {
    return bad('Pharmacy not found or not verified.', 404);
  }

  const medicine = store.medicines.find((m) => m.id === data.medicineId);
  if (!medicine) {
    return bad('Medicine not found in catalogue.', 404);
  }

  const session = who(req);
  const patientId = data.patientId || session.patientId;
  const patientName = data.patientName || session.user || 'Patient';

  // Conflict: 409 if same patient+pharmacy+medicine already has an active request
  const activeConflict = store.requests.find(
    (r) =>
      r.patientId === patientId &&
      r.pharmacyId === pharmacy.id &&
      r.medicineId === medicine.id &&
      ['pending', 'confirmed', 'reserved'].includes(r.status)
  );
  if (activeConflict) {
    return bad(
      `You already have an active ${activeConflict.type} request (${activeConflict.status}) for ${medLabel(medicine)} at this pharmacy.`,
      409
    );
  }

  const newReq: StockRequest = {
    id: uid('req'),
    patientId,
    patientName,
    medicineId: medicine.id,
    pharmacyId: pharmacy.id,
    quantity: data.quantity,
    type: data.type,
    status: 'pending',
    note: (data.note || '').trim(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  store.requests.unshift(newReq);

  notify(
    pharmacy.id,
    `New ${data.type.toUpperCase()} request from ${patientName} for ${data.quantity} units of ${medLabel(medicine)}.`
  );
  audit(
    patientName,
    'request_submitted',
    `Patient ${patientName} submitted ${data.type} request for ${data.quantity} × ${medLabel(medicine)} at ${pharmacy.name}`
  );

  save();
  return ok(newReq, 201);
}
