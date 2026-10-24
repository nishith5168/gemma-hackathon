import { NextRequest } from 'next/server';
import { db, save, nowIso, notify, audit, medLabel } from '@/lib/db';
import { ok, bad, requireRole, who, parseBody } from '@/lib/api';


export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = requireRole(req, ['analyst', 'admin']);
  if (guard) return guard;

  const { id } = await ctx.params;
  const store = db();
  const alert = store.alerts.find((a) => a.id === id);

  if (!alert) {
    return bad('Shortage alert not found.', 404);
  }

  const data = await parseBody<{
    action: 'acknowledge' | 'dismiss' | 'escalate';
    notes?: string;
  }>(req);

  if (!data?.action || !['acknowledge', 'dismiss', 'escalate'].includes(data.action)) {
    return bad("Invalid action. Must be 'acknowledge', 'dismiss', or 'escalate'.");
  }

  // PRD §11 & §15.1 check 9: notes REQUIRED for dismiss/escalate
  if ((data.action === 'dismiss' || data.action === 'escalate') && (!data.notes || data.notes.trim().length === 0)) {
    return bad(`Justification notes are required when choosing to ${data.action} an alert.`);
  }

  const session = who(req);
  const med = store.medicines.find((m) => m.id === alert.medicineId);
  const medName = med ? medLabel(med) : alert.medicineId;

  if (data.action === 'acknowledge') {
    alert.status = 'acknowledged';
    alert.reviewedAt = nowIso();
    alert.reviewer = session.user;
    if (data.notes) alert.notes = data.notes.trim();

    audit(session.user, 'alert_acknowledged', `Acknowledged alert ${id} for ${medName} in ${alert.district}`);
  } else if (data.action === 'dismiss') {
    alert.status = 'dismissed';
    alert.reviewedAt = nowIso();
    alert.reviewer = session.user;
    alert.notes = data.notes!.trim();

    audit(session.user, 'alert_dismissed', `Dismissed alert ${id} for ${medName} in ${alert.district}. Reason: ${alert.notes}`);
  } else if (data.action === 'escalate') {
    alert.status = 'escalated';
    alert.reviewedAt = nowIso();
    alert.reviewer = session.user;
    alert.notes = data.notes!.trim();

    // PRD rule: Escalate = SIMULATED (notify admin with "[SIMULATED transmission]")
    notify(
      'admin',
      `[SIMULATED transmission] Urgent NMRA escalation: Critical shortage alert for ${medName} in ${alert.district} escalated by ${session.user}. Justification: ${alert.notes}`
    );
    audit(
      session.user,
      'alert_escalated_simulated',
      `[SIMULATED transmission] Escalated alert ${id} for ${medName} in ${alert.district}. Justification: ${alert.notes}`
    );
  }

  save();
  return ok(alert);
}
