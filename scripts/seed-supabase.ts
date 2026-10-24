import { getSupabase, isSupabaseConfigured } from '../src/lib/supabase';
import { buildSeed } from '../src/lib/seed';

async function main() {
  if (!isSupabaseConfigured()) {
    console.log('[Supabase Seed] Supabase credentials not configured in .env. Skipping cloud sync.');
    console.log('[Supabase Seed] Application will use local deterministic store data/db.json seamlessly.');
    return;
  }

  const supabase = getSupabase()!;
  console.log('[Supabase Seed] Generating deterministic seed...');
  const seed = buildSeed();

  console.log('[Supabase Seed] Syncing 17 pharmacies...');
  const { error: pErr } = await supabase.from('pharmacies').upsert(
    seed.pharmacies.map((p) => ({
      id: p.id,
      name: p.name,
      district: p.district,
      province: p.province,
      town: p.town,
      address: p.address,
      phone: p.phone,
      hours: p.hours,
      lat: p.lat,
      lng: p.lng,
      licence_no: p.licenceNo,
      status: p.status,
    }))
  );
  if (pErr) console.error('Error inserting pharmacies:', pErr);

  console.log('[Supabase Seed] Syncing medicines catalogue...');
  const { error: mErr } = await supabase.from('medicines').upsert(
    seed.medicines.map((m) => ({
      id: m.id,
      generic: m.generic,
      brand: m.brand,
      strength: m.strength,
      form: m.form,
    }))
  );
  if (mErr) console.error('Error inserting medicines:', mErr);

  console.log('[Supabase Seed] Sync completed successfully.');
}

main().catch((err) => {
  console.error('[Supabase Seed] Failed:', err);
});
