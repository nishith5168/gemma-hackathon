'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  Download,
  Filter,
  Layers,
  Sparkles,
  Zap,
  CheckCircle,
  Clock,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useSession, api, ago } from '@/lib/client';
import { Forecast, ShortageAlert, RiskLevel } from '@/lib/types';
import { RiskBadge } from '../components/RiskBadge';
import { ExplainBox } from '../components/ExplainBox';

export default function AnalystPage() {
  const { session, updateRole } = useSession();

  const [kpis, setKpis] = useState<any>(null);
  const [districtSummaries, setDistrictSummaries] = useState<any[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [alerts, setAlerts] = useState<ShortageAlert[]>([]);
  const [selectedForecast, setSelectedForecast] = useState<Forecast | null>(null);

  // Filters
  const [filterProvince, setFilterProvince] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [hideLowRisk, setHideLowRisk] = useState(true);
  const [alertStatusFilter, setAlertStatusFilter] = useState('open');

  // Operations state
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Alert Decision Notes
  const [alertNotes, setAlertNotes] = useState<Record<string, string>>({});

  // Demand Surge Simulator state
  const [surgeMedId, setSurgeMedId] = useState('m1');
  const [surgeDistrict, setSurgeDistrict] = useState('Colombo');
  const [surgePercent, setSurgePercent] = useState(70);
  const [simulatingSurge, setSimulatingSurge] = useState(false);

  // Warm-up effect on mount
  useEffect(() => {
    api('/api/ai/status');
  }, []);

  const loadData = () => {
    // 1. Overview KPIs
    api<any>('/api/analytics/overview').then((res) => {
      if (res.data) {
        setKpis(res.data.kpis);
        setDistrictSummaries(res.data.districtSummaries || []);
      }
    });

    // 2. Forecasts
    api<Forecast[]>('/api/analytics/forecasts').then((res) => {
      if (res.data) {
        setForecasts(res.data);
        if (!selectedForecast && res.data.length > 0) {
          // Default to Western Salbutamol for 90s demo flow
          const defaultF =
            res.data.find((f) => f.medicineId === 'm1' && f.district === 'Colombo') ||
            res.data[0];
          fetchSingleForecast(defaultF.medicineId, defaultF.district);
        }
      }
    });

    // 3. Alerts
    api<ShortageAlert[]>(`/api/analytics/alerts?status=${alertStatusFilter}`).then((res) => {
      if (res.data) setAlerts(res.data);
    });
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [alertStatusFilter]);

  const fetchSingleForecast = async (medicineId: string, district: string) => {
    const res = await api<Forecast>(
      `/api/analytics/forecasts?single=1&medicineId=${medicineId}&district=${district}`
    );
    if (res.data) {
      setSelectedForecast(res.data);
    }
  };

  // Run Shortage Analysis
  const handleRunAnalysis = async () => {
    setRunningAnalysis(true);
    setActionMessage(null);

    const res = await api<any>('/api/analytics/run', { method: 'POST' });
    setRunningAnalysis(false);

    if (res.data) {
      setActionMessage({
        text: `Analysis Complete: Created ${res.data.created} alerts, updated ${res.data.updated}, issued ${res.data.pharmacyNotices} pharmacy notices.`,
      });
      loadData();
    } else {
      setActionMessage({ text: res.error || 'Failed to run analysis', error: true });
    }
  };

  // Alert Actions (Acknowledge, Escalate, Dismiss)
  const handleAlertAction = async (
    alertId: string,
    action: 'acknowledge' | 'dismiss' | 'escalate'
  ) => {
    const note = alertNotes[alertId] || '';
    if ((action === 'dismiss' || action === 'escalate') && !note.trim()) {
      alert(`A justification note is required to ${action} this alert.`);
      return;
    }

    const res = await api(`/api/alerts/${alertId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action, notes: note }),
    });

    if (res.data) {
      setActionMessage({ text: `Alert ${alertId} updated: ${action.toUpperCase()}` });
      loadData();
    } else {
      alert(res.error || 'Action failed');
    }
  };

  // Demand Surge Simulation
  const handleSimulateSurge = async () => {
    setSimulatingSurge(true);
    setActionMessage(null);

    const res = await api<any>('/api/demo', {
      method: 'POST',
      body: JSON.stringify({
        action: 'surge',
        medicineId: surgeMedId,
        district: surgeDistrict,
        percent: surgePercent,
      }),
    });

    setSimulatingSurge(false);
    if (res.data) {
      setActionMessage({
        text: `Surge Simulated: ${surgePercent}% of stock depleted in ${surgeDistrict}. Running new shortage analysis...`,
      });
      await handleRunAnalysis();
      fetchSingleForecast(surgeMedId, surgeDistrict);
    } else {
      setActionMessage({ text: res.error || 'Surge simulation failed', error: true });
    }
  };

  // Role gate
  if (session.role !== 'analyst' && session.role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <BarChart3 className="w-12 h-12 text-[#005691] mx-auto opacity-70" />
        <h2 className="text-xl font-bold text-slate-900">Government Analyst Access Required</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          The Shortage Intelligence portal delivers predictive stock depletion models and alert reviews
          for health ministry analysts. You are currently in <strong>{session.role}</strong> mode.
        </p>
        <button
          onClick={() => updateRole('analyst')}
          className="btn-primary text-xs py-2 px-4 mx-auto"
        >
          Switch to Analyst (Demo)
        </button>
      </div>
    );
  }

  const filteredForecasts = forecasts.filter((f) => {
    if (hideLowRisk && f.risk === 'low') return false;
    if (filterProvince && f.province !== filterProvince) return false;
    if (filterDistrict && f.district !== filterDistrict) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Government Shortage Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Predictive stock-out forecasting and AI-assisted clinical supply alerts.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRunAnalysis}
            disabled={runningAnalysis}
            className="btn-primary text-xs py-2 px-3.5 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${runningAnalysis ? 'animate-spin' : ''}`} />
            <span>{runningAnalysis ? 'Scanning Engine...' : 'Run Shortage Analysis'}</span>
          </button>
          <a
            href="/api/analytics/export"
            download
            className="btn-secondary text-xs py-2 px-3.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Mandatory Regulatory Warning Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 leading-relaxed flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0" />
        <div>
          <strong>Intelligence Advisory:</strong> Potential risks detected among participating reporting
          pharmacies only (synthetic data). This dashboard presents mathematical projections, not confirmed
          national stock-outs.
        </div>
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

      {/* KPI Tiles */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="card-network p-3.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Reporting Pharmacies</span>
            <div className="text-xl font-black text-slate-900 mt-1">{kpis.reportingPharmacies}</div>
          </div>
          <div className="card-network p-3.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Monitored Medicines</span>
            <div className="text-xl font-black text-slate-900 mt-1">{kpis.monitoredMedicines}</div>
          </div>
          <div className="card-network p-3.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Open Alerts</span>
            <div className="text-xl font-black text-rose-700 mt-1">{kpis.openAlerts}</div>
          </div>
          <div className="card-network p-3.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Reporting Districts</span>
            <div className="text-xl font-black text-slate-900 mt-1">{kpis.reportingDistricts} / 25</div>
          </div>
          <div className="card-network p-3.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Data Freshness</span>
            <div className="text-xl font-black text-[#005691] mt-1">{kpis.freshPercentage}%</div>
          </div>
          <div className="card-network p-3.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Critical Risks</span>
            <div className="text-xl font-black text-rose-700 mt-1">{kpis.criticalCount}</div>
          </div>
        </div>
      )}

      {/* District Breakdown Summary Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900">District Supply Status Overview</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {districtSummaries.map((d) => (
            <button
              key={d.district}
              onClick={() => setFilterDistrict(filterDistrict === d.district ? '' : d.district)}
              className={`p-3 rounded-lg border text-left transition ${
                filterDistrict === d.district
                  ? 'bg-sky-50 border-[#005691] shadow-2xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="font-bold text-xs text-slate-900 truncate">{d.district}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{d.pharmacies} pharmacies</div>
              <div className="mt-2 flex items-center justify-between">
                <RiskBadge type="risk" value={d.worstRisk} showIcon={false} className="text-[9px] py-0 px-1.5" />
                {d.activeAlerts > 0 && (
                  <span className="text-[10px] font-bold text-rose-700">{d.activeAlerts} alerts</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Forecast Table + Interactive Chart Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Forecasts Table */}
        <div className="lg:col-span-7 space-y-4">
          <div className="card-network p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">
                Shortage Risk Projections ({filteredForecasts.length})
              </h3>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hideLowRisk}
                    onChange={(e) => setHideLowRisk(e.target.checked)}
                    className="rounded text-[#005691]"
                  />
                  <span>Hide Low Risk</span>
                </label>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Risk Level</th>
                    <th className="py-2.5 px-3">Medicine Variant</th>
                    <th className="py-2.5 px-3">District</th>
                    <th className="py-2.5 px-3">Supply</th>
                    <th className="py-2.5 px-3">Depletion</th>
                    <th className="py-2.5 px-3">Demand/d</th>
                    <th className="py-2.5 px-3">Freshness</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredForecasts.map((f, idx) => {
                    const isSelected =
                      selectedForecast?.medicineId === f.medicineId &&
                      selectedForecast?.district === f.district;
                    return (
                      <tr
                        key={idx}
                        onClick={() => fetchSingleForecast(f.medicineId, f.district)}
                        className={`cursor-pointer transition ${
                          isSelected ? 'bg-sky-50 font-semibold' : 'hover:bg-slate-50/50'
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <RiskBadge type="risk" value={f.risk} />
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{f.medicineLabel}</td>
                        <td className="py-2.5 px-3 text-slate-600">{f.district}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">
                          {f.daysOfSupply ? `${f.daysOfSupply}d` : 'N/A'}
                        </td>
                        <td className="py-2.5 px-3">
                          {f.depletionDay ? (
                            <span className="font-extrabold text-rose-700">Day {f.depletionDay}</span>
                          ) : (
                            <span className="text-slate-400">None</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{f.avgDemand}</td>
                        <td className="py-2.5 px-3 text-slate-500">{(f.coverage * 100).toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Detailed Forecast Chart & Gemma Explanation */}
        <div className="lg:col-span-5 space-y-4">
          {selectedForecast ? (
            <div className="space-y-4">
              <div className="card-network p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      {selectedForecast.medicineLabel}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {selectedForecast.district} District ({selectedForecast.province})
                    </p>
                  </div>
                  <RiskBadge type="risk" value={selectedForecast.risk} />
                </div>

                {/* Recharts Forecast Graph */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">
                    30-Day Reported Stock & 21-Day Depletion Projection
                  </span>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={selectedForecast.series}
                        margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={6} />
                        <YAxis tick={{ fontSize: 9 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            borderRadius: '8px',
                            fontSize: '11px',
                            border: '1px solid #e2e8f0',
                          }}
                        />
                        <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                        <Line
                          type="monotone"
                          dataKey="stock"
                          name="Reported Stock"
                          stroke="#005691"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="projected"
                          name="Projected Trend"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-center gap-6 text-[10px] text-slate-500 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-[#005691]" />
                      Reported Stock (30d)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-[#f59e0b] border-t border-dashed border-[#f59e0b]" />
                      Holt Forecast (21d)
                    </span>
                  </div>
                </div>

                {/* Mathematical Evidence */}
                <div className="space-y-1.5 text-xs pt-3 border-t border-slate-100">
                  <span className="font-bold text-slate-700 block">Corroborating Evidence:</span>
                  <ul className="space-y-1 text-slate-600 text-[11px]">
                    {selectedForecast.evidence.map((line, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-[#005691] font-bold">•</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Gemma 4 Explanation Box */}
              <ExplainBox
                medicineId={selectedForecast.medicineId}
                district={selectedForecast.district}
              />
            </div>
          ) : (
            <div className="card-network p-12 text-center text-slate-500 text-xs">
              Select a forecast row on the left to inspect depletion charts and AI explanations.
            </div>
          )}
        </div>
      </div>

      {/* Alert Review Queue */}
      <div className="space-y-4 pt-6 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Shortage Alert Review Queue ({alerts.length})
            </h2>
            <p className="text-xs text-slate-500">
              Health ministry analyst review decisions. Escalation triggers simulated transmission to central authorities.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs font-semibold">
            {['open', 'acknowledged', 'escalated', 'dismissed', 'all'].map((st) => (
              <button
                key={st}
                onClick={() => setAlertStatusFilter(st)}
                className={`px-2.5 py-1 rounded capitalize transition ${
                  alertStatusFilter === st
                    ? 'bg-[#005691] text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="card-network p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {(alert as any).medicineLabel || alert.snapshot.medicineLabel || alert.medicineId}
                    </h3>
                    <p className="text-xs text-slate-500">{alert.district} District</p>
                  </div>
                  <RiskBadge type="risk" value={alert.risk} />
                </div>

                <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span>Depletion Urgency:</span>
                    <strong className="text-rose-700">
                      {alert.snapshot.depletionDay ? `Day ${alert.snapshot.depletionDay}` : 'None'}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Available Stock:</span>
                    <strong>{alert.snapshot.available} units</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Freshness Coverage:</span>
                    <strong>{(alert.snapshot.coverage * 100).toFixed(0)}%</strong>
                  </div>
                </div>

                {alert.notes && (
                  <div className="p-2 bg-sky-50 rounded border border-sky-100 text-[11px] text-sky-900">
                    <strong>Reviewer Note:</strong> {alert.notes}
                  </div>
                )}

                {/* Justification Note Input */}
                <input
                  type="text"
                  placeholder="Justification note for review/escalation..."
                  value={alertNotes[alert.id] || ''}
                  onChange={(e) =>
                    setAlertNotes((prev) => ({ ...prev, [alert.id]: e.target.value }))
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs text-slate-800"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100">
                {alert.status === 'open' && (
                  <button
                    onClick={() => handleAlertAction(alert.id, 'acknowledge')}
                    className="flex-1 py-1.5 px-2 rounded bg-sky-50 text-sky-800 hover:bg-sky-100 font-bold text-xs"
                  >
                    Acknowledge
                  </button>
                )}
                <button
                  onClick={() => handleAlertAction(alert.id, 'escalate')}
                  className="flex-1 py-1.5 px-2 rounded bg-purple-50 text-purple-800 hover:bg-purple-100 font-bold text-xs"
                >
                  Escalate (Simulated)
                </button>
                <button
                  onClick={() => handleAlertAction(alert.id, 'dismiss')}
                  className="flex-1 py-1.5 px-2 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Demand Surge Simulator Panel */}
      <div className="card-network p-6 bg-gradient-to-br from-amber-50/50 to-white border-amber-200 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Demand Surge Stress Simulator
            </h3>
            <span className="text-[11px] text-slate-500">
              Live sensitivity analysis: simulate sudden epidemics or panic purchasing
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Target Medicine</label>
            <select
              value={surgeMedId}
              onChange={(e) => setSurgeMedId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded p-2 font-medium"
            >
              <option value="m1">Salbutamol 100mcg Inhaler</option>
              <option value="m3">Amoxicillin 500mg Capsule</option>
              <option value="m5">Losartan 50mg Tablet</option>
              <option value="m6">Paracetamol 500mg Tablet</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Target District</label>
            <select
              value={surgeDistrict}
              onChange={(e) => setSurgeDistrict(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded p-2 font-medium"
            >
              <option value="Colombo">Colombo</option>
              <option value="Gampaha">Gampaha</option>
              <option value="Kandy">Kandy</option>
              <option value="Galle">Galle</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Surge Depletion ({surgePercent}%)
            </label>
            <input
              type="range"
              min="10"
              max="90"
              step="5"
              value={surgePercent}
              onChange={(e) => setSurgePercent(parseInt(e.target.value) || 50)}
              className="w-full"
            />
          </div>

          <button
            onClick={handleSimulateSurge}
            disabled={simulatingSurge}
            className="btn-primary text-xs py-2 px-4 w-full"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{simulatingSurge ? 'Simulating...' : 'Simulate Spike & Recalculate'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
