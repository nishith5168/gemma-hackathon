import { NextRequest } from 'next/server';
import { db, save, nowIso, notify, audit, medLabel } from '@/lib/db';
import { ok, bad, who, parseBody, requirePharmacy } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const store = db();
  const requestItem = store.requests.find((r) => r.id === id);

  if (!requestItem) {
    return bad('Stock request not found.', 404);
  }

  const data = await parseBody<{
    action: 'confirm' | 'reserve' | 'reject' | 'collect' | 'cancel';
    note?: string;
    patientId?: string;
  }>(req);

  if (!data?.action) {
    return bad('Missing action parameter.');
  }

  const session = who(req);
  const med = store.medicines.find((m) => m.id === requestItem.medicineId);
  const medName = med ? medLabel(med) : requestItem.medicineId;
  const pharma = store.pharmacies.find((p) => p.id === requestItem.pharmacyId);

  // Find inventory item
  const invItem = store.inventory.find(
    (i) => i.pharmacyId === requestItem.pharmacyId && i.medicineId === requestItem.medicineId
  );
  const available = invItem ? Math.max(0, invItem.quantity - invItem.reserved) : 0;

  const currentStatus = requestItem.status;
  const action = data.action;

  // Handle Cancel (by patient)
  if (action === 'cancel') {
    if (!['pending', 'confirmed', 'reserved'].includes(currentStatus)) {
      return bad(`Cannot cancel a request that is already ${currentStatus}.`);
    }

    // Release if was reserved
    if (currentStatus === 'reserved' && invItem) {
      invItem.reserved = Math.max(0, invItem.reserved - requestItem.quantity);
      invItem.updatedAt = nowIso();
    }

    requestItem.status = 'cancelled';
    requestItem.updatedAt = nowIso();
    if (data.note) requestItem.note = data.note;

    notify(requestItem.pharmacyId, `Patient cancelled request for ${medName} (${requestItem.quantity} units).`);
    audit(session.user, 'request_cancelled', `Cancelled request ${id} for ${medName}`);
    save();
    return ok(requestItem);
  }

  // Pharmacy actions: Confirm, Reserve, Reject, Collect
  const guard = requirePharmacy(req, requestItem.pharmacyId);
  if (guard) return guard;

  if (action === 'confirm') {
    if (currentStatus !== 'pending') {
      return bad(`Cannot confirm a request in status '${currentStatus}'. Expected 'pending'.`);
    }
    if (available < requestItem.quantity) {
      return bad(`Insufficient stock available to confirm (available: ${available}, needed: ${requestItem.quantity}).`, 409);
    }

    requestItem.status = 'confirmed';
    requestItem.updatedAt = nowIso();
    if (invItem) invItem.updatedAt = nowIso(); // touch freshness

    notify(
      requestItem.patientId,
      `Your request for ${medName} was CONFIRMED by ${pharma?.name}. Please visit to collect.`
    );
    audit(session.user, 'request_confirmed', `Confirmed stock availability for request ${id} (${requestItem.quantity} units)`);
  } else if (action === 'reserve') {
    if (!['pending', 'confirmed'].includes(currentStatus)) {
      return bad(`Cannot reserve a request in status '${currentStatus}'. Expected 'pending' or 'confirmed'.`);
    }
    if (available < requestItem.quantity) {
      return bad(`Insufficient stock available to reserve (available: ${available}, requested: ${requestItem.quantity}).`, 409);
    }
    if (!invItem) {
      return bad('Inventory item not found.', 404);
    }

    invItem.reserved += requestItem.quantity;
    invItem.updatedAt = nowIso();

    requestItem.status = 'reserved';
    requestItem.updatedAt = nowIso();

    notify(
      requestItem.patientId,
      `Your reservation for ${requestItem.quantity} × ${medName} at ${pharma?.name} is SECURED. Stock is held for you.`
    );
    audit(session.user, 'request_reserved', `Reserved ${requestItem.quantity} units of ${medName} for request ${id}`);
  } else if (action === 'reject') {
    if (!['pending', 'confirmed', 'reserved'].includes(currentStatus)) {
      return bad(`Cannot reject a request in status '${currentStatus}'.`);
    }

    // Release hold if reserved
    if (currentStatus === 'reserved' && invItem) {
      invItem.reserved = Math.max(0, invItem.reserved - requestItem.quantity);
      invItem.updatedAt = nowIso();
    }

    requestItem.status = 'rejected';
    requestItem.updatedAt = nowIso();
    if (data.note) requestItem.note = data.note;

    notify(
      requestItem.patientId,
      `Your request for ${medName} at ${pharma?.name} could not be fulfilled.${data.note ? ` Note: ${data.note}` : ''}`
    );
    audit(session.user, 'request_rejected', `Rejected request ${id}. Reason: ${data.note || 'None'}`);
  } else if (action === 'collect') {
    if (!['confirmed', 'reserved'].includes(currentStatus)) {
      return bad(`Cannot mark collected from status '${currentStatus}'. Expected 'confirmed' or 'reserved'.`);
    }
    if (!invItem) {
      return bad('Inventory item not found.', 404);
    }

    if (currentStatus === 'reserved') {
      invItem.reserved = Math.max(0, invItem.reserved - requestItem.quantity);
      invItem.quantity = Math.max(0, invItem.quantity - requestItem.quantity);
      invItem.updatedAt = nowIso();

      store.history.unshift({
        id: `h_${Date.now()}`,
        inventoryId: invItem.id,
        pharmacyId: requestItem.pharmacyId,
        medicineId: requestItem.medicineId,
        change: -requestItem.quantity,
        qtyAfter: invItem.quantity,
        reason: 'reservation_collected',
        at: nowIso(),
        actor: session.user,
      });
    } else {
      // confirmed
      if (invItem.quantity < requestItem.quantity) {
        return bad(`Insufficient stock to dispense (available: ${invItem.quantity}, needed: ${requestItem.quantity}).`, 409);
      }
      invItem.quantity -= requestItem.quantity;
      invItem.updatedAt = nowIso();

      store.history.unshift({
        id: `h_${Date.now()}`,
        inventoryId: invItem.id,
        pharmacyId: requestItem.pharmacyId,
        medicineId: requestItem.medicineId,
        change: -requestItem.quantity,
        qtyAfter: invItem.quantity,
        reason: 'dispensed',
        at: nowIso(),
        actor: session.user,
      });
    }

    requestItem.status = 'collected';
    requestItem.updatedAt = nowIso();

    notify(requestItem.patientId, `Prescription order for ${medName} collected successfully from ${pharma?.name}. Thank you!`);
    audit(session.user, 'request_collected', `Dispensed ${requestItem.quantity} units for request ${id} upon patient collection`);
  } else {
    return bad(`Unknown action '${action}'.`);
  }

  save();
  return ok(requestItem);
}
