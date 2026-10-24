'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  BookOpen,
  Sliders,
  Activity,
  History,
  RotateCcw,
  Check,
  X,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import { useSession, api, ago } from '@/lib/client';
import { Pharmacy, Medicine, Settings, AuditLog } from '@/lib/types';
import { RiskBadge } from '../components/RiskBadge';

export default function AdminPage() {
  const { session, updateRole } = useSession();

  const [activeTab, setActiveTab] = useState<
    'pharmacies' | 'catalogue' | 'rules' | 'quality' | 'audit' | 'demo'
  >('pharmacies');

  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [catalogue, setCatalogue] = useState<Medicine[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [quality, setQuality] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Verification reason state
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});

  // Add Variant Form
  const [newGeneric, setNewGeneric] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newStrength, setNewStrength] = useState('');
  const [newForm, setNewForm] = useState('Tablet');

  const loadData = () => {
    if (activeTab === 'pharmacies') {
      api<Pharmacy[]>('/api/pharmacies?all=1').then((res) => {
        if (res.data) setPharmacies(res.data);
      });
    } else if (activeTab === 'catalogue') {
      api<Medicine[]>('/api/medicines').then((res) => {
        if (res.data) setCatalogue(res.data);
      });
    } else if (activeTab === 'rules') {
      api<Settings>('/api/admin/settings').then((res) => {
        if (res.data) setSettings(res.data);
      });
    } else if (activeTab === 'quality') {
      api<any>('/api/admin/data-quality').then((res) => {
        if (res.data) setQuality(res.data);
      });
    } else if (activeTab === 'audit') {
      api<AuditLog[]>('/api/admin/audit').then((res) => {
        if (res.data) setAuditLogs(res.data);
      });
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  // Pharmacy verification action
  const handleVerify = async (id: string, decision: 'verified' | 'rejected') => {
    const reason = rejectReasons[id] || '';
    const res = await api('/api/admin/pharmacies/verify', {
      method: 'POST',
      body: JSON.stringify({ id, decision, reason }),
    });

    if (res.data) {
      setActionMessage({ text: `Pharmacy ${decision.toUpperCase()} successfully.` });
      loadData();
    } else {
      setActionMessage({ text: res.error || 'Verification failed', error: true });
    }
  };

  // Add Catalogue Variant
  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGeneric || !newStrength || !newForm) return;

    const res = await api('/api/medicines', {
      method: 'POST',
      body: JSON.stringify({
        generic: newGeneric,
        brand: newBrand,
        strength: newStrength,
        form: newForm,
      }),
    });

    if (res.data) {
      setActionMessage({ text: `Added new catalogue variant: ${newGeneric} ${newStrength}` });
      setNewGeneric('');
      setNewBrand('');
      setNewStrength('');
      loadData();
    } else {
      setActionMessage({ text: res.error || 'Failed adding medicine', error: true });
    }
  };

  // Save Settings
  const handleSaveSettings = async () => {
    if (!settings) return;
    const res = await api('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });

    if (res.data) {
      setActionMessage({ text: 'Shortage forecasting rules calibrated successfully.' });
    } else {
      setActionMessage({ text: res.error || 'Calibration validation failed', error: true });
    }
  };

  // Demo Reset
  const handleResetDemo = async () => {
    if (!confirm('Reset entire system to initial deterministic 30-day seed state?')) return;
    const res = await api('/api/demo', {
      method: 'POST',
      body: JSON.stringify({ action: 'reset' }),
    });

    if (res.data) {
      alert('System successfully reset to default deterministic seed!');
      window.location.reload();
    } else {
      alert(res.error || 'Reset failed');
    }
  };

  // Role gate
  if (session.role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <ShieldCheck className="w-12 h-12 text-[#005691] mx-auto opacity-70" />
        <h2 className="text-xl font-bold text-slate-900">Administration Privileges Required</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          The Administration console handles NMRA pharmacy licensing, medicine catalogue governance,
          forecasting engine calibration, and audit logging. You are currently in <strong>{session.role}</strong> mode.
        </p>
        <button
          onClick={() => updateRole('admin')}
          className="btn-primary text-xs py-2 px-4 mx-auto"
        >
          Switch to Admin (Demo)
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            System Administration & Governance
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            NMRA licensing verification, catalogue curation, shortage engine calibration, and data quality assurance.
          </p>
        </div>

        <button
          onClick={handleResetDemo}
          className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold text-xs flex items-center gap-1.5 shadow-2xs"
          title="Reset all database records to the initial deterministic seed"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Demo Data</span>
        </button>
      </div>

      {actionMessage && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold ${
            actionMessage.error
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('pharmacies')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === 'pharmacies' ? 'bg-[#005691] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Pharmacies ({pharmacies.filter((p) => p.status === 'pending').length} pending)
        </button>
        <button
          onClick={() => setActiveTab('catalogue')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === 'catalogue' ? 'bg-[#005691] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Medicine Catalogue ({catalogue.length})
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === 'rules' ? 'bg-[#005691] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Alert Calibration Rules
        </button>
        <button
          onClick={() => setActiveTab('quality')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === 'quality' ? 'bg-[#005691] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          Data Quality Monitor
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === 'audit' ? 'bg-[#005691] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <History className="w-4 h-4" />
          Audit Logs
        </button>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* TAB 1: PHARMACIES */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'pharmacies' && (
        <div className="card-network overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-3 px-4">Pharmacy Name</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Licence No</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Verification Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pharmacies.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-semibold text-slate-900">{p.name}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {p.town}, {p.district} ({p.province})
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-800">{p.licenceNo}</td>
                    <td className="py-3 px-4 text-slate-600">{p.phone}</td>
                    <td className="py-3 px-4">
                      <RiskBadge type="status" value={p.status} />
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {p.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => handleVerify(p.id, 'verified')}
                            className="px-2.5 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs"
                          >
                            Verify
                          </button>
                          <button
                            onClick={() => handleVerify(p.id, 'rejected')}
                            className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400">Processed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* TAB 2: CATALOGUE */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'catalogue' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 card-network overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Generic Molecule</th>
                    <th className="py-3 px-4">Brand</th>
                    <th className="py-3 px-4">Strength</th>
                    <th className="py-3 px-4">Dosage Form</th>
                    <th className="py-3 px-4">ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {catalogue.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-slate-900">{m.generic}</td>
                      <td className="py-3 px-4 text-slate-600">{m.brand}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{m.strength}</td>
                      <td className="py-3 px-4 text-slate-700">{m.form}</td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-400">{m.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Variant Form */}
          <div className="lg:col-span-4 card-network p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Add New Catalogue Variant</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Exact variant specification ensures clinical safety and prevents dangerous substitution assumptions.
            </p>
            <form onSubmit={handleAddVariant} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Generic Active Ingredient</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Salbutamol"
                  value={newGeneric}
                  onChange={(e) => setNewGeneric(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-1.5"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Brand Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Ventolin"
                  value={newBrand}
                  onChange={(e) => setNewBrand(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Strength</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 100 mcg/dose"
                    value={newStrength}
                    onChange={(e) => setNewStrength(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Form</label>
                  <select
                    value={newForm}
                    onChange={(e) => setNewForm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5"
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Inhaler">Inhaler</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Injection (vial)">Injection (vial)</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="btn-primary w-full text-xs py-2 mt-2">
                <Plus className="w-3.5 h-3.5" />
                Add Medicine Variant
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* TAB 3: RULES CALIBRATION */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'rules' && settings && (
        <div className="card-network p-6 max-w-2xl space-y-6">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Shortage Forecast & Anomaly Calibration Rules
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Tune deterministic thresholds for risk classifications and data freshness filters.
              Rules enforce: <code>criticalDays &lt; highDays &lt; moderateDays</code>.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Critical Urgency Days</label>
              <input
                type="number"
                value={settings.criticalDays}
                onChange={(e) =>
                  setSettings({ ...settings, criticalDays: parseInt(e.target.value) || 5 })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded p-2 font-bold"
              />
              <span className="text-[10px] text-slate-400">Stock depletion within N days</span>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">High Risk Threshold Days</label>
              <input
                type="number"
                value={settings.highDays}
                onChange={(e) =>
                  setSettings({ ...settings, highDays: parseInt(e.target.value) || 10 })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded p-2 font-bold"
              />
              <span className="text-[10px] text-slate-400">Stock depletion within N days</span>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Moderate Risk Threshold Days</label>
              <input
                type="number"
                value={settings.moderateDays}
                onChange={(e) =>
                  setSettings({ ...settings, moderateDays: parseInt(e.target.value) || 21 })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded p-2 font-bold"
              />
              <span className="text-[10px] text-slate-400">Early replenishment warning window</span>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Freshness Expiry (Hours)</label>
              <input
                type="number"
                value={settings.freshnessHours}
                onChange={(e) =>
                  setSettings({ ...settings, freshnessHours: parseInt(e.target.value) || 48 })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded p-2 font-bold"
              />
              <span className="text-[10px] text-slate-400">Records older than N hours marked stale</span>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Minimum Fresh Coverage (0.01 - 1.00)</label>
              <input
                type="number"
                step="0.05"
                value={settings.minCoverage}
                onChange={(e) =>
                  setSettings({ ...settings, minCoverage: parseFloat(e.target.value) || 0.5 })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded p-2 font-bold"
              />
              <span className="text-[10px] text-slate-400">Below this fraction triggers 'insufficient data'</span>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Demand Surge Anomaly (Z-Score)</label>
              <input
                type="number"
                step="0.1"
                value={settings.anomalyZ}
                onChange={(e) =>
                  setSettings({ ...settings, anomalyZ: parseFloat(e.target.value) || 2.0 })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded p-2 font-bold"
              />
              <span className="text-[10px] text-slate-400">Standard deviations above baseline</span>
            </div>
          </div>

          <button onClick={handleSaveSettings} className="btn-primary text-xs py-2 px-5">
            Save and Calibrate Rules
          </button>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* TAB 4: DATA QUALITY */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'quality' && quality && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="card-network p-4">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Stale Records</span>
              <div className="text-xl font-black text-amber-700 mt-1">{quality.staleRecordsCount}</div>
            </div>
            <div className="card-network p-4">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Non-Reporting Pharmacies</span>
              <div className="text-xl font-black text-rose-700 mt-1">{quality.nonReportingPharmaciesCount}</div>
            </div>
            <div className="card-network p-4">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Large Adjustments (&ge;500)</span>
              <div className="text-xl font-black text-[#005691] mt-1">{quality.largeAdjustmentsCount}</div>
            </div>
            <div className="card-network p-4">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Expired Stock Listed</span>
              <div className="text-xl font-black text-rose-700 mt-1">{quality.expiredStockCount}</div>
            </div>
          </div>

          {quality.nonReportingPharmacies.length > 0 && (
            <div className="card-network p-5 space-y-3">
              <h4 className="font-bold text-xs text-rose-800">
                Non-Reporting Pharmacies (Zero updates within freshness window):
              </h4>
              <div className="divide-y divide-slate-100 text-xs">
                {quality.nonReportingPharmacies.map((p: any) => (
                  <div key={p.id} className="py-2 flex items-center justify-between">
                    <div>
                      <strong>{p.name}</strong> ({p.town}, {p.district})
                    </div>
                    <span className="text-rose-600 font-semibold text-[11px]">No active data</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* TAB 5: AUDIT LOGS */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'audit' && (
        <div className="card-network overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{log.actor}</td>
                    <td className="py-3 px-4 font-mono uppercase text-[10px] text-[#005691]">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 text-slate-600 leading-relaxed">{log.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
