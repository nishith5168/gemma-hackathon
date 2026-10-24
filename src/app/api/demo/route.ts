import { NextRequest } from 'next/server';
import { resetDb } from '@/lib/db';
import { ok, bad, requireRole, who, parseBody } from '@/lib/api';
import { simulateSurge } from '@/lib/ops';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const guard = requireRole(req, ['analyst', 'admin']);
  if (guard) return guard;

  const data = await parseBody<{
    action: 'reset' | 'surge';
    medicineId?: string;
    district?: string;
    percent?: number;
  }>(req);

  if (!data?.action) {
    return bad('Missing demo action.');
  }

  const session = who(req);

  if (data.action === 'reset') {
    const freshDb = resetDb();
    return ok({
      success: true,
      message: 'Demo state successfully reset to initial deterministic seed.',
      seededAt: freshDb.seededAt,
      pharmaciesCount: freshDb.pharmacies.length,
      inventoryCount: freshDb.inventory.length,
    });
  }

  if (data.action === 'surge') {
    if (!data.medicineId || !data.district || data.percent === undefined) {
      return bad('Surge simulation requires medicineId, district, and percent (5-95).');
    }
    try {
      const res = simulateSurge(data.medicineId, data.district, Number(data.percent), session.user);
      return ok({
        success: true,
        message: `Surge simulation applied: ${data.percent}% depleted across ${res.affectedPharmacies} pharmacies.`,
        ...res,
      });
    } catch (err) {
      return bad(err instanceof Error ? err.message : 'Surge failed');
    }
  }

  return bad(`Unknown demo action '${data.action}'.`);
}
