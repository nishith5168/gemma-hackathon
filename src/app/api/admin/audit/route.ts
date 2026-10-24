import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, requireRole } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const guard = requireRole(req, ['admin']);
  if (guard) return guard;

  const logs = db().audit.slice(0, 300);
  return ok(logs);
}
