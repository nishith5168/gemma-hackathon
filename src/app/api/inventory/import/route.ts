import { NextRequest } from 'next/server';
import { db, save, uid, nowIso, audit, medLabel } from '@/lib/db';
import { ok, bad, requirePharmacy, who, parseBody } from '@/lib/api';
import { getOrCreateItem } from '@/lib/ops';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const data = await parseBody<{ pharmacyId: string; csv: string }>(req);
  if (!data?.pharmacyId || !data?.csv) {
    return bad('Missing required pharmacyId or csv data.');
  }

  const guard = requirePharmacy(req, data.pharmacyId);
  if (guard) return guard;

  const store = db();
  const session = who(req);

  const lines = data.csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length <= 1) {
    return bad('CSV file is empty or contains only header row.');
  }

  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));

  const errors: string[] = [];
  const parsedRows: {
    medicineId: string;
    quantity: number;
    batch: string;
    expiry: string;
    lineNum: number;
  }[] = [];

  const seenMeds = new Set<string>();

  for (let idx = 1; idx < lines.length; idx++) {
    const lineNum = idx + 1;
    const cols = lines[idx].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));

    const rowObj: Record<string, string> = {};
    headers.forEach((h, i) => {
      rowObj[h] = cols[i] || '';
    });

    let targetMed = null;

    if (rowObj['medicine_id']) {
      targetMed = store.medicines.find((m) => m.id === rowObj['medicine_id']);
      if (!targetMed) {
        errors.push(`Row ${lineNum}: medicine_id '${rowObj['medicine_id']}' does not exist in catalogue.`);
      }
    } else if (rowObj['generic'] && rowObj['strength'] && rowObj['form']) {
      targetMed = store.medicines.find(
        (m) =>
          m.generic.toLowerCase() === rowObj['generic'].toLowerCase() &&
          m.strength.toLowerCase() === rowObj['strength'].toLowerCase() &&
          m.form.toLowerCase() === rowObj['form'].toLowerCase()
      );
      if (!targetMed) {
        errors.push(
          `Row ${lineNum}: Medicine variant '${rowObj['generic']} ${rowObj['strength']} ${rowObj['form']}' not found in catalogue.`
        );
      }
    } else {
      errors.push(`Row ${lineNum}: Missing required catalogue identification (either medicine_id or generic, strength, form).`);
    }

    const qtyStr = rowObj['quantity'];
    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty < 0) {
      errors.push(`Row ${lineNum}: Quantity '${qtyStr}' must be an integer >= 0.`);
    }

    if (targetMed) {
      if (seenMeds.has(targetMed.id)) {
        errors.push(`Row ${lineNum}: Duplicate medicine in import file (${medLabel(targetMed)}).`);
      }
      seenMeds.add(targetMed.id);

      // Check reservation invariant
      const existingItem = store.inventory.find(
        (i) => i.pharmacyId === data.pharmacyId && i.medicineId === targetMed!.id
      );
      if (existingItem && qty < existingItem.reserved) {
        errors.push(
          `Row ${lineNum}: Quantity ${qty} cannot be lower than active reserved units (${existingItem.reserved}) for ${medLabel(targetMed)}.`
        );
      }

      parsedRows.push({
        medicineId: targetMed.id,
        quantity: qty,
        batch: rowObj['batch'] || '',
        expiry: rowObj['expiry'] || '',
        lineNum,
      });
    }
  }

  // All-or-nothing validation
  if (errors.length > 0) {
    return bad('Validation failed for CSV import. No changes were applied.', 422, errors);
  }

  // Apply imports
  for (const row of parsedRows) {
    const item = getOrCreateItem(data.pharmacyId, row.medicineId);
    const diff = row.quantity - item.quantity;
    item.quantity = row.quantity;
    if (row.batch) item.batch = row.batch;
    if (row.expiry) item.expiry = row.expiry;
    item.updatedAt = nowIso();

    store.history.unshift({
      id: uid('h'),
      inventoryId: item.id,
      pharmacyId: data.pharmacyId,
      medicineId: row.medicineId,
      change: diff,
      qtyAfter: row.quantity,
      reason: 'import',
      at: nowIso(),
      actor: `${session.user} (CSV Import)`,
    });
  }

  audit(
    session.user,
    'csv_import',
    `Successfully imported ${parsedRows.length} inventory lines via CSV into pharmacy ${data.pharmacyId}`
  );

  save();
  return ok({ importedCount: parsedRows.length, pharmacyId: data.pharmacyId });
}
