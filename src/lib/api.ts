import { NextResponse } from 'next/server';
import { Role, UserSession } from './types';

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function bad(error: string, status = 400, errors?: string[]) {
  return NextResponse.json({ error, errors }, { status });
}

export function who(req: Request): UserSession {
  const role = (req.headers.get('x-role') as Role) || 'patient';
  const pharmacyId = req.headers.get('x-pharmacy-id') || undefined;
  const user = req.headers.get('x-user') || 'Demo User';
  const patientId = req.headers.get('x-patient-id') || 'patient-1';

  return { role, pharmacyId, user, patientId };
}

export function requireRole(req: Request, allowed: Role[]): NextResponse | null {
  const session = who(req);
  if (!allowed.includes(session.role)) {
    return bad(
      `Access denied. Role '${session.role}' is not authorized. Required: ${allowed.join(', ')}.`,
      403
    );
  }
  return null;
}

export function requirePharmacy(req: Request, targetPharmacyId: string): NextResponse | null {
  const session = who(req);
  if (session.role === 'admin') {
    return null; // Admin can manage any pharmacy
  }
  if (session.role === 'pharmacist') {
    if (session.pharmacyId === targetPharmacyId) {
      return null;
    }
    return bad(
      `Access denied. You are managing pharmacy '${session.pharmacyId}', not '${targetPharmacyId}'.`,
      403
    );
  }
  return bad('Access denied. Pharmacist or Admin role required.', 403);
}

export async function parseBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
