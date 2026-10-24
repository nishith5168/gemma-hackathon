import { NextRequest } from 'next/server';
import { ok, requireRole, who } from '@/lib/api';
import { runAnalysis } from '@/lib/ops';


export async function POST(req: NextRequest) {
  const guard = requireRole(req, ['analyst', 'admin']);
  if (guard) return guard;

  const session = who(req);
  const result = runAnalysis(session.user);

  return ok({
    success: true,
    message: `Shortage analysis complete. Scanned ${result.forecasts} forecast series.`,
    ...result,
  });
}
