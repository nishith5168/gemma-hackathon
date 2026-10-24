import { NextRequest } from 'next/server';
import { db, isFresh } from '@/lib/db';
import { ok, requireRole } from '@/lib/api';
import { allForecasts, RISK_ORDER } from '@/lib/forecast';
import { RiskLevel } from '@/lib/types';


export async function GET(req: NextRequest) {
  const guard = requireRole(req, ['analyst', 'admin']);
  if (guard) return guard;

  const store = db();
  const verifiedPharmacies = store.pharmacies.filter((p) => p.status === 'verified');
  const allInv = store.inventory;

  const freshInv = allInv.filter((i) => isFresh(i.updatedAt, store.settings.freshnessHours));
  const freshPercentage = allInv.length > 0 ? Math.round((freshInv.length / allInv.length) * 100) : 0;

  const openAlerts = store.alerts.filter((a) => a.status === 'open');

  const forecasts = allForecasts(store);

  const riskCounts: Record<RiskLevel, number> = {
    critical: 0,
    high: 0,
    moderate: 0,
    insufficient: 0,
    low: 0,
  };

  for (const f of forecasts) {
    riskCounts[f.risk] = (riskCounts[f.risk] || 0) + 1;
  }

  // District breakdowns
  const districts = Array.from(new Set(verifiedPharmacies.map((p) => p.district)));
  const districtSummaries = districts.map((district) => {
    const pharmaInDist = verifiedPharmacies.filter((p) => p.district === district);
    const pIds = new Set(pharmaInDist.map((p) => p.id));
    const distInv = allInv.filter((i) => pIds.has(i.pharmacyId));
    const distFresh = distInv.filter((i) => isFresh(i.updatedAt, store.settings.freshnessHours));
    const freshShare = distInv.length > 0 ? Number((distFresh.length / distInv.length).toFixed(2)) : 0;

    const distForecasts = forecasts.filter((f) => f.district === district);
    let worstRisk: RiskLevel = 'low';
    for (const f of distForecasts) {
      if (RISK_ORDER[f.risk] < RISK_ORDER[worstRisk]) {
        worstRisk = f.risk;
      }
    }

    const activeAlerts = store.alerts.filter(
      (a) => a.district === district && (a.status === 'open' || a.status === 'acknowledged')
    ).length;

    return {
      district,
      province: pharmaInDist[0]?.province || 'Western',
      pharmacies: pharmaInDist.length,
      freshShare,
      worstRisk,
      activeAlerts,
    };
  });

  return ok({
    kpis: {
      reportingPharmacies: verifiedPharmacies.length,
      monitoredMedicines: store.medicines.length,
      openAlerts: openAlerts.length,
      reportingDistricts: districts.length,
      freshPercentage,
      criticalCount: riskCounts.critical,
      highCount: riskCounts.high,
    },
    riskCounts,
    districtSummaries,
  });
}
