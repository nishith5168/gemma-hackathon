import { DB, Forecast, HistoryReason, InventoryItem, ShortageAlert } from './types';
import { db, save, uid, nowIso, audit, notify, medLabel, findMedicine, findPharmacy } from './db';
import { allForecasts, computeForecast } from './forecast';

export function stockBand(
  item: { available?: number; quantity?: number; reserved?: number; lowThreshold?: number }
): 'in' | 'low' | 'out' {
  const qty = item.quantity ?? 0;
  const res = item.reserved ?? 0;
  const avail = item.available !== undefined ? item.available : Math.max(0, qty - res);
  const threshold = item.lowThreshold ?? 10;

  if (avail <= 0) return 'out';
  if (avail <= threshold) return 'low';
  return 'in';
}

export function getOrCreateItem(pharmacyId: string, medicineId: string): InventoryItem {
  const store = db();
  let item = store.inventory.find(
    (i) => i.pharmacyId === pharmacyId && i.medicineId === medicineId
  );

  if (!item) {
    const med = findMedicine(medicineId);
    item = {
      id: uid('inv'),
      pharmacyId,
      medicineId,
      quantity: 0,
      reserved: 0,
      batch: '',
      expiry: '',
      lowThreshold: 10,
      updatedAt: nowIso(),
    };
    store.inventory.push(item);
    audit('system', 'inventory_created', `Added inventory line for ${med ? medLabel(med) : medicineId} at pharmacy ${pharmacyId}`);
  }
  return item;
}

export function applyStockChange(
  pharmacyId: string,
  medicineId: string,
  change: number,
  reason: HistoryReason,
  actor: string,
  edits?: { batch?: string; expiry?: string; lowThreshold?: number }
): { item: InventoryItem; error?: string } {
  const store = db();
  const item = getOrCreateItem(pharmacyId, medicineId);

  // Validate invariants
  const newQty = item.quantity + change;
  if (newQty < 0) {
    return { item, error: `Insufficient stock on hand (current: ${item.quantity}, change: ${change}).` };
  }
  if (newQty < item.reserved) {
    return {
      item,
      error: `Cannot reduce quantity below active reserved count (reserved: ${item.reserved}, requested new quantity: ${newQty}).`,
    };
  }

  // Update item
  item.quantity = newQty;
  if (edits?.batch !== undefined) item.batch = edits.batch;
  if (edits?.expiry !== undefined) item.expiry = edits.expiry;
  if (edits?.lowThreshold !== undefined) item.lowThreshold = edits.lowThreshold;
  item.updatedAt = nowIso();

  // History record
  if (change !== 0) {
    store.history.unshift({
      id: uid('h'),
      inventoryId: item.id,
      pharmacyId,
      medicineId,
      change,
      qtyAfter: newQty,
      reason,
      at: nowIso(),
      actor,
    });
  }

  const med = findMedicine(medicineId);
  const label = med ? medLabel(med) : medicineId;
  audit(
    actor,
    `stock_${reason}`,
    `${actor} adjusted ${label} by ${change > 0 ? '+' : ''}${change} (new total: ${newQty}, available: ${newQty - item.reserved}) at pharmacy ${pharmacyId}`
  );

  save();
  return { item };
}

export function forecastNoSeries(f: Forecast): Omit<Forecast, 'series'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { series, ...rest } = f;
  return rest;
}

export function runAnalysis(actor = 'analyst'): {
  forecasts: number;
  created: number;
  updated: number;
  pharmacyNotices: number;
} {
  const store = db();
  const forecasts = allForecasts(store);

  let created = 0;
  let updated = 0;
  let pharmacyNotices = 0;

  for (const f of forecasts) {
    const med = findMedicine(f.medicineId);
    const medName = med ? medLabel(med) : f.medicineId;

    if (f.risk === 'critical' || f.risk === 'high') {
      // Find existing open or acknowledged alert
      const existing = store.alerts.find(
        (a) =>
          a.medicineId === f.medicineId &&
          a.district === f.district &&
          (a.status === 'open' || a.status === 'acknowledged')
      );

      if (existing) {
        existing.risk = f.risk;
        existing.snapshot = forecastNoSeries(f);
        updated++;
      } else {
        const newAlert: ShortageAlert = {
          id: uid('alert'),
          medicineId: f.medicineId,
          district: f.district,
          risk: f.risk,
          snapshot: forecastNoSeries(f),
          status: 'open',
          notes: '',
          createdAt: nowIso(),
          reviewedAt: null,
          reviewer: null,
          explanations: {},
        };
        store.alerts.unshift(newAlert);
        created++;

        notify(
          'analyst',
          `Early warning alert: ${f.risk.toUpperCase()} risk projected for ${medName} in ${f.district} district.`
        );
      }
    } else if (f.risk === 'moderate') {
      // Notify verified pharmacies in that district stocking the medicine
      const pharmaciesInDistrict = store.pharmacies.filter(
        (p) => p.status === 'verified' && p.district === f.district
      );
      for (const p of pharmaciesInDistrict) {
        const hasStock = store.inventory.some(
          (i) => i.pharmacyId === p.id && i.medicineId === f.medicineId
        );
        if (hasStock) {
          notify(
            p.id,
            `Supply advisory: Moderate stock depletion risk projected for ${medName} in your district (${f.district}). Reorder review recommended.`
          );
          pharmacyNotices++;
        }
      }
    }
  }

  audit(
    actor,
    'run_shortage_analysis',
    `Analyzed ${forecasts.length} district-medicine pairs. Created ${created} new alerts, updated ${updated} existing alerts, issued ${pharmacyNotices} pharmacy advisories.`
  );

  save();
  return { forecasts: forecasts.length, created, updated, pharmacyNotices };
}

export function simulateSurge(
  medicineId: string,
  district: string,
  percent: number,
  actor = 'analyst'
): { affectedPharmacies: number; totalDispensed: number } {
  if (percent < 5 || percent > 95) {
    throw new Error('Surge percentage must be between 5% and 95%.');
  }

  const store = db();
  const verifiedPharmacies = store.pharmacies.filter(
    (p) => p.status === 'verified' && p.district === district
  );
  const pIds = new Set(verifiedPharmacies.map((p) => p.id));

  const items = store.inventory.filter(
    (i) => i.medicineId === medicineId && pIds.has(i.pharmacyId)
  );

  let totalDispensed = 0;
  let affectedPharmacies = 0;

  for (const item of items) {
    const avail = Math.max(0, item.quantity - item.reserved);
    const dispenseQty = Math.round(avail * (percent / 100));
    if (dispenseQty > 0) {
      item.quantity -= dispenseQty;
      item.updatedAt = nowIso();
      totalDispensed += dispenseQty;
      affectedPharmacies++;

      store.history.unshift({
        id: uid('h'),
        inventoryId: item.id,
        pharmacyId: item.pharmacyId,
        medicineId,
        change: -dispenseQty,
        qtyAfter: item.quantity,
        reason: 'dispensed',
        at: nowIso(),
        actor: `${actor} (surge simulator)`,
      });
    }
  }

  const med = findMedicine(medicineId);
  audit(
    actor,
    'simulate_demand_surge',
    `Simulated ${percent}% sudden demand surge for ${med ? medLabel(med) : medicineId} in ${district}. Dispensed ${totalDispensed} units across ${affectedPharmacies} pharmacies.`
  );

  save();
  return { affectedPharmacies, totalDispensed };
}
