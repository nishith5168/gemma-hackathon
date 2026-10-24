export type PharmacyStatus = 'pending' | 'verified' | 'rejected';

export interface Pharmacy {
  id: string;
  name: string;
  district: string;
  province: string;
  town: string;
  address: string;
  phone: string;
  hours: string;
  lat: number;
  lng: number;
  licenceNo: string;
  status: PharmacyStatus;
}

export interface Medicine {
  id: string;
  generic: string;
  brand: string;
  strength: string;
  form: string;
}

export interface InventoryItem {
  id: string;
  pharmacyId: string;
  medicineId: string;
  quantity: number;
  reserved: number;
  batch: string;
  expiry: string; // YYYY-MM-DD
  lowThreshold: number;
  updatedAt: string; // ISO
}

export type HistoryReason =
  | 'dispensed'
  | 'received'
  | 'adjustment'
  | 'import'
  | 'reservation_collected';

export interface HistoryRecord {
  id: string;
  inventoryId: string;
  pharmacyId: string;
  medicineId: string;
  change: number;
  qtyAfter: number;
  reason: HistoryReason;
  at: string;
  actor: string;
}

export interface Replenishment {
  id: string;
  pharmacyId: string;
  medicineId: string;
  quantity: number;
  expectedDate: string; // YYYY-MM-DD
  supplier: string;
  status: 'expected' | 'received' | 'cancelled';
  createdAt: string;
}

export type RequestStatus =
  | 'pending'
  | 'confirmed'
  | 'reserved'
  | 'rejected'
  | 'collected'
  | 'cancelled';

export interface StockRequest {
  id: string;
  patientId: string;
  patientName: string;
  medicineId: string;
  pharmacyId: string;
  quantity: number;
  type: 'confirm' | 'reserve';
  status: RequestStatus;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export type RiskLevel =
  | 'low'
  | 'moderate'
  | 'high'
  | 'critical'
  | 'insufficient';

export interface ForecastPoint {
  date: string;
  stock: number | null;
  projected: number | null;
}

export interface Forecast {
  medicineId: string;
  medicineLabel: string;
  district: string;
  province: string;
  pharmaciesTotal: number;
  pharmaciesFresh: number;
  coverage: number;
  available: number;
  avgDemand: number;
  demandTrend: number;
  incoming: number;
  daysOfSupply: number | null;
  depletionDay: number | null;
  anomalyZ: number;
  anomaly: boolean;
  lowStockShare: number;
  confidence: 'high' | 'medium' | 'low';
  risk: RiskLevel;
  evidence: string[];
  series: ForecastPoint[];
}

export type AlertStatus = 'open' | 'acknowledged' | 'dismissed' | 'escalated';

export interface ShortageAlert {
  id: string;
  medicineId: string;
  district: string;
  risk: RiskLevel;
  snapshot: Omit<Forecast, 'series'>;
  status: AlertStatus;
  notes: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewer: string | null;
  explanations: Record<string, string>;
}

export interface Notification {
  id: string;
  recipientId: string; // patientId | pharmacyId | 'analyst' | 'admin'
  message: string;
  createdAt: string;
  read: boolean;
}

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  detail: string;
  at: string;
}

export interface Settings {
  freshnessHours: number;
  criticalDays: number;
  highDays: number;
  moderateDays: number;
  minCoverage: number;
  minPharmacies: number;
  anomalyZ: number;
  horizonDays: number;
}

export interface DB {
  seededAt: string;
  pharmacies: Pharmacy[];
  medicines: Medicine[];
  inventory: InventoryItem[];
  history: HistoryRecord[];
  replenishments: Replenishment[];
  requests: StockRequest[];
  alerts: ShortageAlert[];
  notifications: Notification[];
  audit: AuditLog[];
  settings: Settings;
}

export type Role = 'patient' | 'pharmacist' | 'analyst' | 'admin';

export interface UserSession {
  role: Role;
  pharmacyId?: string;
  patientId: string;
  user: string;
}
