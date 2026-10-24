import {
  Pharmacy,
  Medicine,
  InventoryItem,
  HistoryRecord,
  Replenishment,
  StockRequest,
  Settings,
  DB,
} from './types';

// Deterministic Mulberry32 RNG
export function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const PROVINCE_MAP: Record<string, string> = {
  Colombo: 'Western',
  Gampaha: 'Western',
  Kalutara: 'Western',
  Kandy: 'Central',
  Galle: 'Southern',
  Matara: 'Southern',
  Jaffna: 'Northern',
  Kurunegala: 'North Western',
};

export const SEEDED_MEDICINES: (Medicine & { baseDemand: number })[] = [
  { id: 'm1', generic: 'Salbutamol', brand: 'Breathex', strength: '100 mcg/dose', form: 'Inhaler', baseDemand: 4 },
  { id: 'm2', generic: 'Metformin', brand: 'Glucofine', strength: '500 mg', form: 'Tablet', baseDemand: 25 },
  { id: 'm3', generic: 'Amoxicillin', brand: 'Amoxa', strength: '500 mg', form: 'Capsule', baseDemand: 12 },
  { id: 'm4', generic: 'Insulin (Human Soluble)', brand: 'Insulex', strength: '100 IU/ml', form: 'Injection (vial)', baseDemand: 3 },
  { id: 'm5', generic: 'Losartan', brand: 'Losarta', strength: '50 mg', form: 'Tablet', baseDemand: 10 },
  { id: 'm6', generic: 'Paracetamol', brand: 'Paralief', strength: '500 mg', form: 'Tablet', baseDemand: 40 },
  { id: 'm7', generic: 'Atorvastatin', brand: 'Atorva-L', strength: '20 mg', form: 'Tablet', baseDemand: 8 },
  { id: 'm8', generic: 'Amlodipine', brand: 'Amlopin', strength: '5 mg', form: 'Tablet', baseDemand: 12 },
  { id: 'm9', generic: 'Omeprazole', brand: 'Omezol', strength: '20 mg', form: 'Capsule', baseDemand: 10 },
  { id: 'm10', generic: 'Cetirizine', brand: 'Cetrix', strength: '10 mg', form: 'Tablet', baseDemand: 8 },
  { id: 'm11', generic: 'Metformin', brand: 'Glucofine', strength: '850 mg', form: 'Tablet', baseDemand: 8 },
  { id: 'm12', generic: 'Salbutamol', brand: 'Breathex', strength: '2 mg', form: 'Tablet', baseDemand: 5 },
  { id: 'm13', generic: 'Levothyroxine', brand: 'Thyrolin', strength: '50 mcg', form: 'Tablet', baseDemand: 6 },
];

