import { NextRequest } from 'next/server';
import { db, save, notify, audit } from '@/lib/db';
import { ok, bad, requireRole, who, parseBody } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const guard = requireRole(req, ['admin']);
  if (guard) return guard;

  const data = await parseBody<{ id: string; decision: 'verified' | 'rejected'; reason?: string }>(req);
  if (!data?.id || !data?.decision || !['verified', 'rejected'].includes(data.decision)) {
    return bad('Missing or invalid id or decision.');
  }

  const store = db();
  const pharmacy = store.pharmacies.find((p) => p.id === data.id);
  if (!pharmacy) {
    return bad('Pharmacy not found.', 404);
  }

  pharmacy.status = data.decision;
  const session = who(req);
  audit(
    session.user,
    `pharmacy_${data.decision}`,
    `${session.user} marked ${pharmacy.name} (${pharmacy.id}) as ${data.decision}. Note: ${data.reason || 'None'}`
  );

  notify(
    pharmacy.id,
    `Your pharmacy registration has been ${data.decision.toUpperCase()} by NMRA administration.${data.reason ? ` Reason: ${data.reason}` : ''}`
  );

  save();
  return ok(pharmacy);
}
