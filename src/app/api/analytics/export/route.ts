import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/api';
import { allForecasts } from '@/lib/forecast';


export async function GET(req: NextRequest) {
  const guard = requireRole(req, ['analyst', 'admin']);
  if (guard) return guard;

  const store = db();
  const forecasts = allForecasts(store);

  let csv = `# MedSignal LK Intelligence Export - Synthetic Data Only - Alerts represent potential risk among participating reporting pharmacies\n`;
  csv += `District,Province,Medicine,Generic,Strength,Form,RiskLevel,DaysOfSupply,ProjectedDepletionDay,AvailableStock,SmoothedDailyDemand,DemandTrend,ConfirmedIncoming,AnomalyZ,LowStockShare,ReportingCoverage,FreshPharmacies,TotalPharmacies\n`;

  for (const f of forecasts) {
    const med = store.medicines.find((m) => m.id === f.medicineId);
    csv += `"${f.district}","${f.province}","${f.medicineLabel}","${med?.generic || ''}","${med?.strength || ''}","${med?.form || ''}","${f.risk}",${f.daysOfSupply ?? 'N/A'},${f.depletionDay ?? 'None'},${f.available},${f.avgDemand},${f.demandTrend},${f.incoming},${f.anomalyZ},${f.lowStockShare},${(f.coverage * 100).toFixed(0)}%,${f.pharmaciesFresh},${f.pharmaciesTotal}\n`;
  }

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="medsignal-shortage-report-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
