import { NextRequest } from 'next/server';
import { db, isFresh } from '@/lib/db';
import { ok, bad } from '@/lib/api';
import { stockBand } from '@/lib/ops';


function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const medicineId = searchParams.get('medicineId');
  const district = searchParams.get('district');
  const userLat = searchParams.get('lat') ? Number(searchParams.get('lat')) : null;
  const userLng = searchParams.get('lng') ? Number(searchParams.get('lng')) : null;

  if (!medicineId) {
    return bad('Missing required parameter: medicineId.');
  }

  const store = db();
  const med = store.medicines.find((m) => m.id === medicineId);
  if (!med) {
    return bad('Medicine not found in catalogue.', 404);
  }

  // Only verified pharmacies
  let verified = store.pharmacies.filter((p) => p.status === 'verified');
  if (district && district !== 'ALL') {
    verified = verified.filter((p) => p.district === district);
  }

  const results = [];

  for (const p of verified) {
    const item = store.inventory.find(
      (i) => i.pharmacyId === p.id && i.medicineId === medicineId
    );
    if (!item) continue;

    const available = Math.max(0, item.quantity - item.reserved);
    const band = stockBand({ available, lowThreshold: item.lowThreshold });
    const fresh = isFresh(item.updatedAt, store.settings.freshnessHours);

    let distanceKm: number | null = null;
    if (userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng)) {
      distanceKm = haversineKm(userLat, userLng, p.lat, p.lng);
    }

    results.push({
      pharmacy: p,
      band,
      lastVerified: item.updatedAt,
      fresh,
      distanceKm,
    });
  }

  // Sort band (in -> low -> out) then distance then freshness
  const bandRank = { in: 0, low: 1, out: 2 };
  results.sort((a, b) => {
    if (bandRank[a.band] !== bandRank[b.band]) {
      return bandRank[a.band] - bandRank[b.band];
    }
    if (a.distanceKm !== null && b.distanceKm !== null) {
      return a.distanceKm - b.distanceKm;
    }
    return new Date(b.lastVerified).getTime() - new Date(a.lastVerified).getTime();
  });

  return ok({
    medicine: med,
    results,
  });
}
