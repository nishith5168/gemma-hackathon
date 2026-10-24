import { NextRequest } from 'next/server';
import { db, save, uid, nowIso, audit, medLabel } from '@/lib/db';
import { ok, bad, requirePharmacy, who, parseBody } from '@/lib/api';
import { HistoryReason } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const store = db();
  const item = store.inventory.find((i) => i.id === id);

  if (!item) {
    return bad('Inventory item not found.', 404);
  }

  const guard = requirePharmacy(req, item.pharmacyId);
  if (guard) return guard;

  const data = await parseBody<{
    change?: number;
    reason?: HistoryReason;
    setQuantity?: number;
    verifyOnly?: boolean;
    batch?: string;
    expiry?: string;
    lowThreshold?: number;
  }>(req);

  const session = who(req);
  const med = store.medicines.find((m) => m.id === item.medicineId);
  const medName = med ? medLabel(med) : item.medicineId;

  // Case 1: Verify Only (touch timestamp)
  if (data?.verifyOnly) {
    item.updatedAt = nowIso();
    audit(session.user, 'stock_verified', `Confirmed stock records are still accurate for ${medName} at pharmacy ${item.pharmacyId}`);
    save();
    return ok(item);
  }

  // Field edits
  if (data?.batch !== undefined) item.batch = data.batch.trim();
  if (data?.expiry !== undefined) item.expiry = data.expiry.trim();
  if (data?.lowThreshold !== undefined) item.lowThreshold = Math.max(1, Number(data.lowThreshold));

  // Case 2: Set absolute quantity
  if (data?.setQuantity !== undefined) {
    const target = Number(data.setQuantity);
    if (target < 0) return bad('Quantity cannot be negative.');
    if (target < item.reserved) {
      return bad(
        `Cannot set quantity to ${target}; active reservations hold ${item.reserved} units.`,
        409
      );
    }

    const diff = target - item.quantity;
    item.quantity = target;
    item.updatedAt = nowIso();

    if (diff !== 0) {
      store.history.unshift({
        id: uid('h'),
        inventoryId: item.id,
        pharmacyId: item.pharmacyId,
        medicineId: item.medicineId,
        change: diff,
        qtyAfter: target,
        reason: 'adjustment',
        at: nowIso(),
        actor: session.user,
      });
      audit(session.user, 'stock_adjustment', `Manually reset ${medName} quantity to ${target} (diff: ${diff > 0 ? '+' : ''}${diff})`);
    }

    save();
    return ok(item);
  }

  // Case 3: Apply delta change
  if (data?.change !== undefined) {
    const change = Number(data.change);
    const reason = data.reason || (change > 0 ? 'received' : 'dispensed');

    if (reason === 'dispensed' && change > 0) {
      return bad('Dispensed stock change must be a negative value (e.g. -10).');
    }
    if (reason === 'received' && change < 0) {
      return bad('Received stock change must be a positive value (e.g. +50).');
    }

    const newQty = item.quantity + change;
    if (newQty < 0) {
      return bad(`Insufficient stock to dispense (current: ${item.quantity}, requested change: ${change}).`, 409);
    }
    if (newQty < item.reserved) {
      return bad(`Quantity cannot drop below active reserved count of ${item.reserved} units.`, 409);
    }

    item.quantity = newQty;
    item.updatedAt = nowIso();

    store.history.unshift({
      id: uid('h'),
      inventoryId: item.id,
      pharmacyId: item.pharmacyId,
      medicineId: item.medicineId,
      change,
      qtyAfter: newQty,
      reason,
      at: nowIso(),
      actor: session.user,
    });

    audit(
      session.user,
      `stock_${reason}`,
      `Recorded ${reason}: ${change > 0 ? '+' : ''}${change} units of ${medName} (new on hand: ${newQty})`
    );

    save();
    return ok(item);
  }

  // Just field edits
  item.updatedAt = nowIso();
  save();
  return ok(item);
}
