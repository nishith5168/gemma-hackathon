import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, bad, requireRole } from '@/lib/api';
import { allForecasts, computeForecast } from '@/lib/forecast';
import { forecastNoSeries } from '@/lib/ops';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const guard = requireRole(req, ['analyst', 'admin']);
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const province = searchParams.get('province') || undefined;
  const district = searchParams.get('district') || undefined;
  const medicineId = searchParams.get('medicineId') || undefined;
  const single = searchParams.get('single') === '1';

  const store = db();

  if (single) {
    if (!medicineId || !district) {
      return bad('Single forecast lookup requires medicineId and district parameters.');
    }
    const f = computeForecast(store, medicineId, district);
    if (!f) return bad('Forecast could not be generated for this pair.', 404);
    return ok(f);
  }

  const results = allForecasts(store, { province, district, medicineId });
  // Omit series for bulk listing to optimize network payload
  const list = results.map((f) => forecastNoSeries(f));

  return ok(list);
}
