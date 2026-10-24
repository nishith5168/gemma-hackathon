-- ====================================================================
-- MedSignal LK — Supabase PostgreSQL Schema
-- ====================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PHARMACIES
CREATE TABLE IF NOT EXISTS pharmacies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    district TEXT NOT NULL,
    province TEXT NOT NULL,
    town TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    hours TEXT NOT NULL,
    lat NUMERIC(9, 6) NOT NULL,
    lng NUMERIC(9, 6) NOT NULL,
    licence_no TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'verified', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. MEDICINES
CREATE TABLE IF NOT EXISTS medicines (
    id TEXT PRIMARY KEY,
    generic TEXT NOT NULL,
    brand TEXT NOT NULL,
    strength TEXT NOT NULL,
    form TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_medicine_variant UNIQUE (generic, strength, form)
);

-- 3. INVENTORY
CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    medicine_id TEXT NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= quantity),
    batch TEXT NOT NULL DEFAULT '',
    expiry TEXT NOT NULL DEFAULT '',
    low_threshold INTEGER NOT NULL DEFAULT 10,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pharmacy_medicine UNIQUE (pharmacy_id, medicine_id)
);

-- 4. HISTORY (Transactions)
CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY,
    inventory_id TEXT NOT NULL,
    pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    medicine_id TEXT NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
    change INTEGER NOT NULL,
    qty_after INTEGER NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('dispensed', 'received', 'adjustment', 'import', 'reservation_collected')),
    at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor TEXT NOT NULL DEFAULT 'system'
);

-- 5. REPLENISHMENTS
CREATE TABLE IF NOT EXISTS replenishments (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    medicine_id TEXT NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    expected_date DATE NOT NULL,
    supplier TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('expected', 'received', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. STOCK REQUESTS
CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    medicine_id TEXT NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
    pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    type TEXT NOT NULL CHECK (type IN ('confirm', 'reserve')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'reserved', 'rejected', 'collected', 'cancelled')),
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. SHORTAGE ALERTS
CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    medicine_id TEXT NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
    district TEXT NOT NULL,
    risk TEXT NOT NULL CHECK (risk IN ('low', 'moderate', 'high', 'critical', 'insufficient')),
    snapshot JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('open', 'acknowledged', 'dismissed', 'escalated')),
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewer TEXT,
    explanations JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 8. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    recipient_id TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read BOOLEAN NOT NULL DEFAULT FALSE
);

-- 9. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    freshness_hours INTEGER NOT NULL DEFAULT 48,
    critical_days INTEGER NOT NULL DEFAULT 5,
    high_days INTEGER NOT NULL DEFAULT 10,
    moderate_days INTEGER NOT NULL DEFAULT 21,
    min_coverage NUMERIC(3, 2) NOT NULL DEFAULT 0.50,
    min_pharmacies INTEGER NOT NULL DEFAULT 2,
    anomaly_z NUMERIC(4, 2) NOT NULL DEFAULT 2.00,
    horizon_days INTEGER NOT NULL DEFAULT 21,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_inventory_pharmacy ON inventory(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_inventory_medicine ON inventory(medicine_id);
CREATE INDEX IF NOT EXISTS idx_history_pharmacy ON history(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_requests_patient ON requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_requests_pharmacy ON requests(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
