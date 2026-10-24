import { NextRequest } from 'next/server';
import { db, save, uid, nowIso, audit, medLabel } from '@/lib/db';
import { ok, bad, requirePharmacy, who, parseBody } from '@/lib/api';
import { getOrCreateItem } from '@/lib/ops';


export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const store = db();
  const rep = store.replenishments.find((r) => r.id === id);

  if (!rep) {
    return bad('Replenishment record not found.', 404);
  }

  const guard = requirePharmacy(req, rep.pharmacyId);
  if (guard) return guard;

  const data = await parseBody<{ status: 'received' | 'cancelled' }>(req);
  if (!data?.status || !['received', 'cancelled'].includes(data.status)) {
    return bad("Status must be either 'received' or 'cancelled'.");
  }

  if (rep.status !== 'expected') {
    return bad(`Cannot update replenishment already marked as '${rep.status}'.`);
  }

  const session = who(req);
  const med = store.medicines.find((m) => m.id === rep.medicineId);
  const medName = med ? medLabel(med) : rep.medicineId;

  rep.status = data.status;

  if (data.status === 'received') {
    const item = getOrCreateItem(rep.pharmacyId, rep.medicineId);
    item.quantity += rep.quantity;
    item.updatedAt = nowIso();

    store.history.unshift({
      id: uid('h'),
      inventoryId: item.id,
      pharmacyId: rep.pharmacyId,
      medicineId: rep.medicineId,
      change: rep.quantity,
      qtyAfter: item.quantity,
      reason: 'received',
      at: nowIso(),
      actor: `${session.user} (${rep.supplier})`,
    });

    audit(
      session.user,
      'replenishment_received',
      `Marked delivery from ${rep.supplier} as received: +${rep.quantity} units of ${medName} added to on-hand stock.`
    );
  } else {
    audit(
      session.user,
      'replenishment_cancelled',
      `Cancelled delivery order for ${rep.quantity} units of ${medName} from ${rep.supplier}`
    );
  }

  save();
  return ok(rep);
}
