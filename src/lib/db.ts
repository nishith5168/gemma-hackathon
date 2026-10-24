import fs from 'fs';
import path from 'path';
import { DB, Medicine, Pharmacy, AuditLog, Notification } from './types';
import { buildSeed } from './seed';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

declare global {
  // eslint-disable-next-line no-var
  var __medsignalDb: DB | undefined;
}

function loadOrInitializeDb(): DB {
  if (globalThis.__medsignalDb) {
    return globalThis.__medsignalDb;
  }

  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as DB;
      globalThis.__medsignalDb = parsed;
      return parsed;
    }
  } catch (err) {
    console.warn('Could not read local data/db.json, generating fresh seed.', err);
  }

  const seeded = buildSeed();
  globalThis.__medsignalDb = seeded;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(seeded, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not persist to data/db.json (read-only FS/Vercel); holding in memory.', err);
  }
  return seeded;
}

export function db(): DB {
  return loadOrInitializeDb();
}

export function save(): void {
  const current = db();
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(current, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed saving data/db.json; memory store maintained.', err);
  }
}

export function resetDb(): DB {
  const fresh = buildSeed();
  globalThis.__medsignalDb = fresh;
  save();
  return fresh;
}

export function uid(prefix = 'id'): string {
  const rand = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function audit(actor: string, action: string, detail: string): AuditLog {
  const log: AuditLog = {
    id: uid('aud'),
    actor,
    action,
    detail,
    at: nowIso(),
  };
  const store = db();
  store.audit.unshift(log);
  if (store.audit.length > 500) {
    store.audit = store.audit.slice(0, 500);
  }
  save();
  return log;
}

export function notify(recipientId: string, message: string): Notification {
  const notif: Notification = {
    id: uid('notif'),
    recipientId,
    message,
    createdAt: nowIso(),
    read: false,
  };
  const store = db();
  store.notifications.unshift(notif);
  if (store.notifications.length > 200) {
    store.notifications = store.notifications.slice(0, 200);
  }
  save();
  return notif;
}

export function medLabel(m: Medicine): string {
  return `${m.generic} ${m.strength} ${m.form}`;
}

export function findMedicine(id: string): Medicine | undefined {
  return db().medicines.find((m) => m.id === id);
}

export function findPharmacy(id: string): Pharmacy | undefined {
  return db().pharmacies.find((p) => p.id === id);
}

export function isFresh(updatedAt: string, hours?: number): boolean {
  const maxHours = hours ?? db().settings.freshnessHours;
  const itemTime = new Date(updatedAt).getTime();
  const diffHours = (Date.now() - itemTime) / (1000 * 3600);
  return diffHours <= maxHours;
}
