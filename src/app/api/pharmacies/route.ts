import { NextRequest } from 'next/server';
import { db, save, uid, nowIso, notify, audit } from '@/lib/db';
import { ok, bad, who, parseBody } from '@/lib/api';
import { Pharmacy } from '@/lib/types';
import { PROVINCE_MAP } from '@/lib/seed';


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const showAll = searchParams.get('all') === '1';
  const session = who(req);

  const store = db();
  if (showAll && (session.role === 'admin' || session.role === 'pharmacist')) {
    return ok(store.pharmacies);
  }

  // Public view: only verified
  return ok(store.pharmacies.filter((p) => p.status === 'verified'));
}

export async function POST(req: NextRequest) {
  const data = await parseBody<Partial<Pharmacy>>(req);
  if (
    !data?.name ||
    !data?.district ||
    !data?.town ||
    !data?.address ||
    !data?.phone ||
    !data?.licenceNo
  ) {
    return bad('Missing required pharmacy fields: name, district, town, address, phone, licenceNo.');
  }

  const province = PROVINCE_MAP[data.district] || 'Western';
  const newPharma: Pharmacy = {
    id: uid('p'),
    name: data.name.trim(),
    district: data.district.trim(),
    province,
    town: data.town.trim(),
    address: data.address.trim(),
    phone: data.phone.trim(),
    hours: data.hours?.trim() || '8:00 AM - 9:00 PM',
    lat: Number(data.lat) || 6.9271,
    lng: Number(data.lng) || 79.8612,
    licenceNo: data.licenceNo.trim(),
    status: 'pending',
  };

  const store = db();
  store.pharmacies.push(newPharma);

  audit('public', 'pharmacy_registered', `New pharmacy registered for NMRA verification: ${newPharma.name} (${newPharma.town})`);
  notify('admin', `New pharmacy registration submitted: ${newPharma.name} (${newPharma.district}). Awaiting NMRA verification.`);

  save();
  return ok(newPharma, 201);
}