export const RAW_PHARMACIES: Omit<Pharmacy, 'province'>[] = [
  { id: 'p1', name: 'Lotus Care Pharmacy', district: 'Colombo', town: 'Colombo 03', lat: 6.902, lng: 79.853, address: '42 Galle Road, Colombo 03', phone: '+94 11 2574112', hours: '24 hours', licenceNo: 'NMRA/PH/2021/042', status: 'verified' },
  { id: 'p2', name: 'Harbour Health Chemists', district: 'Colombo', town: 'Colombo 11', lat: 6.939, lng: 79.852, address: '88 Main Street, Colombo 11', phone: '+94 11 2321450', hours: '8:00 AM - 10:00 PM', licenceNo: 'NMRA/PH/2019/118', status: 'verified' },
  { id: 'p3', name: 'Wellawatte Family Pharmacy', district: 'Colombo', town: 'Wellawatte', lat: 6.874, lng: 79.861, address: '215 W.A. Silva Mawatha, Wellawatte', phone: '+94 11 2589301', hours: '8:00 AM - 11:00 PM', licenceNo: 'NMRA/PH/2020/203', status: 'verified' },
  { id: 'p4', name: 'Nugegoda MediPoint', district: 'Colombo', town: 'Nugegoda', lat: 6.872, lng: 79.889, address: '14 Stanley Thilakarathne Mawatha, Nugegoda', phone: '+94 11 2824900', hours: '24 hours', licenceNo: 'NMRA/PH/2022/311', status: 'verified' },
  { id: 'p5', name: 'Negombo Seaside Pharmacy', district: 'Gampaha', town: 'Negombo', lat: 7.209, lng: 79.838, address: '12 Beach Road, Negombo', phone: '+94 31 2223841', hours: '8:00 AM - 10:00 PM', licenceNo: 'NMRA/PH/2018/074', status: 'verified' },
  { id: 'p6', name: 'Gampaha Town Chemists', district: 'Gampaha', town: 'Gampaha', lat: 7.091, lng: 79.999, address: '55 Yakkala Road, Gampaha', phone: '+94 33 2221980', hours: '8:00 AM - 10:00 PM', licenceNo: 'NMRA/PH/2020/155', status: 'verified' },
  { id: 'p7', name: 'Kadawatha Health Hub', district: 'Gampaha', town: 'Kadawatha', lat: 7.001, lng: 79.953, address: '140 Kandy Road, Kadawatha', phone: '+94 11 2928371', hours: '24 hours', licenceNo: 'NMRA/PH/2023/019', status: 'verified' },
  { id: 'p8', name: 'Panadura Care Pharmacy', district: 'Kalutara', town: 'Panadura', lat: 6.713, lng: 79.907, address: '62 Galle Road, Panadura', phone: '+94 38 2234509', hours: '8:00 AM - 10:00 PM', licenceNo: 'NMRA/PH/2017/092', status: 'verified' },
  { id: 'p9', name: 'Kalutara Riverside Chemists', district: 'Kalutara', town: 'Kalutara', lat: 6.585, lng: 79.96, address: '18 Riverside Road, Kalutara South', phone: '+94 34 2222114', hours: '8:00 AM - 9:30 PM', licenceNo: 'NMRA/PH/2021/187', status: 'verified' },
  { id: 'p10', name: 'Hillcrest Pharmacy Kandy', district: 'Kandy', town: 'Kandy', lat: 7.293, lng: 80.635, address: '34 Dalada Veediya, Kandy', phone: '+94 81 2234091', hours: '24 hours', licenceNo: 'NMRA/PH/2019/045', status: 'verified' },
  { id: 'p11', name: 'Peradeniya MediCare', district: 'Kandy', town: 'Peradeniya', lat: 7.269, lng: 80.597, address: '95 Galaha Road, Peradeniya', phone: '+94 81 2388412', hours: '8:00 AM - 10:00 PM', licenceNo: 'NMRA/PH/2022/109', status: 'verified' },
  { id: 'p12', name: 'Fort Galle Pharmacy', district: 'Galle', town: 'Galle', lat: 6.03, lng: 80.217, address: '12 Church Street, Galle Fort', phone: '+94 91 2234890', hours: '8:00 AM - 10:00 PM', licenceNo: 'NMRA/PH/2018/164', status: 'verified' },
  { id: 'p13', name: 'Southern Star Chemists', district: 'Galle', town: 'Hikkaduwa', lat: 6.14, lng: 80.101, address: '104 Galle Road, Hikkaduwa', phone: '+94 91 2277123', hours: '24 hours', licenceNo: 'NMRA/PH/2021/240', status: 'verified' },
  { id: 'p14', name: 'Nallur Health Pharmacy', district: 'Jaffna', town: 'Jaffna', lat: 9.674, lng: 80.03, address: '48 Point Pedro Road, Nallur', phone: '+94 21 2223910', hours: '8:00 AM - 9:00 PM', licenceNo: 'NMRA/PH/2020/088', status: 'verified' },
  { id: 'p15', name: 'Jaffna Central Chemists', district: 'Jaffna', town: 'Jaffna', lat: 9.662, lng: 80.017, address: '210 Hospital Road, Jaffna', phone: '+94 21 2221145', hours: '8:00 AM - 10:00 PM', licenceNo: 'NMRA/PH/2022/178', status: 'verified' },
  { id: 'p16', name: 'Kurunegala Lakeview Pharmacy', district: 'Kurunegala', town: 'Kurunegala', lat: 7.486, lng: 80.364, address: '15 Colombo Road, Kurunegala', phone: '+94 37 2224890', hours: '24 hours', licenceNo: 'NMRA/PH/2019/210', status: 'verified' },
  { id: 'p17', name: 'Matara Beach Road Pharmacy', district: 'Matara', town: 'Matara', lat: 5.948, lng: 80.543, address: '77 Beach Road, Matara', phone: '+94 41 2221800', hours: '8:00 AM - 10:00 PM', licenceNo: 'NMRA/PH/2026/004', status: 'pending' },
  { id: 'p18', name: 'Union Chemists Slave Island', district: 'Colombo', town: 'Colombo 02', lat: 6.921, lng: 79.856, address: '460 Union Place, Colombo 02', phone: '+94 11 2691234', hours: '8:00 AM - 11:00 PM', licenceNo: 'NMRA/PH/2021/301', status: 'verified' },
  { id: 'p19', name: 'HealthFirst Pharmacy Dehiwala', district: 'Colombo', town: 'Dehiwala', lat: 6.852, lng: 79.867, address: '82 Galle Road, Dehiwala', phone: '+94 11 2714520', hours: '24 hours', licenceNo: 'NMRA/PH/2020/412', status: 'verified' },
  { id: 'p20', name: 'Lanka Medicare Borella', district: 'Colombo', town: 'Colombo 08', lat: 6.914, lng: 79.878, address: '22 Ward Place, Colombo 08', phone: '+94 11 2689012', hours: '24 hours', licenceNo: 'NMRA/PH/2022/190', status: 'verified' },
  { id: 'p21', name: 'Royal Care Chemists Rajagiriya', district: 'Colombo', town: 'Rajagiriya', lat: 6.909, lng: 79.894, address: '105 Kotte Road, Rajagiriya', phone: '+94 11 2867800', hours: '8:00 AM - 10:30 PM', licenceNo: 'NMRA/PH/2023/044', status: 'verified' },
  { id: 'p22', name: 'Mount Lavinia Community Pharmacy', district: 'Colombo', town: 'Mount Lavinia', lat: 6.836, lng: 79.866, address: '210 Galle Road, Mount Lavinia', phone: '+94 11 2738910', hours: '8:00 AM - 11:00 PM', licenceNo: 'NMRA/PH/2019/331', status: 'verified' },
  { id: 'p23', name: 'Moratuwa Health Hub', district: 'Colombo', town: 'Moratuwa', lat: 6.773, lng: 79.882, address: '34 New Galle Road, Moratuwa', phone: '+94 11 2645800', hours: '8:00 AM - 10:00 PM', licenceNo: 'NMRA/PH/2021/502', status: 'verified' },
  { id: 'p24', name: 'Maharagama MediCare', district: 'Colombo', town: 'Maharagama', lat: 6.848, lng: 79.927, address: '190 High Level Road, Maharagama', phone: '+94 11 2841209', hours: '24 hours', licenceNo: 'NMRA/PH/2022/612', status: 'verified' },
  { id: 'p25', name: 'Kelaniya MediPoint', district: 'Gampaha', town: 'Kelaniya', lat: 6.955, lng: 79.918, address: '78 Biyagama Road, Kelaniya', phone: '+94 11 2914300', hours: '8:00 AM - 10:00 PM', licenceNo: 'NMRA/PH/2020/220', status: 'verified' },
  { id: 'p26', name: 'Wattala City Chemists', district: 'Gampaha', town: 'Wattala', lat: 6.989, lng: 79.892, address: '154 Negombo Road, Wattala', phone: '+94 11 2931120', hours: '8:00 AM - 10:30 PM', licenceNo: 'NMRA/PH/2021/119', status: 'verified' },
  { id: 'p27', name: 'Kiribathgoda Care Pharmacy', district: 'Gampaha', town: 'Kiribathgoda', lat: 6.981, lng: 79.929, address: '42 Kandy Road, Kiribathgoda', phone: '+94 11 2910088', hours: '24 hours', licenceNo: 'NMRA/PH/2023/150', status: 'verified' },
  { id: 'p28', name: 'Horana Central Pharmacy', district: 'Kalutara', town: 'Horana', lat: 6.716, lng: 80.063, address: '25 Panadura Road, Horana', phone: '+94 34 2261230', hours: '8:00 AM - 9:30 PM', licenceNo: 'NMRA/PH/2020/310', status: 'verified' },
  { id: 'p29', name: 'Katugastota MediCare', district: 'Kandy', town: 'Katugastota', lat: 7.328, lng: 80.621, address: '88 Kurunegala Road, Katugastota', phone: '+94 81 2498110', hours: '8:00 AM - 10:00 PM', licenceNo: 'NMRA/PH/2022/401', status: 'verified' },
  { id: 'p30', name: 'Karapitiya Hospital Pharmacy', district: 'Galle', town: 'Karapitiya', lat: 6.067, lng: 80.228, address: '14 Labuduwa Road, Karapitiya', phone: '+94 91 2245900', hours: '24 hours', licenceNo: 'NMRA/PH/2019/521', status: 'verified' },
  { id: 'p31', name: 'Matara City Pharmacy', district: 'Matara', town: 'Matara', lat: 5.949, lng: 80.535, address: '12 Anagarika Dharmapala Mawatha, Matara', phone: '+94 41 2231200', hours: '8:00 AM - 10:00 PM', licenceNo: 'NMRA/PH/2021/610', status: 'verified' },
  { id: 'p32', name: 'Wayamba Health Hub', district: 'Kurunegala', town: 'Kurunegala', lat: 7.481, lng: 80.362, address: '94 Kandy Road, Kurunegala', phone: '+94 37 2230190', hours: '8:00 AM - 10:00 PM', licenceNo: 'NMRA/PH/2022/720', status: 'verified' },
];

