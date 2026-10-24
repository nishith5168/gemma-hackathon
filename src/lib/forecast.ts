import { DB, Forecast, ForecastPoint, InventoryItem, RiskLevel } from './types';
import { isFresh, medLabel } from './db';

export const RISK_ORDER: Record<RiskLevel, number> = {
  critical: 0,
  high: 1,
  moderate: 2,
  insufficient: 3,
  low: 4,
};

export function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((acc, val) => acc + val, 0) / arr.length;
}

export function std(arr: number[]): number {
  if (arr.length <= 1) return 0.001;
  const m = mean(arr);
  const variance = arr.reduce((acc, val) => acc + (val - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

// Holt's linear smoothing
export function holtLinear(
  series: number[],
  alpha = 0.35,
  beta = 0.15
): { level: number; trend: number } {
  if (series.length === 0) return { level: 0, trend: 0 };
  if (series.length < 7) {
    const l = mean(series);
    return { level: Math.max(0, l), trend: 0 };
  }

  // Level initialized as mean of first 7 days, trend 0
  let level = mean(series.slice(0, 7));
  let trend = 0;

  for (let t = 7; t < series.length; t++) {
    const prevLevel = level;
    const value = series[t];
    level = alpha * value + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;

    // Clamp trend to ±max(0.5, 0.08 * level)
    const maxTrend = Math.max(0.5, 0.08 * level);
    trend = Math.max(-maxTrend, Math.min(maxTrend, trend));
  }

  return { level: Math.max(0, level), trend };
}

export function computeForecast(
  store: DB,
  medicineId: string,
  district: string | 'ALL'
): Forecast | null {
  const medicine = store.medicines.find((m) => m.id === medicineId);
  if (!medicine) return null;

  // Filter pharmacies
  const pharmacies = store.pharmacies.filter((p) => {
    if (p.status !== 'verified') return false;
    if (district !== 'ALL' && p.district !== district) return false;
    return true;
  });

  if (pharmacies.length === 0) return null;

  const pharmacyIds = new Set(pharmacies.map((p) => p.id));
  const items = store.inventory.filter(
    (i) => i.medicineId === medicineId && pharmacyIds.has(i.pharmacyId)
  );

  if (items.length === 0) return null;

  const totalCount = items.length;
  const freshItems = items.filter((i) => isFresh(i.updatedAt, store.settings.freshnessHours));
  const freshCount = freshItems.length;
  const coverage = totalCount > 0 ? freshCount / totalCount : 0;
  const freshPharmacyIds = new Set(freshItems.map((i) => i.pharmacyId));

  const samplePharmacy = pharmacies[0];
  const province = district === 'ALL' ? 'All Island' : samplePharmacy.province;
  const label = medLabel(medicine);

  // Reconstruct 30-day daily closing stock and daily dispensed series
  // We use fresh items only for all demand/stock calculations
  const now = new Date();
  const dailyDispensed: number[] = new Array(30).fill(0);
  const dailyStock: number[] = new Array(30).fill(0);

  // Map history records for fresh items
  const relevantHistory = store.history.filter(
    (h) => h.medicineId === medicineId && freshPharmacyIds.has(h.pharmacyId)
  );

  // Bucket history by day offset 1..30
  // day 1 = yesterday/today, day 30 = 30 days ago
  const dailyNetChanges: number[] = new Array(30).fill(0);
  const dailyDisp: number[] = new Array(30).fill(0);

  for (const h of relevantHistory) {
    const diffDays = Math.floor((now.getTime() - new Date(h.at).getTime()) / (24 * 3600 * 1000));
    if (diffDays >= 0 && diffDays < 30) {
      dailyNetChanges[diffDays] += h.change;
      if (h.reason === 'dispensed' || h.reason === 'reservation_collected') {
        dailyDisp[diffDays] += -h.change;
      }
    }
  }

  // Current on-hand total of fresh items
  const currentTotalStock = freshItems.reduce((acc, i) => acc + i.quantity, 0);
  const available = freshItems.reduce((acc, i) => acc + Math.max(0, i.quantity - i.reserved), 0);

  // Reconstruct historical closing stock backward
  // index 29 = 30 days ago, index 0 = today
  let rollingStock = currentTotalStock;
  for (let d = 0; d < 30; d++) {
    dailyStock[29 - d] = rollingStock;
    dailyDispensed[29 - d] = dailyDisp[d];
    rollingStock = Math.max(0, rollingStock - dailyNetChanges[d]);
  }

  // Demand smoothing (Holt's linear)
  const { level, trend } = holtLinear(dailyDispensed);
  const avgDemand = Math.max(0.01, level);

  // Incoming deliveries from expected replenishments
  const horizon = store.settings.horizonDays;
  const incomingByDay: number[] = new Array(horizon + 1).fill(0);
  let totalIncoming = 0;
  let overdueIncoming = 0;

  const relevantReplenishments = store.replenishments.filter(
    (r) =>
      r.medicineId === medicineId &&
      freshPharmacyIds.has(r.pharmacyId) &&
      r.status === 'expected'
  );

  for (const r of relevantReplenishments) {
    const expDate = new Date(r.expectedDate);
    const dayOffset = Math.ceil((expDate.getTime() - now.getTime()) / (24 * 3600 * 1000));

    if (dayOffset < 1) {
      // Overdue delivery: counts at day 1, flagged
      incomingByDay[1] += r.quantity;
      totalIncoming += r.quantity;
      overdueIncoming += r.quantity;
    } else if (dayOffset <= horizon) {
      incomingByDay[dayOffset] += r.quantity;
      totalIncoming += r.quantity;
    }
  }

  // Days of supply
  const daysOfSupply = level > 0.01 ? Number((available / level).toFixed(1)) : null;

  // Projection over horizon k = 1..H
  let projStock = available;
  let depletionDay: number | null = null;
  const projectedValues: number[] = [];

  for (let k = 1; k <= horizon; k++) {
    const projectedDemand = Math.max(0, level + k * trend);
    const incomingToday = incomingByDay[k] || 0;
    projStock = Math.max(0, projStock - projectedDemand + incomingToday);
    projectedValues.push(Number(projStock.toFixed(1)));

    if (projStock <= 0 && depletionDay === null) {
      depletionDay = k;
    }
  }

  // Anomaly calculation
  // z = (mean(last 7) - mean(previous 21)) / std(previous 21)
  const prev21 = dailyDispensed.slice(2, 23);
  const last7 = dailyDispensed.slice(23, 30);
  const mPrev = mean(prev21);
  const sPrev = std(prev21);
  const mLast = mean(last7);
  const anomalyZ = sPrev > 0.001 ? Number(((mLast - mPrev) / sPrev).toFixed(2)) : 0;

  const lowStockCount = freshItems.filter(
    (i) => Math.max(0, i.quantity - i.reserved) <= i.lowThreshold
  ).length;
  const lowStockShare = freshCount > 0 ? Number((lowStockCount / freshCount).toFixed(2)) : 0;

  const anomaly = anomalyZ >= store.settings.anomalyZ || lowStockShare >= 0.5;

  // Confidence
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (coverage >= 0.8 && freshCount >= 3) {
    confidence = 'high';
  } else if (
    coverage >= store.settings.minCoverage &&
    freshCount >= store.settings.minPharmacies
  ) {
    confidence = 'medium';
  }

  // Risk Classification
  let risk: RiskLevel = 'low';
  const settings = store.settings;

  if (coverage < settings.minCoverage || freshCount < settings.minPharmacies) {
    risk = 'insufficient';
    depletionDay = null;
  } else {
    const D = depletionDay;

    if (D !== null && D <= settings.criticalDays) {
      if (anomaly || lowStockShare >= 0.5) {
        risk = 'critical';
      } else {
        risk = 'high';
      }
    } else if (
      (D !== null && D <= settings.highDays && totalIncoming === 0) ||
      (D === null && daysOfSupply !== null && daysOfSupply <= settings.highDays && totalIncoming === 0)
    ) {
      risk = 'high';
    } else if (
      (D !== null && D <= settings.moderateDays) ||
      (daysOfSupply !== null && daysOfSupply <= settings.moderateDays) ||
      anomaly ||
      (totalIncoming > 0 && daysOfSupply !== null && daysOfSupply <= settings.highDays) ||
      overdueIncoming > 0
    ) {
      risk = 'moderate';
    } else {
      risk = 'low';
    }
  }

  // Human-readable evidence lines with explicit numbers
  const evidence: string[] = [];
  evidence.push(
    `Data freshness coverage: ${(coverage * 100).toFixed(0)}% (${freshCount}/${totalCount} verified pharmacies reporting).`
  );
  if (totalCount > freshCount) {
    evidence.push(
      `${totalCount - freshCount} pharmacy records excluded due to staleness (> ${store.settings.freshnessHours}h without update).`
    );
  }
  evidence.push(
    `Total available stock among fresh reporting pharmacies: ${available} units.`
  );
  evidence.push(
    `Smoothed daily consumption rate: ${avgDemand.toFixed(1)} units/day (trend: ${trend >= 0 ? '+' : ''}${trend.toFixed(2)}/day).`
  );

  if (daysOfSupply !== null) {
    evidence.push(
      `Current days of supply: ${daysOfSupply} days based on current burn rate.`
    );
  }

  if (depletionDay !== null) {
    evidence.push(
      `Projected stock-out depletion estimated on Day ${depletionDay} (${depletionDay <= settings.criticalDays ? 'CRITICAL urgency' : 'action required'}).`
    );
  } else if (risk !== 'insufficient') {
    evidence.push(`No projected depletion within the ${horizon}-day analysis horizon.`);
  }

  if (totalIncoming > 0) {
    evidence.push(
      `Confirmed incoming replenish orders: ${totalIncoming} units scheduled within ${horizon} days.`
    );
  }
  if (overdueIncoming > 0) {
    evidence.push(
      `WARNING: ${overdueIncoming} units from scheduled deliveries are overdue.`
    );
  }

  if (anomalyZ >= settings.anomalyZ) {
    evidence.push(
      `Demand surge anomaly detected: Z-score is +${anomalyZ} (exceeds threshold ${settings.anomalyZ}).`
    );
  }
  if (lowStockShare >= 0.5) {
    evidence.push(
      `High low-stock clustering: ${(lowStockShare * 100).toFixed(0)}% of fresh reporting pharmacies are at or below threshold.`
    );
  }

  // Series formatting for Recharts: 30 historical points + horizon projected points
  const series: ForecastPoint[] = [];

  for (let i = 0; i < 30; i++) {
    const d = new Date(now.getTime() - (29 - i) * 24 * 3600 * 1000);
    const dateStr = d.toISOString().slice(5, 10);
    const isLast = i === 29;
    series.push({
      date: dateStr,
      stock: dailyStock[i],
      // The last historical point joins the projected line
      projected: isLast ? available : null,
    });
  }

  for (let k = 1; k <= horizon; k++) {
    const d = new Date(now.getTime() + k * 24 * 3600 * 1000);
    const dateStr = d.toISOString().slice(5, 10);
    series.push({
      date: dateStr,
      stock: null,
      projected: projectedValues[k - 1],
    });
  }

  return {
    medicineId,
    medicineLabel: label,
    district,
    province,
    pharmaciesTotal: totalCount,
    pharmaciesFresh: freshCount,
    coverage: Number(coverage.toFixed(2)),
    available,
    avgDemand: Number(avgDemand.toFixed(1)),
    demandTrend: Number(trend.toFixed(2)),
    incoming: totalIncoming,
    daysOfSupply,
    depletionDay,
    anomalyZ,
    anomaly,
    lowStockShare,
    confidence,
    risk,
    evidence,
    series,
  };
}

export function allForecasts(
  store: DB,
  filters?: { district?: string; province?: string; medicineId?: string }
): Forecast[] {
  const districts = new Set<string>();
  for (const p of store.pharmacies) {
    if (p.status === 'verified') {
      if (filters?.province && p.province !== filters.province) continue;
      if (filters?.district && p.district !== filters.district) continue;
      districts.add(p.district);
    }
  }

  const medicineIds = filters?.medicineId
    ? [filters.medicineId]
    : store.medicines.map((m) => m.id);

  const results: Forecast[] = [];

  for (const dist of districts) {
    for (const medId of medicineIds) {
      const f = computeForecast(store, medId, dist);
      if (f) {
        results.push(f);
      }
    }
  }

  // Sort by risk order (critical, high, moderate, insufficient, low) then depletionDay
  results.sort((a, b) => {
    const rankA = RISK_ORDER[a.risk];
    const rankB = RISK_ORDER[b.risk];
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    const depA = a.depletionDay ?? 999;
    const depB = b.depletionDay ?? 999;
    return depA - depB;
  });

  return results;
}
