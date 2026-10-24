'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  User,
  Building2,
  BarChart3,
  ShieldCheck,
  Bell,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { useSession, api } from '@/lib/client';
import { Pharmacy, Role } from '@/lib/types';

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, updateRole, updatePharmacy } = useSession();

  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [aiStatus, setAiStatus] = useState<{ live: boolean; model: string }>({
    live: false,
    model: 'gemma-4-26b-a4b-it',
  });
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Fetch pharmacies list for picker
    api<Pharmacy[]>('/api/pharmacies?all=1').then((res) => {
      if (res.data) setPharmacies(res.data);
    });

    // Fetch AI Status
    api<{ live: boolean; model: string }>('/api/ai/status').then((res) => {
      if (res.data) setAiStatus(res.data);
    });

    // Check notifications
    const pollNotifs = () => {
      const recipientId =
        session.role === 'pharmacist'
          ? session.pharmacyId || 'p1'
          : session.role === 'analyst'
          ? 'analyst'
          : session.role === 'admin'
          ? 'admin'
          : session.patientId;

      api<{ read: boolean }[]>(`/api/notifications?recipientId=${recipientId}`).then(
        (res) => {
          if (res.data) {
            const unread = res.data.filter((n) => !n.read).length;
            setUnreadCount(unread);
          }
        }
      );
    };

    pollNotifs();
    const interval = setInterval(pollNotifs, 10000);
    return () => clearInterval(interval);
  }, [session.role, session.pharmacyId, session.patientId]);

  const handleRoleChange = (newRole: Role) => {
    updateRole(newRole);
    if (newRole === 'patient') router.push('/patient');
    else if (newRole === 'pharmacist') router.push('/pharmacy');
    else if (newRole === 'analyst') router.push('/analyst');
    else if (newRole === 'admin') router.push('/admin');
  };

  const navLinks = [
    { href: '/', label: 'Overview', icon: Activity },
    { href: '/patient', label: 'Patient Portal', icon: User },
    { href: '/pharmacy', label: 'Pharmacy Desk', icon: Building2 },
    { href: '/analyst', label: 'Shortage Intelligence', icon: BarChart3 },
    { href: '/admin', label: 'Administration', icon: ShieldCheck },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-lg bg-[#005691] flex items-center justify-center text-white font-bold shadow-xs transition group-hover:bg-[#004373]">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                  MedSignal <span className="text-[#005691]">LK</span>
                </span>
                <span className="hidden sm:block text-[10px] text-slate-500 font-medium">
                  Connecting Patients • Pharmacies • Early-Warning
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition ${
                    isActive
                      ? 'bg-sky-50 text-[#005691]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Controls: AI status & Demo Role Switcher */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* AI Status Badge */}
            <div
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                aiStatus.live
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
              title={
                aiStatus.live
                  ? `Connected to Google AI Studio (${aiStatus.model})`
                  : 'Running in deterministic MOCK fallback mode'
              }
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  aiStatus.live ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <Sparkles className="w-3 h-3" />
              <span>{aiStatus.live ? 'Gemma 4 (live)' : 'AI: MOCK mode'}</span>
            </div>

            {/* Pharmacist Pharmacy Selector */}
            {session.role === 'pharmacist' && (
              <div className="relative">
                <select
                  value={session.pharmacyId || 'p1'}
                  onChange={(e) => updatePharmacy(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-md text-xs font-medium py-1.5 pl-2.5 pr-7 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#005691] max-w-[150px] sm:max-w-[200px] truncate"
                >
                  {pharmacies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.status === 'pending' ? '(pending)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Demo Role Selector */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              <span className="hidden xl:inline text-[11px] font-bold text-slate-500 uppercase px-1.5">
                Demo:
              </span>
              <select
                value={session.role}
                onChange={(e) => handleRoleChange(e.target.value as Role)}
                className="bg-white border-0 rounded text-xs font-semibold py-1 px-2 text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-[#005691] cursor-pointer"
              >
                <option value="patient">Patient</option>
                <option value="pharmacist">Pharmacist</option>
                <option value="analyst">Analyst</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