export const DEFAULT_SETTINGS: Settings = {
  freshnessHours: 48,
  criticalDays: 5,
  highDays: 10,
  moderateDays: 21,
  minCoverage: 0.5,
  minPharmacies: 2,
  anomalyZ: 2,
  horizonDays: 21,
};

export function buildSeed(now = new Date()): DB {
  const rng = mulberry32(20261024);
  const nowMs = now.getTime();

  const pharmacies: Pharmacy[] = RAW_PHARMACIES.map((p) => ({
    ...p,
    province: PROVINCE_MAP[p.district] || 'Western',
  }));

  const medicines: Medicine[] = SEEDED_MEDICINES.map((m) => ({
    id: m.id,
    generic: m.generic,
    brand: m.brand,
    strength: m.strength,
    form: m.form,
  }));

  const inventory: InventoryItem[] = [];
  const history: HistoryRecord[] = [];
  const replenishments: Replenishment[] = [];

  const verifiedPharmacies = pharmacies.filter((p) => p.status === 'verified');

  let invCount = 0;
  let histCount = 0;
  let repCount = 0;

  for (const pharmacy of verifiedPharmacies) {
    const isJaffna = pharmacy.district === 'Jaffna';
    const isKurunegalaP16 = pharmacy.id === 'p16';
    const isWestern = pharmacy.province === 'Western';

    for (const med of SEEDED_MEDICINES) {
      // Skip logic: 12% probability except m1, m3, m4, m5 which are always stocked
      const alwaysStocked = ['m1', 'm3', 'm4', 'm5'].includes(med.id);
      if (!alwaysStocked && rng() < 0.12) {
        continue;
      }

      invCount++;
      const invId = `inv_${invCount}`;

      // Base demand calculation
      const baseDemand = med.baseDemand * (0.7 + rng() * 0.6);
      const target = Math.round(baseDemand * 21);
      let stock = Math.round(target * (0.7 + rng() * 0.3));

      // Day 30 to 1 simulation
      for (let d = 30; d >= 1; d--) {
        const dayDate = new Date(nowMs - d * 24 * 3600 * 1000);
        dayDate.setHours(12, 0, 0, 0);

        // Staleness checks: Jaffna stops reporting after day 7 (d <= 7 no tx); p16 stops after day 4
        if (isJaffna && d <= 7) continue;
        if (isKurunegalaP16 && d <= 4) continue;

        let factor = 1.0;

        // Scenario A: m1 in Western (Colombo, Gampaha, Kalutara)
        // Full delivery to target at d=13, no receipts for d <= 13, factor ramps 1.0 -> 1.8 over d=10..1
        if (med.id === 'm1' && isWestern) {
          if (d <= 10) {
            factor = 1.0 + ((11 - d) / 10) * 0.8; // ramps 1.08 -> 1.80
          }
        }

        // Scenario B: m3 in Gampaha
        // Full delivery at d=16, no receipts for d <= 16
        // Scenario D: m5 in Kandy
        // factor 2.6 for d <= 7, normal receipts continue
        if (med.id === 'm5' && pharmacy.district === 'Kandy') {
          if (d <= 7) {
            factor = 2.6;
          }
        }

        // Calculate dispensed
        const rawDispensed = Math.round(baseDemand * factor * (0.75 + rng() * 0.5));
        const dispensed = Math.min(stock, Math.max(1, rawDispensed));

        stock -= dispensed;
        histCount++;
        history.push({
          id: `h_${histCount}`,
          inventoryId: invId,
          pharmacyId: pharmacy.id,
          medicineId: med.id,
          change: -dispensed,
          qtyAfter: stock,
          reason: 'dispensed',
          at: dayDate.toISOString(),
          actor: 'system',
        });

        // Reorder logic
        let allowReorder = true;
        if (med.id === 'm1' && isWestern && d <= 13) {
          allowReorder = false; // Suppress receipts after d=13
        }
        if (med.id === 'm3' && pharmacy.district === 'Gampaha' && d <= 16) {
          allowReorder = false; // Suppress receipts after d=16
        }

        // Specific scenario injection: Day 13 delivery for Scenario A
        if (med.id === 'm1' && isWestern && d === 13) {
          const topUp = Math.max(10, target - stock);
          stock += topUp;
          histCount++;
          const recDate = new Date(dayDate.getTime() + 3 * 3600 * 1000);
          history.push({
            id: `h_${histCount}`,
            inventoryId: invId,
            pharmacyId: pharmacy.id,
            medicineId: med.id,
            change: topUp,
            qtyAfter: stock,
            reason: 'received',
            at: recDate.toISOString(),
            actor: 'system',
          });
        }
        // Specific scenario injection: Day 16 delivery for Scenario B
        else if (med.id === 'm3' && pharmacy.district === 'Gampaha' && d === 16) {
          const topUp = Math.max(20, target - stock);
          stock += topUp;
          histCount++;
          const recDate = new Date(dayDate.getTime() + 3 * 3600 * 1000);
          history.push({
            id: `h_${histCount}`,
            inventoryId: invId,
            pharmacyId: pharmacy.id,
            medicineId: med.id,
            change: topUp,
            qtyAfter: stock,
            reason: 'received',
            at: recDate.toISOString(),
            actor: 'system',
          });
        }
        // Normal reorder
        else if (allowReorder && stock < baseDemand * 7) {
          const topUp = Math.max(5, target - stock);
          stock += topUp;
          histCount++;
          const recDate = new Date(dayDate.getTime() + 3 * 3600 * 1000);
          history.push({
            id: `h_${histCount}`,
            inventoryId: invId,
            pharmacyId: pharmacy.id,
            medicineId: med.id,
            change: topUp,
            qtyAfter: stock,
            reason: 'received',
            at: recDate.toISOString(),
            actor: 'system',
          });
        }
      }

      // Staleness date
      let updatedHoursAgo = 1 + rng() * 19; // 1 to 20h
      if (isJaffna) {
        updatedHoursAgo = 6 * 24 + rng() * 12; // 6 days stale
      } else if (isKurunegalaP16) {
        updatedHoursAgo = 3 * 24 + rng() * 12; // 3 days stale
      }

      const updatedAt = new Date(nowMs - updatedHoursAgo * 3600 * 1000).toISOString();

      // Expiry dates: 8% within 20 days, else 6 to 18 months
      const isExpiringSoon = rng() < 0.08;
      const expiryDays = isExpiringSoon
        ? Math.round(5 + rng() * 15)
        : Math.round(180 + rng() * 360);
      const expiryDate = new Date(nowMs + expiryDays * 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);

      const batchNo = `B${Math.floor(100000 + rng() * 900000)}`;
      const lowThreshold = Math.max(5, Math.round(baseDemand * 4));

      // Initial reservations
      let reserved = 0;
      if (pharmacy.id === 'p1' && med.id === 'm1') {
        reserved = 1;
      }

      inventory.push({
        id: invId,
        pharmacyId: pharmacy.id,
        medicineId: med.id,
        quantity: Math.max(reserved, stock),
        reserved,
        batch: batchNo,
        expiry: expiryDate,
        lowThreshold,
        updatedAt,
      });

      // Scenario B: Expected replenishment in +3 days for m3 in Gampaha
      if (med.id === 'm3' && pharmacy.district === 'Gampaha') {
        repCount++;
        replenishments.push({
          id: `rep_${repCount}`,
          pharmacyId: pharmacy.id,
          medicineId: med.id,
          quantity: target,
          expectedDate: new Date(nowMs + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10),
          supplier: 'State Pharmaceuticals Manufacturing Corporation (SPMC)',
          status: 'expected',
          createdAt: new Date(nowMs - 2 * 24 * 3600 * 1000).toISOString(),
        });
      }

      // 50% chance of expected delivery for m6 in +3 days
      if (med.id === 'm6' && rng() < 0.5) {
        repCount++;
        replenishments.push({
          id: `rep_${repCount}`,
          pharmacyId: pharmacy.id,
          medicineId: med.id,
          quantity: Math.round(target / 2),
          expectedDate: new Date(nowMs + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10),
          supplier: 'Emerchemie NB (Pvt) Ltd',
          status: 'expected',
          createdAt: new Date(nowMs - 1 * 24 * 3600 * 1000).toISOString(),
        });
      }
    }
  }

  // Seed two initial requests at p1
  const requests: StockRequest[] = [
    {
      id: 'req_1',
      patientId: 'patient-1',
      patientName: 'Sunil Perera',
      medicineId: 'm2',
      pharmacyId: 'p1',
      quantity: 30,
      type: 'confirm',
      status: 'pending',
      note: 'Routine monthly refill prescription.',
      createdAt: new Date(nowMs - 45 * 60 * 1000).toISOString(),
      updatedAt: new Date(nowMs - 45 * 60 * 1000).toISOString(),
    },
    {
      id: 'req_2',
      patientId: 'patient-2',
      patientName: 'Fathima Razik',
      medicineId: 'm1',
      pharmacyId: 'p1',
      quantity: 1,
      type: 'reserve',
      status: 'pending',
      note: 'Urgent asthma prescription, collecting this evening.',
      createdAt: new Date(nowMs - 20 * 60 * 1000).toISOString(),
      updatedAt: new Date(nowMs - 20 * 60 * 1000).toISOString(),
    },
  ];

  return {
    seededAt: now.toISOString(),
    pharmacies,
    medicines,
    inventory,
    history,
    replenishments,
    requests,
    alerts: [],
    notifications: [
      {
        id: 'notif_1',
        recipientId: 'p1',
        message: 'New reservation request received from Fathima Razik for Salbutamol Inhaler.',
        createdAt: new Date(nowMs - 20 * 60 * 1000).toISOString(),
        read: false,
      },
    ],
    audit: [
      {
        id: 'aud_1',
        actor: 'system',
        action: 'system_initialized',
        detail: 'Deterministic synthetic seed generated with 32 pharmacies and 13 medicines.',
        at: now.toISOString(),
      },
    ],
    settings: DEFAULT_SETTINGS,
  };
}
