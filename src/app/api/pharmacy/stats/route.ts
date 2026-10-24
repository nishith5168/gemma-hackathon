import { NextRequest } from 'next/server';
import { db, medLabel } from '@/lib/db';
import { ok, bad, requirePharmacy } from '@/lib/api';


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
  const now = Date.now();

  let lowStock = 0;
  let outOfStock = 0;
  let expiringSoon = 0;
  let reservedUnits = 0;

  for (const item of items) {
    const avail = Math.max(0, item.quantity - item.reserved);
    reservedUnits += item.reserved;

    if (avail <= 0) {
      outOfStock++;
    } else if (avail <= item.lowThreshold) {
      lowStock++;
    }

    if (item.expiry) {
      const expDays = (new Date(item.expiry).getTime() - now) / (24 * 3600 * 1000);
      if (expDays >= 0 && expDays <= 60) {
        expiringSoon++;
      }
    }
  }

  const pendingRequests = store.requests.filter(
    (r) => r.pharmacyId === pharmacyId && r.status === 'pending'
  ).length;

  // 7-day daily dispensed & top dispensed
  const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;
  const recentDispensed = store.history.filter(
    (h) =>
      h.pharmacyId === pharmacyId &&
      (h.reason === 'dispensed' || h.reason === 'reservation_collected') &&
      new Date(h.at).getTime() >= sevenDaysAgo
  );

  const medDispensedMap: Record<string, number> = {};
  const dayDispensedMap: Record<string, number> = {};

  for (const h of recentDispensed) {
    const qty = -h.change;
    medDispensedMap[h.medicineId] = (medDispensedMap[h.medicineId] || 0) + qty;

    const dayKey = h.at.slice(5, 10);
    dayDispensedMap[dayKey] = (dayDispensedMap[dayKey] || 0) + qty;
  }

  const topDispensed = Object.entries(medDispensedMap)
    .map(([medId, units]) => {
      const med = store.medicines.find((m) => m.id === medId);
      return {
        medicineId: medId,
        label: med ? medLabel(med) : medId,
        units,
      };
    })
    .sort((a, b) => b.units - a.units)
    .slice(0, 5);

  const dailyDispensed = Object.entries(dayDispensedMap).map(([date, units]) => ({
    date,
    units,
  }));

  return ok({
    lines: items.length,
    lowStock,
    outOfStock,
    expiringSoon,
    reservedUnits,
    pendingRequests,
    topDispensed,
    dailyDispensed,
  });
}
