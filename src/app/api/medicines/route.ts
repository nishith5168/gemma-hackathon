import { NextRequest } from 'next/server';
import { db, save, uid, nowIso, audit } from '@/lib/db';
import { ok, bad, requireRole, who, parseBody } from '@/lib/api';
import { Medicine } from '@/lib/types';


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').toLowerCase().trim();

  const store = db();
  let list = store.medicines;
  if (q) {
    list = list.filter(
      (m) =>
        m.generic.toLowerCase().includes(q) ||
        m.brand.toLowerCase().includes(q) ||
        `${m.generic} ${m.strength} ${m.form}`.toLowerCase().includes(q)
    );
  }

  return ok(list);
}

export async function POST(req: NextRequest) {
  const guard = requireRole(req, ['admin']);
  if (guard) return guard;

  const data = await parseBody<Partial<Medicine>>(req);
  if (!data?.generic || !data?.strength || !data?.form) {
    return bad('Missing required medicine fields: generic, strength, form.');
  }

  const store = db();
  const exists = store.medicines.find(
    (m) =>
      m.generic.toLowerCase() === data.generic!.toLowerCase() &&
      m.strength.toLowerCase() === data.strength!.toLowerCase() &&
      m.form.toLowerCase() === data.form!.toLowerCase()
  );
  if (exists) {
    return bad('This exact medicine variant already exists in catalogue.', 409);
  }

  const session = who(req);
  const newMed: Medicine = {
    id: uid('m'),
    generic: data.generic.trim(),
    brand: (data.brand || '').trim(),
    strength: data.strength.trim(),
    form: data.form.trim(),
  };

  store.medicines.push(newMed);
  audit(
    session.user,
    'medicine_added',
    `Added catalogue variant: ${newMed.generic} ${newMed.strength} ${newMed.form}`
  );
  save();

  return ok(newMed, 201);
}
