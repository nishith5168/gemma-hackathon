import { NextRequest } from 'next/server';
import { db, save, uid, nowIso, isFresh, medLabel, audit } from '@/lib/db';
import { ok, bad, requirePharmacy, who, parseBody } from '@/lib/api';
import { stockBand } from '@/lib/ops';
import { InventoryItem } from '@/lib/types';


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pharmacyId = searchParams.get('pharmacyId');

  if (!pharmacyId) {
    return bad('Missing required parameter: pharmacyId.');
  }

  const guard = requirePharmacy(req, pharmacyId);
  if (guard) return guard;

  const store = db();
  const items = store.inventory.filter((i) => i.pharmacyId === pharmacyId);
  const now = new Date().getTime();

  const enriched = items.map((i) => {
    const med = store.medicines.find((m) => m.id === i.medicineId);
    const available = Math.max(0, i.quantity - i.reserved);
    const band = stockBand({ available, lowThreshold: i.lowThreshold });
    const fresh = isFresh(i.updatedAt, store.settings.freshnessHours);

    let expiringSoon = false;
    if (i.expiry) {
      const expTime = new Date(i.expiry).getTime();
      const daysLeft = (expTime - now) / (24 * 3600 * 1000);
      if (daysLeft >= 0 && daysLeft <= 60) {
        expiringSoon = true;
      }
    }

    return {
      ...i,
      medicine: med,
      medicineLabel: med ? medLabel(med) : i.medicineId,
      available,
      band,
      fresh,
      expiringSoon,
    };
  });

  return ok(enriched);
}

export async function POST(req: NextRequest) {
  const data = await parseBody<{
    pharmacyId: string;
    medicineId: string;
    quantity?: number;
    batch?: string;
    expiry?: string;
    lowThreshold?: number;
  }>(req);

  if (!data?.pharmacyId || !data?.medicineId) {
    return bad('Missing required fields: pharmacyId, medicineId.');
  }

  const guard = requirePharmacy(req, data.pharmacyId);
  if (guard) return guard;

  const store = db();
  const exists = store.inventory.find(
    (i) => i.pharmacyId === data.pharmacyId && i.medicineId === data.medicineId
  );
  if (exists) {
    return bad('This medicine is already tracked in your pharmacy inventory.', 409);
  }

  const med = store.medicines.find((m) => m.id === data.medicineId);
  if (!med) {
    return bad('Medicine not found in catalogue.', 404);
  }

  const session = who(req);
  const initialQty = Math.max(0, Number(data.quantity) || 0);

  const newItem: InventoryItem = {
    id: uid('inv'),
    pharmacyId: data.pharmacyId,
    medicineId: data.medicineId,
    quantity: initialQty,
    reserved: 0,
    batch: (data.batch || '').trim(),
    expiry: (data.expiry || '').trim(),
    lowThreshold: Number(data.lowThreshold) || 10,
    updatedAt: nowIso(),
  };

  store.inventory.push(newItem);

  if (initialQty > 0) {
    store.history.unshift({
      id: uid('h'),
      inventoryId: newItem.id,
      pharmacyId: data.pharmacyId,
      medicineId: data.medicineId,
      change: initialQty,
      qtyAfter: initialQty,
      reason: 'received',
      at: nowIso(),
      actor: session.user,
    });
  }

  audit(
    session.user,
    'inventory_added',
    `Added catalogue item ${medLabel(med)} (initial stock: ${initialQty}) to pharmacy ${data.pharmacyId}`
  );

  save();
  return ok(newItem, 201);
}
