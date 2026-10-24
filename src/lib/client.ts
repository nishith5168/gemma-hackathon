'use client';

import { useState, useEffect } from 'react';
import { Role, UserSession } from './types';

const SESSION_KEY = 'medsignal-session';

export const DEFAULT_SESSION: UserSession = {
  role: 'patient',
  pharmacyId: 'p1',
  patientId: 'patient-1',
  user: 'Sunil Perera',
};

export function getStoredSession(): UserSession {
  if (typeof window === 'undefined') return DEFAULT_SESSION;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed reading session from localStorage', err);
  }
  return DEFAULT_SESSION;
}

export function setStoredSession(session: UserSession): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    window.dispatchEvent(new Event('medsignal-session-changed'));
  } catch (err) {
    console.warn('Failed writing session to localStorage', err);
  }
}

export function useSession() {
  const [session, setSession] = useState<UserSession>(DEFAULT_SESSION);

  useEffect(() => {
    setSession(getStoredSession());

    const onStorage = () => setSession(getStoredSession());
    window.addEventListener('storage', onStorage);
    window.addEventListener('medsignal-session-changed', onStorage);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('medsignal-session-changed', onStorage);
    };
  }, []);

  const updateRole = (role: Role) => {
    let user = 'Sunil Perera';
    if (role === 'patient') user = 'Sunil Perera';
    else if (role === 'pharmacist') user = 'Lotus Care Pharmacist';
    else if (role === 'analyst') user = 'Dr. K. Jayasuriya';
    else if (role === 'admin') user = 'Admin';

    const next: UserSession = {
      ...session,
      role,
      user,
      pharmacyId: role === 'pharmacist' ? session.pharmacyId || 'p1' : session.pharmacyId,
    };
    setSession(next);
    setStoredSession(next);
  };

  const updatePharmacy = (pharmacyId: string) => {
    const next: UserSession = { ...session, pharmacyId };
    setSession(next);
    setStoredSession(next);
  };

  return { session, updateRole, updatePharmacy };
}

export async function api<T>(
  path: string,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null; errors?: string[] }> {
  const session = getStoredSession();

  const headers = new Headers(options?.headers || {});
  headers.set('x-role', session.role);
  headers.set('x-user', session.user);
  headers.set('x-patient-id', session.patientId);
  if (session.pharmacyId) {
    headers.set('x-pharmacy-id', session.pharmacyId);
  }
  if (!headers.has('Content-Type') && !(options?.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const res = await fetch(path, {
      ...options,
      headers,
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/csv')) {
      const text = await res.text();
      return { data: text as unknown as T, error: null };
    }

    const json = await res.json();
    if (!res.ok) {
      return {
        data: null,
        error: json.error || `HTTP ${res.status}: Request failed`,
        errors: json.errors,
      };
    }
    return { data: json as T, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Network error occurred.',
    };
  }
}

export function fileToDataUrl(
  file: File,
  maxDimension = 1600,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed reading file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed loading image'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function ago(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffDays = Math.floor(diffH / 24);
  return `${diffDays}d ago`;
}
