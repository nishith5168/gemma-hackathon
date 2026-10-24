import { buildSeed } from '../src/lib/seed';
import { allForecasts, computeForecast } from '../src/lib/forecast';

async function main() {
  console.log('--- Checking Deterministic Seed & Shortage Engine ---');
  const seed = buildSeed();
  console.log(`Pharmacies: ${seed.pharmacies.length}, Medicines: ${seed.medicines.length}, Inventory lines: ${seed.inventory.length}, History tx: ${seed.history.length}`);

  const forecasts = allForecasts(seed);
  console.log(`Computed ${forecasts.length} district-medicine forecasts.`);

  // Print non-low results
  const nonLow = forecasts.filter((f) => f.risk !== 'low');
  console.log(`\nNon-low forecasts (${nonLow.length}):`);
  for (const f of nonLow) {
    console.log(`  [${f.risk.toUpperCase()}] ${f.medicineLabel} (${f.district}) — Days of supply: ${f.daysOfSupply ?? 'N/A'}, Depletion: ${f.depletionDay ? `Day ${f.depletionDay}` : 'None'}, Anomaly Z: ${f.anomalyZ}, Coverage: ${(f.coverage * 100).toFixed(0)}%`);
  }

  // Assertions
  console.log('\n--- Scenario Assertions ---');

  // Scenario A: m1 in Colombo, Gampaha, Kalutara (Western Province)
  for (const dist of ['Colombo', 'Gampaha', 'Kalutara']) {
    const fA = computeForecast(seed, 'm1', dist);
    if (!fA || (fA.risk !== 'critical' && fA.risk !== 'high')) {
      throw new Error(`Scenario A Failed for ${dist}: Expected 'high' or 'critical', got '${fA?.risk}'`);
    }
    console.log(`✓ Scenario A Passed (${dist} Salbutamol): ${fA.risk.toUpperCase()}`);
  }

  // Scenario B: m3 in Gampaha
  const fB = computeForecast(seed, 'm3', 'Gampaha');
  if (!fB || fB.risk !== 'moderate') {
    throw new Error(`Scenario B Failed: Expected 'moderate' for Gampaha Amoxicillin, got '${fB?.risk}'`);
  }
  console.log(`✓ Scenario B Passed (Gampaha Amoxicillin): MODERATE (incoming: ${fB.incoming})`);

  // Scenario C: All Jaffna forecasts = 'insufficient'
  const jaffnaForecasts = forecasts.filter((f) => f.district === 'Jaffna');
  if (jaffnaForecasts.length === 0) throw new Error('No Jaffna forecasts generated!');
  for (const f of jaffnaForecasts) {
    if (f.risk !== 'insufficient') {
      throw new Error(`Scenario C Failed: Expected 'insufficient' for Jaffna ${f.medicineLabel}, got '${f.risk}'`);
    }
  }
  console.log(`✓ Scenario C Passed: All ${jaffnaForecasts.length} Jaffna forecasts are INSUFFICIENT data.`);

  // Scenario D: m5 in Kandy = 'high' with demand anomaly
  const fD = computeForecast(seed, 'm5', 'Kandy');
  if (!fD || fD.risk !== 'high') {
    throw new Error(`Scenario D Failed: Expected 'high' for Kandy Losartan, got '${fD?.risk}'`);
  }
  if (!fD.anomaly) {
    throw new Error(`Scenario D Failed: Expected anomaly = true, got anomalyZ = ${fD.anomalyZ}`);
  }
  console.log(`✓ Scenario D Passed (Kandy Losartan): HIGH with surge anomaly (Z = ${fD.anomalyZ})`);

  console.log('\n>>> ALL SHORTAGE SCENARIO ASSERTIONS PASSED! <<<');
}

main().catch((err) => {
  console.error('\n❌ Seed Check Failed:', err.message);
  process.exit(1);
});
