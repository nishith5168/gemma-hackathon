'use client';

import React from 'react';
import Link from 'next/link';
import {
  Activity,
  User,
  Building2,
  BarChart3,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  TrendingDown,
  CheckCircle2,
  FileSearch,
  Code2,
} from 'lucide-react';
import { useSession } from '@/lib/client';

export default function LandingPage() {
  const { session, updateRole } = useSession();

  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Brief & Narrative */}
            <div className="lg:col-span-7 space-y-6">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Connecting Patients. <br />
                Empowering Pharmacies. <br />
                <span className="text-[#005691]">Anticipating Shortages.</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
                A unified medicine accessibility and predictive early-warning platform for Sri Lanka.
                Inventory updates reported by licensed community pharmacies automatically power patient availability
                and furnish health authorities with 21-day predictive depletion intelligence.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/patient"
                  className="btn-primary"
                  onClick={() => updateRole('patient')}
                >
                  <User className="w-4 h-4" />
                  Search Availability (Patient)
                </Link>
                <Link
                  href="/analyst"
                  className="btn-secondary"
                  onClick={() => updateRole('analyst')}
                >
                  <BarChart3 className="w-4 h-4" />
                  View Shortage Intelligence
                </Link>
              </div>

              <div className="pt-4 flex items-center gap-6 text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Exact-variant matching
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Zero unverified guessing
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Trilingual AI assistance
                </span>
              </div>
            </div>

            {/* Right Column: Key Network Metric Card */}
            <div className="lg:col-span-5">
              <div className="card-network p-6 sm:p-8 bg-sky-50/70 border border-sky-200 text-slate-800 rounded-xl shadow-xs space-y-6">
                <div className="flex items-center justify-between border-b border-sky-100 pb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#005691] flex items-center gap-1.5">
                    <Activity className="w-4 h-4" />
                    Network Feedback Loop
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Live Engine
                  </span>
                </div>

                <div className="space-y-4 text-xs leading-relaxed text-slate-600">
                  <div className="p-3.5 rounded-lg bg-white border border-sky-100 shadow-2xs">
                    <strong className="text-slate-900 block text-sm mb-1">
                      1. One Pharmacy Update
                    </strong>
                    When Lotus Care scans an invoice or logs dispensed stock, on-hand numbers update deterministically.
                  </div>
                  <div className="p-3.5 rounded-lg bg-white border border-sky-100 shadow-2xs">
                    <strong className="text-slate-900 block text-sm mb-1">
                      2. Patient Availability
                    </strong>
                    Nearby patients immediately see verified stock bands (In / Low / Out) and distance with honest timestamps.
                  </div>
                  <div className="p-3.5 rounded-lg bg-white border border-sky-100 shadow-2xs">
                    <strong className="text-slate-900 block text-sm mb-1">
                      3. National Early-Warning
                    </strong>
                    Holt’s smoothing projects depletion dates across districts. Gemma 4 explains risks in English, Sinhala, or Tamil.
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 pt-2 border-t border-sky-100">
                  Current Session: <strong className="text-slate-800 capitalize">{session.role}</strong> ({session.user})
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Portals Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dedicated Stakeholder Portals</h2>
          <p className="text-slate-600 text-sm mt-1">
            Choose a role to test the complete end-to-end workflow in prototype mode.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Patient */}
          <Link
            href="/patient"
            onClick={() => updateRole('patient')}
            className="card-network p-6 hover:border-[#005691] hover:shadow-md transition group flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#005691] flex items-center justify-center font-bold">
                <User className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#005691] transition flex items-center justify-between">
                <span>Patient Portal</span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#005691] group-hover:translate-x-1 transition" />
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Find licensed pharmacies reporting verified stock of your exact medicine variant.
                Scan paper prescriptions with multimodal Gemma AI to extract medicine names automatically.
              </p>
            </div>
            <div className="pt-6 border-t border-slate-100 flex items-center gap-4 text-xs font-semibold text-slate-500">
              <span>• Prescription Vision OCR</span>
              <span>• Stock Hold Requests</span>
              <span>• Trilingual (EN/SI/TA)</span>
            </div>
          </Link>

          {/* Card 2: Pharmacy */}
          <Link
            href="/pharmacy"
            onClick={() => updateRole('pharmacist')}
            className="card-network p-6 hover:border-[#005691] hover:shadow-md transition group flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-700 transition flex items-center justify-between">
                <span>Pharmacy Desk</span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-1 transition" />
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Effortless stock updates for community chemists. Rapid one-click adjustments, bulk CSV import
                with strict all-or-nothing validation, and supplier invoice scanning powered by Gemma vision.
              </p>
            </div>
            <div className="pt-6 border-t border-slate-100 flex items-center gap-4 text-xs font-semibold text-slate-500">
              <span>• Supplier Invoice Scan</span>
              <span>• Reservation Holds</span>
              <span>• CSV Validation</span>
            </div>
          </Link>

          {/* Card 3: Analyst */}
          <Link
            href="/analyst"
            onClick={() => updateRole('analyst')}
            className="card-network p-6 hover:border-[#005691] hover:shadow-md transition group flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-amber-700 transition flex items-center justify-between">
                <span>Government Analyst</span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-700 group-hover:translate-x-1 transition" />
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Deterministic shortage intelligence across 25 Sri Lankan districts. 21-day stock depletion forecasts,
                anomaly surge alerts, and Gemma 4 explanations via function calling with full mathematical transparency.
              </p>
            </div>
            <div className="pt-6 border-t border-slate-100 flex items-center gap-4 text-xs font-semibold text-slate-500">
              <span>• Holt Trend Smoothing</span>
              <span>• Tool-Calling Explanations</span>
              <span>• Surge Simulation</span>
            </div>
          </Link>

          {/* Card 4: Admin */}
          <Link
            href="/admin"
            onClick={() => updateRole('admin')}
            className="card-network p-6 hover:border-[#005691] hover:shadow-md transition group flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-purple-700 transition flex items-center justify-between">
                <span>Administration & Governance</span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-700 group-hover:translate-x-1 transition" />
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Inspect and verify NMRA pharmacy licences, maintain the official medicine catalogue,
                calibrate algorithmic alert thresholds, audit anomaly quality checks, and reset demo states.
              </p>
            </div>
            <div className="pt-6 border-t border-slate-100 flex items-center gap-4 text-xs font-semibold text-slate-500">
              <span>• NMRA Verification</span>
              <span>• Data Quality Monitor</span>
              <span>• Audit Trail</span>
            </div>
          </Link>
        </div>
      </section>

      {/* Engineering Team / Developer Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pt-6 border-t border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Developed by
          </h2>
          <p className="text-xs text-slate-500">
            Sri Lanka national medicine accessibility and predictive early-warning engineering team.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Nishith Siribaddana */}
          <div className="card-network p-5 hover:border-[#005691] transition flex items-start gap-4">
            <div className="w-11 h-11 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-[#005691] font-bold text-sm flex-shrink-0">
              NS
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-sm">Nishith Siribaddana</h3>
              <p className="text-[11px] font-mono text-[#005691] font-medium">Software Engineer</p>
              <p className="text-xs text-slate-500 leading-relaxed pt-1">
                Full-stack architecture, deterministic shortage forecasting engine, and Supabase integration.
              </p>
            </div>
          </div>

          {/* Ramiru Wanigathunga */}
          <div className="card-network p-5 hover:border-[#005691] transition flex items-start gap-4">
            <div className="w-11 h-11 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm flex-shrink-0">
              RW
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-sm">Ramiru Wanigathunga</h3>
              <p className="text-[11px] font-mono text-emerald-700 font-medium">AI & Frontend Engineer</p>
              <p className="text-xs text-slate-500 leading-relaxed pt-1">
                Gemma 4 multimodal integration, vision OCR pipelines, and interactive UI systems.
              </p>
            </div>
          </div>

          {/* Nishan Kumaratunga */}
          <div className="card-network p-5 hover:border-[#005691] transition flex items-start gap-4">
            <div className="w-11 h-11 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm flex-shrink-0">
              NK
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-sm">Nishan Kumaratunga</h3>
              <p className="text-[11px] font-mono text-amber-700 font-medium">Systems & Data Engineer</p>
              <p className="text-xs text-slate-500 leading-relaxed pt-1">
                Domain data modeling, deterministic 30-day simulations, and healthcare compliance design.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
