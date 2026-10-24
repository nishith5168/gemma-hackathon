'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Package,
  Inbox,
  Truck,
  History,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Check,
  AlertTriangle,
  Upload,
  Sparkles,
  BarChart2,
  Calendar,
  Clock,
  Layers,
} from 'lucide-react';
import { useSession, api, ago, fileToDataUrl, compressImageForOcr, OcrCompressionResult } from '@/lib/client';
import { InventoryItem, Pharmacy, StockRequest, Replenishment, Medicine, HistoryRecord } from '@/lib/types';
import { RiskBadge } from '../components/RiskBadge';

export default function PharmacyPage() {
  const { session, updateRole } = useSession();

  const [activeTab, setActiveTab] = useState<
    'inventory' | 'requests' | 'receive' | 'deliveries' | 'history' | 'analytics'
  >('inventory');

  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [replenishments, setReplenishments] = useState<any[]>([]);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [catalogue, setCatalogue] = useState<Medicine[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Quick edit state per item
  const [updateDeltas, setUpdateDeltas] = useState<Record<string, { mode: 'change' | 'set'; value: number }>>({});
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Invoice scan state
  const [invoiceScanning, setInvoiceScanning] = useState(false);
  const [invoiceCompression, setInvoiceCompression] = useState<OcrCompressionResult | null>(null);
  const [invoiceLines, setInvoiceLines] = useState<any[]>([]);
  const [supplierName, setSupplierName] = useState('SPC Colombo Distribution Hub');

  // CSV Import State
  const [csvText, setCsvText] = useState('');
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [importingCsv, setImportingCsv] = useState(false);

  // Add Medicine Form
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMedId, setNewMedId] = useState('');
  const [newMedQty, setNewMedQty] = useState(50);
  const [newMedBatch, setNewMedBatch] = useState('B100234');
  const [newMedExpiry, setNewMedExpiry] = useState('2027-12-31');

  const pharmacyId = session.pharmacyId || 'p1';

  // Load pharmacy details & catalogue
  useEffect(() => {
    api<Pharmacy[]>('/api/pharmacies?all=1').then((res) => {
      if (res.data) {
        const found = res.data.find((p) => p.id === pharmacyId) || res.data[0];
        if (found) setPharmacy(found);
      }
    });

    api<Medicine[]>('/api/medicines').then((res) => {
      if (res.data) setCatalogue(res.data);
    });
  }, [pharmacyId]);

  // Load active tab data
  const loadData = () => {
    if (!pharmacyId) return;

    if (activeTab === 'inventory') {
      api<any[]>(`/api/inventory?pharmacyId=${pharmacyId}`).then((res) => {
        if (res.data) setInventory(res.data);
      });
    } else if (activeTab === 'requests') {
      api<any[]>(`/api/requests?pharmacyId=${pharmacyId}`).then((res) => {
        if (res.data) setRequests(res.data);
      });
    } else if (activeTab === 'deliveries') {
      api<any[]>(`/api/replenishments?pharmacyId=${pharmacyId}`).then((res) => {
        if (res.data) setReplenishments(res.data);
      });
    } else if (activeTab === 'history') {
      api<any[]>(`/api/inventory/history?pharmacyId=${pharmacyId}&limit=100`).then((res) => {
        if (res.data) setHistoryList(res.data);
      });
    } else if (activeTab === 'analytics') {
      api<any>(`/api/pharmacy/stats?pharmacyId=${pharmacyId}`).then((res) => {
        if (res.data) setStats(res.data);
      });
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000); // Polling every 8s
    return () => clearInterval(interval);
  }, [activeTab, pharmacyId]);

  // Role gate check
  if (session.role !== 'pharmacist' && session.role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <Building2 className="w-12 h-12 text-[#005691] mx-auto opacity-70" />
        <h2 className="text-xl font-bold text-slate-900">Pharmacist Access Required</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          The Pharmacy Desk allows community pharmacists to manage stock, respond to patient hold
          reservations, and process invoice deliveries. You are currently in <strong>{session.role}</strong> mode.
        </p>
        <button
          onClick={() => updateRole('pharmacist')}
          className="btn-primary text-xs py-2 px-4 mx-auto"
        >
          Switch to Pharmacist (Demo)
        </button>
      </div>
    );
  }

  // Stock Quick Update
  const handleStockUpdate = async (item: any) => {
    const delta = updateDeltas[item.id];
    if (!delta || isNaN(delta.value)) return;

    setLoading(true);
    setActionMessage(null);

    const body: any = {};
    if (delta.mode === 'set') {
      body.setQuantity = delta.value;
    } else {
      body.change = delta.value;
      body.reason = delta.value > 0 ? 'received' : 'dispensed';
    }

    const res = await api(`/api/inventory/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

    setLoading(false);
    if (res.data) {
      setActionMessage({ text: `Updated stock for ${item.medicineLabel}` });
      loadData();
      setUpdateDeltas((prev) => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });
    } else {
      setActionMessage({ text: res.error || 'Failed updating stock', error: true });
    }
  };

  // Touch verify timestamp
  const handleVerifyStock = async (item: any) => {
    const res = await api(`/api/inventory/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ verifyOnly: true }),
    });
    if (res.data) {
      setActionMessage({ text: `Confirmed accuracy for ${item.medicineLabel}` });
      loadData();
    }
  };

  // Request State Machine Action
  const handleRequestAction = async (reqId: string, action: string, note?: string) => {
    setLoading(true);
    setActionMessage(null);

    const res = await api(`/api/requests/${reqId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action, note }),
    });

    setLoading(false);
    if (res.data) {
      setActionMessage({ text: `Request successfully updated: ${action.toUpperCase()}` });
      loadData();
    } else {
      setActionMessage({ text: res.error || 'Request action failed', error: true });
    }
  };

  // Invoice OCR Scan with High-Efficiency OCR Compression
  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setInvoiceScanning(true);
    setInvoiceCompression(null);
    try {
      const compressed = await compressImageForOcr(file, 1200, 0.72);
      setInvoiceCompression(compressed);
      const res = await api<any>('/api/ai/invoice', {
        method: 'POST',
        body: JSON.stringify({ image: compressed.dataUrl }),
      });
      setInvoiceScanning(false);
      if (res.data) {
        setSupplierName(res.data.supplier || 'Medical Distributor');
        setInvoiceLines(
          res.data.items.map((it: any) => ({
            medicineId: it.exactMatch?.id || (catalogue[0]?.id || 'm1'),
            medicineLabel: it.exactMatch ? `${it.exactMatch.generic} ${it.exactMatch.strength}` : `${it.generic} ${it.strength}`,
            quantity: it.quantity || 100,
            batch: it.batch || 'B882109',
            expiry: it.expiry || '2027-10-31',
          }))
        );
      }
    } catch {
      setInvoiceScanning(false);
      alert('Error uploading invoice');
    }
  };

  // Submit Reviewed Invoice Lines to Stock
  const handleReceiveInvoice = async () => {
    if (invoiceLines.length === 0) return;
    setLoading(true);
    const res = await api('/api/inventory/receive', {
      method: 'POST',
      body: JSON.stringify({
        pharmacyId,
        supplier: supplierName,
        lines: invoiceLines,
      }),
    });
    setLoading(false);
    if (res.data) {
      setActionMessage({ text: `Successfully received ${invoiceLines.length} invoice items into inventory!` });
      setInvoiceLines([]);
      setActiveTab('inventory');
      loadData();
    } else {
      setActionMessage({ text: res.error || 'Failed receiving delivery lines', error: true });
    }
  };

  // CSV Import Submit
  const handleCsvImport = async () => {
    if (!csvText.trim()) return;
    setImportingCsv(true);
    setCsvErrors([]);

    const res = await api<any>('/api/inventory/import', {
      method: 'POST',
      body: JSON.stringify({ pharmacyId, csv: csvText }),
    });

    setImportingCsv(false);
    if (res.data) {
      setActionMessage({ text: `Successfully imported ${res.data.importedCount} lines!` });
      setCsvText('');
      setActiveTab('inventory');
      loadData();
    } else {
      setCsvErrors(res.errors || [res.error || 'Import failed']);
    }
  };

  // Add Single Medicine
  const handleAddMedicine = async () => {
    if (!newMedId) return;
    const res = await api('/api/inventory', {
      method: 'POST',
      body: JSON.stringify({
        pharmacyId,
        medicineId: newMedId,
        quantity: newMedQty,
        batch: newMedBatch,
        expiry: newMedExpiry,
      }),
    });
    if (res.data) {
      setShowAddModal(false);
      loadData();
    } else {
      alert(res.error || 'Failed adding medicine');
    }
  };

  const lowStockItems = inventory.filter((i) => i.available <= i.lowThreshold);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Pharmacy Header & Status */}
      <div className="card-network p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              {pharmacy?.name || 'Community Pharmacy'}
            </h1>
            <RiskBadge type="status" value={pharmacy?.status || 'verified'} />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {pharmacy?.address} • Lic: <strong>{pharmacy?.licenceNo}</strong> • Hours: {pharmacy?.hours}
          </p>
        </div>

        {pharmacy?.status === 'pending' && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <strong>Pending Registration:</strong> This pharmacy is awaiting NMRA licence approval in the Admin portal.
          </div>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === 'inventory' ? 'bg-[#005691] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Package className="w-4 h-4" />
          Inventory ({inventory.length})
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === 'requests' ? 'bg-[#005691] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Inbox className="w-4 h-4" />
          Requests ({requests.filter((r) => r.status === 'pending').length} pending)
        </button>
        <button
          onClick={() => setActiveTab('receive')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === 'receive' ? 'bg-[#005691] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Upload className="w-4 h-4" />
          Receive Stock (Invoice & CSV)
        </button>
        <button
          onClick={() => setActiveTab('deliveries')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === 'deliveries' ? 'bg-[#005691] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Truck className="w-4 h-4" />
          Expected Deliveries
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === 'history' ? 'bg-[#005691] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <History className="w-4 h-4" />
          Transaction History
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === 'analytics' ? 'bg-[#005691] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Pharmacy Analytics
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

      {/* ----------------------------------------------------------------- */}
      {/* TAB 1: INVENTORY */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Low Stock Warning Banner */}
          {lowStockItems.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <strong>{lowStockItems.length} medicine lines</strong> are at or below safety reorder threshold.
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">Current Medicine Stock Lines</h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary text-xs py-1.5 px-3"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Medicine to Inventory
            </button>
          </div>

          <div className="card-network overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-3 px-3">Medicine Variant</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">On Hand</th>
                    <th className="py-3 px-3">Reserved</th>
                    <th className="py-3 px-3">Available</th>
                    <th className="py-3 px-3">Batch / Expiry</th>
                    <th className="py-3 px-3">Last Verified</th>
                    <th className="py-3 px-3 text-right">Quick Stock Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventory.map((item) => {
                    const delta = updateDeltas[item.id] || { mode: 'change', value: -5 };
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {item.medicineLabel}
                          <span className="block text-[11px] text-slate-400 font-normal">
                            Brand: {item.medicine?.brand || 'Generic'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <RiskBadge type="band" value={item.band} />
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-800">{item.quantity}</td>
                        <td className="py-3 px-3 text-slate-600">{item.reserved}</td>
                        <td className="py-3 px-3 font-extrabold text-[#005691]">{item.available}</td>
                        <td className="py-3 px-3 text-slate-600">
                          <div>{item.batch || '—'}</div>
                          <div className="text-[11px] text-slate-500">
                            {item.expiry || '—'}
                            {item.expiringSoon && (
                              <span className="ml-1 px-1 rounded bg-rose-100 text-rose-700 font-bold text-[10px]">
                                Expiring &lt;60d
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-slate-600">{ago(item.updatedAt)}</div>
                          <button
                            onClick={() => handleVerifyStock(item)}
                            className="mt-1 text-[10px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-0.5"
                            title="Confirm stock count is still correct as of today"
                          >
                            <Check className="w-3 h-3" />
                            Still correct
                          </button>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <select
                              value={delta.mode}
                              onChange={(e) =>
                                setUpdateDeltas((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    mode: e.target.value as any,
                                    value: e.target.value === 'set' ? item.quantity : -5,
                                  },
                                }))
                              }
                              className="bg-slate-50 border border-slate-300 rounded text-[11px] p-1 text-slate-700"
                            >
                              <option value="change">Dispense (-)</option>
                              <option value="change">Receive (+)</option>
                              <option value="set">Set (=)</option>
                            </select>
                            <input
                              type="number"
                              value={delta.value}
                              onChange={(e) =>
                                setUpdateDeltas((prev) => ({
                                  ...prev,
                                  [item.id]: { ...delta, value: parseInt(e.target.value) || 0 },
                                }))
                              }
                              className="w-14 bg-slate-50 border border-slate-300 rounded text-[11px] p-1 font-bold text-center text-slate-800"
                            />
                            <button
                              onClick={() => handleStockUpdate(item)}
                              disabled={loading}
                              className="btn-primary text-[11px] py-1 px-2.5"
                            >
                              Save
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* TAB 2: REQUESTS INBOX */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900 leading-relaxed">
            <strong>Pharmacy Hold Protocol:</strong> Confirming signals that medicine is ready on the shelf.
            Reserving deducts available stock from patient availability searches. Collecting dispenses the stock.
          </div>

          <div className="card-network overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Medicine Variant</th>
                    <th className="py-3 px-4">Qty</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Note</th>
                    <th className="py-3 px-4">Received</th>
                    <th className="py-3 px-4 text-right">Workflow Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-semibold text-slate-900">{r.patientName}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{r.medicineLabel}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{r.quantity}</td>
                      <td className="py-3 px-4 uppercase text-[10px] font-bold text-slate-500">{r.type}</td>
                      <td className="py-3 px-4">
                        <RiskBadge type="request" value={r.status} />
                      </td>
                      <td className="py-3 px-4 text-slate-500 italic max-w-xs truncate">{r.note || 'None'}</td>
                      <td className="py-3 px-4 text-slate-500">{ago(r.createdAt)}</td>
                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        {r.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleRequestAction(r.id, 'confirm')}
                              className="px-2 py-1 rounded bg-sky-50 text-sky-800 hover:bg-sky-100 font-bold text-[11px]"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => handleRequestAction(r.id, 'reserve')}
                              className="px-2 py-1 rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold text-[11px]"
                            >
                              Reserve Hold
                            </button>
                            <button
                              onClick={() => handleRequestAction(r.id, 'reject', 'Out of stock at this branch')}
                              className="px-2 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-[11px]"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {r.status === 'confirmed' && (
                          <>
                            <button
                              onClick={() => handleRequestAction(r.id, 'reserve')}
                              className="px-2 py-1 rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold text-[11px]"
                            >
                              Reserve
                            </button>
                            <button
                              onClick={() => handleRequestAction(r.id, 'collect')}
                              className="px-2 py-1 rounded bg-[#005691] text-white hover:bg-[#004373] font-bold text-[11px]"
                            >
                              Patient Collected
                            </button>
                          </>
                        )}
                        {r.status === 'reserved' && (
                          <button
                            onClick={() => handleRequestAction(r.id, 'collect')}
                            className="px-2.5 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-[11px]"
                          >
                            Mark Collected (Dispense)
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* TAB 3: RECEIVE STOCK (INVOICE & CSV) */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'receive' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left: Supplier Invoice Multimodal Scan */}
          <div className="card-network p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#005691] text-white flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Gemma 4 Supplier Invoice Scanner
                </h3>
                <span className="text-[11px] text-slate-500">
                  Multimodal delivery note line extraction
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Scan paper supplier delivery notes (SPMC, SPC, Emerchemie). Gemma extracts delivered quantities,
              batches, and expiry dates into an editable review table before adding to stock.
            </p>

            <label className="btn-primary w-full text-xs py-2.5 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Scan Supplier Invoice Photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleInvoiceUpload}
                className="hidden"
              />
            </label>

            {invoiceScanning && (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-600">
                <RefreshCw className="w-4 h-4 animate-spin text-[#005691]" />
                <span>Reading invoice items with Gemma 4...</span>
              </div>
            )}

            {invoiceCompression && (
              <div className="bg-sky-50/80 border border-sky-200 rounded-lg p-2.5 space-y-1 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    OCR Compression Active
                  </span>
                  <span className="font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px]">
                    {invoiceCompression.savedPercent}% bandwidth saved
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-600">
                  <span>{invoiceCompression.originalSizeFormatted} → <strong>{invoiceCompression.compressedSizeFormatted}</strong></span>
                  <span className="text-slate-400 font-mono text-[10px]">{invoiceCompression.dimensions.width}×{invoiceCompression.dimensions.height} · {invoiceCompression.durationMs}ms</span>
                </div>
              </div>
            )}

            {invoiceLines.length > 0 && (
              <div className="space-y-4 pt-3 border-t border-slate-200">
                <div className="text-xs">
                  <label className="font-bold text-slate-700 block mb-1">Supplier</label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-semibold"
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 block">
                    Review Extracted Lines ({invoiceLines.length}):
                  </span>
                  {invoiceLines.map((line, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 rounded border border-slate-200 text-xs space-y-2"
                    >
                      <div className="font-semibold text-slate-900">{line.medicineLabel}</div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500">Units</label>
                          <input
                            type="number"
                            value={line.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setInvoiceLines((lines) =>
                                lines.map((l, i) => (i === idx ? { ...l, quantity: val } : l))
                              );
                            }}
                            className="w-full bg-white border border-slate-300 rounded p-1 font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500">Batch</label>
                          <input
                            type="text"
                            value={line.batch}
                            onChange={(e) => {
                              const val = e.target.value;
                              setInvoiceLines((lines) =>
                                lines.map((l, i) => (i === idx ? { ...l, batch: val } : l))
                              );
                            }}
                            className="w-full bg-white border border-slate-300 rounded p-1"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500">Expiry</label>
                          <input
                            type="date"
                            value={line.expiry}
                            onChange={(e) => {
                              const val = e.target.value;
                              setInvoiceLines((lines) =>
                                lines.map((l, i) => (i === idx ? { ...l, expiry: val } : l))
                              );
                            }}
                            className="w-full bg-white border border-slate-300 rounded p-1"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleReceiveInvoice}
                  disabled={loading}
                  className="btn-primary w-full text-xs py-2"
                >
                  <Check className="w-4 h-4" />
                  Confirm and Receive into Stock
                </button>
              </div>
            )}
          </div>

          {/* Right: CSV Bulk Import */}
          <div className="card-network p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Strict CSV Stock Import</h3>
                <span className="text-[11px] text-slate-500">
                  All-or-nothing validation against NMRA catalogue
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Header format: <code>generic,strength,form,quantity,batch,expiry</code>.
              Every single line is verified; any invalid variant or negative count rejects the whole batch.
            </p>

            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="generic,strength,form,quantity,batch,expiry&#10;Salbutamol,100 mcg/dose,Inhaler,25,B89104,2027-10-31&#10;Metformin,500 mg,Tablet,200,B44129,2027-12-15"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#005691]"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() =>
                  setCsvText(
                    `generic,strength,form,quantity,batch,expiry\nSalbutamol,100 mcg/dose,Inhaler,30,B89104,2027-10-31\nMetformin,500 mg,Tablet,250,B44129,2027-12-15`
                  )
                }
                className="btn-secondary text-[11px] py-1 px-2"
              >
                Insert Valid Sample CSV
              </button>
              <button
                onClick={() =>
                  setCsvText(
                    `generic,strength,form,quantity,batch,expiry\nSalbutamol,100 mcg/dose,Inhaler,30,B89104,2027-10-31\nNonExistentMedicine,999 mg,Syrup,250,B44129,2027-12-15`
                  )
                }
                className="px-2 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 text-[11px] font-semibold"
              >
                Insert Bad Rows (Test 422)
              </button>
            </div>

            {csvErrors.length > 0 && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
                <strong>Validation Errors (Nothing written):</strong>
                <ul className="list-disc pl-4 space-y-0.5">
                  {csvErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={handleCsvImport}
              disabled={importingCsv || !csvText.trim()}
              className="btn-primary w-full text-xs py-2"
            >
              {importingCsv ? 'Validating...' : 'Validate and Import CSV'}
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* TAB 4: DELIVERIES */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'deliveries' && (
        <div className="space-y-4">
          <div className="card-network overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Medicine Variant</th>
                    <th className="py-3 px-4">Quantity</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Expected Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {replenishments.map((rep) => (
                    <tr key={rep.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-semibold text-slate-900">{rep.medicineLabel}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{rep.quantity}</td>
                      <td className="py-3 px-4 text-slate-600">{rep.supplier}</td>
                      <td className="py-3 px-4 text-slate-700">{rep.expectedDate}</td>
                      <td className="py-3 px-4">
                        <RiskBadge type="status" value={rep.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        {rep.status === 'expected' && (
                          <div className="space-x-1">
                            <button
                              onClick={async () => {
                                await api(`/api/replenishments/${rep.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ status: 'received' }),
                                });
                                loadData();
                              }}
                              className="px-2 py-1 rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold text-[11px]"
                            >
                              Mark Received
                            </button>
                            <button
                              onClick={async () => {
                                await api(`/api/replenishments/${rep.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ status: 'cancelled' }),
                                });
                                loadData();
                              }}
                              className="px-2 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 font-semibold text-[11px]"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* TAB 5: TRANSACTION HISTORY */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'history' && (
        <div className="card-network overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Medicine Variant</th>
                  <th className="py-3 px-4">Change</th>
                  <th className="py-3 px-4">On Hand After</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyList.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 text-slate-500">{new Date(h.at).toLocaleString()}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{h.medicineLabel}</td>
                    <td className={`py-3 px-4 font-bold ${h.change > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {h.change > 0 ? `+${h.change}` : h.change}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{h.qtyAfter}</td>
                    <td className="py-3 px-4 uppercase text-[10px] font-bold text-slate-500">{h.reason}</td>
                    <td className="py-3 px-4 text-slate-600">{h.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* TAB 6: PHARMACY ANALYTICS */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'analytics' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card-network p-4">
              <span className="text-[11px] text-slate-500 font-bold uppercase">Tracked Lines</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{stats.lines}</div>
            </div>
            <div className="card-network p-4">
              <span className="text-[11px] text-slate-500 font-bold uppercase">Low Stock Lines</span>
              <div className="text-2xl font-black text-amber-700 mt-1">{stats.lowStock}</div>
            </div>
            <div className="card-network p-4">
              <span className="text-[11px] text-slate-500 font-bold uppercase">Held Reservations</span>
              <div className="text-2xl font-black text-[#005691] mt-1">{stats.reservedUnits}</div>
            </div>
            <div className="card-network p-4">
              <span className="text-[11px] text-slate-500 font-bold uppercase">Expiring &lt;60d</span>
              <div className="text-2xl font-black text-rose-700 mt-1">{stats.expiringSoon}</div>
            </div>
          </div>

          <div className="card-network p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Top Dispensed Medicines (Last 7 Days)</h3>
            <div className="space-y-2">
              {stats.topDispensed.map((item: any) => (
                <div key={item.medicineId} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="font-semibold text-slate-800">{item.label}</span>
                  <span className="font-bold text-[#005691]">{item.units} units</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Medicine Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Add Catalogue Medicine to Stock</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Medicine Variant</label>
                <select
                  value={newMedId}
                  onChange={(e) => setNewMedId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium"
                >
                  <option value="">-- Choose Catalogue Variant --</option>
                  {catalogue.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.generic} {m.strength} {m.form} ({m.brand})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Initial Quantity</label>
                <input
                  type="number"
                  value={newMedQty}
                  onChange={(e) => setNewMedQty(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Batch No</label>
                  <input
                    type="text"
                    value={newMedBatch}
                    onChange={(e) => setNewMedBatch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={newMedExpiry}
                    onChange={(e) => setNewMedExpiry(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="btn-secondary text-xs py-2 px-3"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMedicine}
                className="btn-primary text-xs py-2 px-4"
              >
                Add to Inventory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
