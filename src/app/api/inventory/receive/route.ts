import { NextRequest } from 'next/server';
import { db, save, uid, nowIso, audit, medLabel } from '@/lib/db';
import { ok, bad, requirePharmacy, who, parseBody } from '@/lib/api';
import { getOrCreateItem } from '@/lib/ops';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const data = await parseBody<{
    pharmacyId: string;
    supplier?: string;
    lines: {
      medicineId: string;
      quantity: number;
      batch?: string;
      expiry?: string;
    }[];
  }>(req);

  if (!data?.pharmacyId || !data?.lines || !Array.isArray(data.lines) || data.lines.length === 0) {
    return bad('Missing pharmacyId or lines array.');
  }

  const guard = requirePharmacy(req, data.pharmacyId);
  if (guard) return guard;

  const store = db();
  const session = who(req);

  // Validate all lines first (all-or-nothing)
  for (const line of data.lines) {
    if (!line.medicineId) return bad('Each line must have a medicineId.');
    const med = store.medicines.find((m) => m.id === line.medicineId);
    if (!med) return bad(`Medicine '${line.medicineId}' not found in catalogue.`, 404);
    if (!line.quantity || line.quantity <= 0) {
      return bad(`Line quantity for ${medLabel(med)} must be greater than 0.`);
    }
  }

  // Apply all lines
  let totalUnits = 0;
  for (const line of data.lines) {
    const item = getOrCreateItem(data.pharmacyId, line.medicineId);
    item.quantity += line.quantity;
    if (line.batch) item.batch = line.batch;
    if (line.expiry) item.expiry = line.expiry;
    item.updatedAt = nowIso();
    totalUnits += line.quantity;

    store.history.unshift({
      id: uid('h'),
      inventoryId: item.id,
      pharmacyId: data.pharmacyId,
      medicineId: line.medicineId,
      change: line.quantity,
      qtyAfter: item.quantity,
      reason: 'received',
      at: nowIso(),
      actor: `${session.user} (${data.supplier || 'Supplier Delivery'})`,
    });
  }

  audit(
    session.user,
    'stock_received_invoice',
    `Received ${totalUnits} units across ${data.lines.length} lines from supplier '${data.supplier || 'Medical Distributor'}' at pharmacy ${data.pharmacyId}`
  );

  save();
  return ok({ receivedLines: data.lines.length, totalUnits, pharmacyId: data.pharmacyId });
}
