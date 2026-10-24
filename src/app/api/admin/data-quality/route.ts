import { NextRequest } from 'next/server';
import { db, isFresh, medLabel } from '@/lib/db';
import { ok, requireRole } from '@/lib/api';


export async function GET(req: NextRequest) {
  const guard = requireRole(req, ['admin']);
  if (guard) return guard;

  const store = db();
  const todayStr = new Date().toISOString().slice(0, 10);

  // 1. Stale records
  const staleItems = store.inventory
    .filter((i) => !isFresh(i.updatedAt, store.settings.freshnessHours))
    .map((i) => {
      const med = store.medicines.find((m) => m.id === i.medicineId);
      const pharma = store.pharmacies.find((p) => p.id === i.pharmacyId);
      return {
        id: i.id,
        pharmacyName: pharma?.name || i.pharmacyId,
        medicineLabel: med ? medLabel(med) : i.medicineId,
        lastUpdated: i.updatedAt,
      };
    });

  // 2. Non-reporting pharmacies (zero fresh items)
  const nonReportingPharmacies = store.pharmacies
    .filter((p) => p.status === 'verified')
    .filter((p) => {
      const pItems = store.inventory.filter((i) => i.pharmacyId === p.id);
      return !pItems.some((i) => isFresh(i.updatedAt, store.settings.freshnessHours));
    });

  // 3. Large adjustments (>= 500 units)
  const largeAdjustments = store.history
    .filter((h) => Math.abs(h.change) >= 500)
    .map((h) => {
      const med = store.medicines.find((m) => m.id === h.medicineId);
      const pharma = store.pharmacies.find((p) => p.id === h.pharmacyId);
      return {
        ...h,
        pharmacyName: pharma?.name || h.pharmacyId,
        medicineLabel: med ? medLabel(med) : h.medicineId,
      };
    });

  // 4. Expired stock still listed
  const expiredStock = store.inventory
    .filter((i) => i.expiry && i.expiry < todayStr && i.quantity > 0)
    .map((i) => {
      const med = store.medicines.find((m) => m.id === i.medicineId);
      const pharma = store.pharmacies.find((p) => p.id === i.pharmacyId);
      return {
        id: i.id,
        pharmacyName: pharma?.name || i.pharmacyId,
        medicineLabel: med ? medLabel(med) : i.medicineId,
        quantity: i.quantity,
        expiry: i.expiry,
      };
    });

  return ok({
    staleRecordsCount: staleItems.length,
    staleItems: staleItems.slice(0, 50),
    nonReportingPharmaciesCount: nonReportingPharmacies.length,
    nonReportingPharmacies,
    largeAdjustmentsCount: largeAdjustments.length,
    largeAdjustments: largeAdjustments.slice(0, 50),
    expiredStockCount: expiredStock.length,
    expiredStock,
  });
}
