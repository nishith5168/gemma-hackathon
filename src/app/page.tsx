'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { User, Building2, BarChart3, ShieldCheck } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line } from 'recharts';
import { useSession, api } from '@/lib/client';
import { Forecast, Pharmacy, Medicine } from '@/lib/types';
import { RiskBadge } from './components/RiskBadge';

export default function LandingPage() {
  const { session, updateRole } = useSession();

  const [topForecasts, setTopForecasts] = useState<Forecast[]>([]);
  const [sparklineData, setSparklineData] = useState<{ val: number }[]>([]);
  const [counts, setCounts] = useState({ pharmacies: 16, districts: 7, medicines: 13 });

  useEffect(() => {
    // Fetch live forecasts for the "Right now" preview card
    api<Forecast[]>('/api/analytics/forecasts').then((res) => {
      if (res.data && res.data.length > 0) {
        setTopForecasts(res.data.slice(0, 3));
        const first = res.data[0];
        // Fetch single forecast with series for the top row sparkline
        api<Forecast>(
          `/api/analytics/forecasts?single=1&medicineId=${first.medicineId}&district=${first.district}`
        ).then((singleRes) => {
          if (singleRes.data?.series) {
            const last14 = singleRes.data.series.slice(16, 30).map((pt) => ({
              val: pt.stock ?? 0,
            }));
            setSparklineData(last14);
          }
        });
      }
    });

    // Fetch real data counts
    Promise.all([
      api<Pharmacy[]>('/api/pharmacies'),
      api<Medicine[]>('/api/medicines'),
    ]).then(([pRes, mRes]) => {
      const pList = pRes.data || [];
      const mList = mRes.data || [];
      const districts = new Set(pList.map((p) => p.district));
      setCounts({
        pharmacies: pList.length || 16,
        districts: districts.size || 7,
        medicines: mList.length || 13,
      });
    });
  }, []);

  // Format clean session text: "Signed in as: Patient · Sunil Perera (demo)"
  const cleanRole = session.role.charAt(0).toUpperCase() + session.role.slice(1);
  const cleanUser = session.user.replace(/\s*\([^)]*\)/g, '').trim() || 'Demo User';

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Section */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Left Column: Eyebrow, Headline, Paragraph, Buttons, Real Factual Line */}
            <div className="lg:col-span-7 space-y-5">
              <div>
                <span className="text-xs text-slate-500 font-medium tracking-normal mb-2.5 block">
                  Connecting patients · Empowering pharmacies · Anticipating shortages
                </span>
                <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-slate-900 tracking-tight leading-tight max-w-xl">
                  Know which pharmacy has your medicine — and which medicines are running out.
                </h1>
              </div>

              <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
                Pharmacies update stock in seconds — by hand, CSV, or a photo of the supplier invoice.
                Patients see who has it nearby; health officials get an early warning when a district is about to run out.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href="/patient"
                  className="btn-primary text-sm h-11 px-5"
                  onClick={() => updateRole('patient')}
                >
                  <User className="w-4 h-4" />
                  <span>Find a medicine</span>
                </Link>
                <Link
                  href="/analyst"
                  className="btn-secondary text-sm h-11 px-5"
                  onClick={() => updateRole('analyst')}
                >
                  See shortage alerts
                </Link>
              </div>

              {/* Factual Line from Real Data */}
              <div className="pt-2 text-xs text-slate-500 font-normal">
                {counts.pharmacies} pharmacies · {counts.districts} districts · {counts.medicines} medicines monitored · synthetic demo data
              </div>
            </div>

            {/* Right Column: "Right now" Live Forecast Preview Card */}
            <div className="lg:col-span-5">
              <div className="card-network p-5 bg-white border border-slate-200 rounded-lg space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h2 className="text-sm font-bold text-slate-900">Right now</h2>
                  <span className="text-[11px] text-slate-400">21-day shortage projections</span>
                </div>

                {/* Top 3 Forecast Rows */}
                <div className="divide-y divide-slate-100">
                  {topForecasts.length > 0 ? (
                    topForecasts.map((f, idx) => (
                      <div key={idx} className="py-2.5 first:pt-0 last:pb-0 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="truncate max-w-[190px] sm:max-w-[210px]">
                            <strong className="text-slate-900 block font-semibold truncate">
                              {f.medicineLabel}
                            </strong>
                            <span className="text-slate-500 text-[11px]">{f.district} District</span>
                          </div>
                          <div className="text-right flex-shrink-0 flex items-center gap-2">
                            <RiskBadge type="risk" value={f.risk} showIcon={false} className="text-[10px] py-0.5 px-2" />
                            <span className="text-xs font-semibold text-slate-700">
                              {f.risk === 'insufficient'
                                ? 'insufficient data'
                                : f.depletionDay
                                ? `~${f.depletionDay} days left`
                                : f.daysOfSupply
                                ? `~${f.daysOfSupply} days left`
                                : 'stock stable'}
                            </span>
                          </div>
                        </div>

                        {/* Sparkline for First Row */}
                        {idx === 0 && sparklineData.length > 0 && (
                          <div className="h-8 w-full pt-1">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={sparklineData}>
                                <Line
                                  type="monotone"
                                  dataKey="val"
                                  stroke="#005691"
                                  strokeWidth={1.5}
                                  dot={false}
                                  isAnimationActive={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="py-4 text-center text-xs text-slate-400">
                      Loading shortage projections...
                    </div>
                  )}
                </div>

                {/* Card Disclaimer & Clean Session Line */}
                <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                  <p>Potential risks among participating pharmacies — not confirmed shortages.</p>
                  <p className="font-medium text-slate-700">
                    Signed in as: {cleanRole} · {cleanUser} (demo)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Portal Section: "One stock update, four views" */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">One stock update, four views</h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Switch roles with the Demo selector to try each one.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1: Patient */}
          <Link
            href="/patient"
            onClick={() => updateRole('patient')}
            className="card-network p-5 hover:border-[#005691] transition block rounded-lg border border-slate-200"
          >
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <User className="w-5 h-5 text-[#005691] flex-shrink-0" />
              <span>Patient Portal</span>
            </h3>
            <p className="text-slate-600 text-xs leading-relaxed mt-2">
              Patients — search exact strength and form, then ask a pharmacy to hold it.
            </p>
          </Link>

          {/* Card 2: Pharmacy */}
          <Link
            href="/pharmacy"
            onClick={() => updateRole('pharmacist')}
            className="card-network p-5 hover:border-[#005691] transition block rounded-lg border border-slate-200"
          >
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-700 flex-shrink-0" />
              <span>Pharmacy Desk</span>
            </h3>
            <p className="text-slate-600 text-xs leading-relaxed mt-2">
              Pharmacists — scan a supplier invoice and stock updates itself.
            </p>
          </Link>

          {/* Card 3: Analyst */}
          <Link
            href="/analyst"
            onClick={() => updateRole('analyst')}
            className="card-network p-5 hover:border-[#005691] transition block rounded-lg border border-slate-200"
          >
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-700 flex-shrink-0" />
              <span>Government Analyst</span>
            </h3>
            <p className="text-slate-600 text-xs leading-relaxed mt-2">
              Health analysts — see 21-day district depletion forecasts and AI summaries.
            </p>
          </Link>

          {/* Card 4: Admin */}
          <Link
            href="/admin"
            onClick={() => updateRole('admin')}
            className="card-network p-5 hover:border-[#005691] transition block rounded-lg border border-slate-200"
          >
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-700 flex-shrink-0" />
              <span>Administration</span>
            </h3>
            <p className="text-slate-600 text-xs leading-relaxed mt-2">
              Administrators — verify pharmacy licences, edit catalogue variants and tune alert rules.
            </p>
          </Link>
        </div>
      </section>

      {/* Engineering Team */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 pt-6 border-t border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-900">Developed by</h2>
          <p className="text-xs text-slate-500">Colombo Hack Day engineering team.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-network p-4 rounded-lg border border-slate-200 hover:border-[#005691] transition flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-sky-50 text-[#005691] font-bold text-xs flex items-center justify-center flex-shrink-0">
              NS
            </div>
            <div>
              <strong className="text-xs font-semibold text-slate-900 block">Nishith Siribaddana</strong>
              <span className="text-[11px] text-slate-500 font-mono">Software Engineer</span>
            </div>
          </div>

          <div className="card-network p-4 rounded-lg border border-slate-200 hover:border-[#005691] transition flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-emerald-50 text-emerald-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
              RW
            </div>
            <div>
              <strong className="text-xs font-semibold text-slate-900 block">Ramiru Wanigathunga</strong>
              <span className="text-[11px] text-slate-500 font-mono">AI & Frontend Engineer</span>
            </div>
          </div>

          <div className="card-network p-4 rounded-lg border border-slate-200 hover:border-[#005691] transition flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-amber-50 text-amber-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
              NK
            </div>
            <div>
              <strong className="text-xs font-semibold text-slate-900 block">Nishan Kumaratunga</strong>
              <span className="text-[11px] text-slate-500 font-mono">Systems & Data Engineer</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
