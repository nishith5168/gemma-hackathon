import { NextRequest } from 'next/server';
import { db, save, audit } from '@/lib/db';
import { ok, bad, requireRole, who, parseBody } from '@/lib/api';
import { Settings } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const guard = requireRole(req, ['analyst', 'admin']);
  if (guard) return guard;

  return ok(db().settings);
}

export async function PATCH(req: NextRequest) {
  const guard = requireRole(req, ['admin']);
  if (guard) return guard;

  const data = await parseBody<Partial<Settings>>(req);
  if (!data) return bad('Missing settings payload.');

  const store = db();
  const current = { ...store.settings, ...data };

  // Validate PRD rules (§11 & §15.2 check 17)
  if (
    current.criticalDays < 0 ||
    current.highDays < 0 ||
    current.moderateDays < 0 ||
    current.freshnessHours < 1 ||
    current.minPharmacies < 1
  ) {
    return bad('Settings values must be non-negative positive numbers.');
  }

  if (current.criticalDays >= current.highDays || current.highDays >= current.moderateDays) {
    return bad('Validation error: Alert thresholds must maintain criticalDays < highDays < moderateDays.');
  }

  if (current.minCoverage <= 0 || current.minCoverage > 1) {
    return bad('minCoverage must be between 0.01 and 1.00 (e.g. 0.50).');
  }

  if (current.horizonDays < current.moderateDays) {
    return bad('horizonDays must be greater than or equal to moderateDays.');
  }

  store.settings = current;
  const session = who(req);
  audit(session.user, 'settings_calibrated', `Updated alert and forecasting rules: critical=${current.criticalDays}d, high=${current.highDays}d, moderate=${current.moderateDays}d`);

  save();
  return ok(store.settings);
}
