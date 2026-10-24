'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  MapPin,
  Camera,
  Clock,
  Phone,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Send,
  X,
  FileText,
  Bookmark,
} from 'lucide-react';
import { api, fileToDataUrl, ago, useSession } from '@/lib/client';
import { Medicine, Pharmacy, StockRequest } from '@/lib/types';
import { I18N, Language } from '@/lib/i18n';
import { RiskBadge } from '../components/RiskBadge';
import { MapView } from '../components/MapView';

export default function PatientPage() {
  const { session } = useSession();

  // Language state
  const [lang, setLang] = useState<Language>('en');
  useEffect(() => {
    try {
      const stored = localStorage.getItem('medsignal-patient-lang') as Language;
      if (stored && ['en', 'si', 'ta'].includes(stored)) setLang(stored);
    } catch {}
  }, []);

  const handleLangToggle = (newLang: Language) => {
    setLang(newLang);
    try {
      localStorage.setItem('medsignal-patient-lang', newLang);
    } catch {}
  };

  const t = I18N[lang];

  // Catalogue & Search
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [query, setQuery] = useState('');
  const [selectedMed, setSelectedMed] = useState<Medicine | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('Colombo');

  // Location
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>({
    lat: 6.9271,
    lng: 79.8612,
  });
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  // Availability results
  const [availability, setAvailability] = useState<{
    medicine: Medicine;
    results: {
      pharmacy: Pharmacy;
      band: 'in' | 'low' | 'out';
      lastVerified: string;
      fresh: boolean;
      distanceKm: number | null;
    }[];
  } | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);

  // Prescription AI Scan
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    items: {
      generic: string;
      brand: string;
      strength: string;
      form: string;
      quantity: number;
      exactMatch: Medicine | null;
      candidates: Medicine[];
    }[];
    notes: string;
    mock: boolean;
  } | null>(null);

  // Reservation Request Modal
  const [requestTarget, setRequestTarget] = useState<{
    pharmacy: Pharmacy;
    type: 'confirm' | 'reserve';
  } | null>(null);
  const [requestQty, setRequestQty] = useState(1);
  const [requestNote, setRequestNote] = useState('');
  const [submittingReq, setSubmittingReq] = useState(false);
  const [reqMessage, setReqMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // My Requests
  const [myRequests, setMyRequests] = useState<StockRequest[]>([]);

  // Load catalogue on mount
  useEffect(() => {
    api<Medicine[]>('/api/medicines').then((res) => {
      if (res.data) {
        setMedicines(res.data);
        // Default to Salbutamol 100mcg Inhaler for smooth 90s demo flow
        const defaultMed = res.data.find((m) => m.id === 'm1') || res.data[0];
        if (defaultMed) {
          setSelectedMed(defaultMed);
        }
      }
    });
  }, []);

  // Fetch availability when selectedMed or district or location changes
  useEffect(() => {
    if (!selectedMed) return;
    setLoadingStock(true);

    const latParam = userLocation ? `&lat=${userLocation.lat}&lng=${userLocation.lng}` : '';
    const distParam = selectedDistrict ? `&district=${selectedDistrict}` : '';

    api<any>(`/api/availability?medicineId=${selectedMed.id}${distParam}${latParam}`).then(
      (res) => {
        setLoadingStock(false);
        if (res.data) setAvailability(res.data);
      }
    );
  }, [selectedMed, selectedDistrict, userLocation]);

  // Poll My Requests every 8 seconds
  const fetchMyRequests = () => {
    api<StockRequest[]>(`/api/requests?patientId=${session.patientId}`).then((res) => {
      if (res.data) setMyRequests(res.data);
    });
  };

  useEffect(() => {
    fetchMyRequests();
    const interval = setInterval(fetchMyRequests, 8000);
    return () => clearInterval(interval);
  }, [session.patientId]);

  // Geolocation trigger
  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by your browser. Using Colombo Fort.');
      setUserLocation({ lat: 6.9271, lng: 79.8612 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus('Using current GPS coordinates for distance calculation.');
      },
      (err) => {
        setLocationStatus('Location access blocked. Using default Colombo coordinates.');
        setUserLocation({ lat: 6.9271, lng: 79.8612 });
      }
    );
  };

  // Prescription Image Upload
  const handlePrescriptionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setScanResult(null);

    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await api<any>('/api/ai/prescription', {
        method: 'POST',
        body: JSON.stringify({ image: dataUrl }),
      });

      setScanning(false);
      if (res.data) {
        setScanResult(res.data);
      } else {
        alert(res.error || 'Failed to read prescription');
      }
    } catch (err) {
      setScanning(false);
      alert('Error uploading prescription');
    }
  };

  // Handle Request Submission
  const handleSubmitRequest = async () => {
    if (!requestTarget || !selectedMed) return;
    setSubmittingReq(true);
    setReqMessage(null);

    const res = await api<StockRequest>('/api/requests', {
      method: 'POST',
      body: JSON.stringify({
        patientId: session.patientId,
        patientName: session.user,
        medicineId: selectedMed.id,
        pharmacyId: requestTarget.pharmacy.id,
        quantity: requestQty,
        type: requestTarget.type,
        note: requestNote,
      }),
    });

    setSubmittingReq(false);
    if (res.data) {
      setReqMessage({ text: 'Hold request sent successfully! The pharmacy has been notified.' });
      fetchMyRequests();
      setTimeout(() => {
        setRequestTarget(null);
        setReqMessage(null);
        setRequestQty(1);
        setRequestNote('');
      }, 1500);
    } else {
      setReqMessage({ text: res.error || 'Failed to submit request', error: true });
    }
  };

  // Cancel Request
  const handleCancelRequest = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this request?')) return;
    const res = await api<StockRequest>(`/api/requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'cancel' }),
    });
    if (res.data) {
      fetchMyRequests();
    } else {
      alert(res.error || 'Failed to cancel request');
    }
  };

  const filteredMedicines = medicines.filter(
    (m) =>
      m.generic.toLowerCase().includes(query.toLowerCase()) ||
      m.brand.toLowerCase().includes(query.toLowerCase()) ||
      m.strength.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & Trilingual Language Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t.title}
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm mt-1">{t.tagline}</p>
        </div>

        {/* Language Toggle */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-2xs self-start sm:self-auto">
          <button
            onClick={() => handleLangToggle('en')}
            className={`px-3 py-1 rounded text-xs font-bold transition ${
              lang === 'en' ? 'bg-[#005691] text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            English
          </button>
          <button
            onClick={() => handleLangToggle('si')}
            className={`px-3 py-1 rounded text-xs font-bold transition ${
              lang === 'si' ? 'bg-[#005691] text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            සිංහල
          </button>
          <button
            onClick={() => handleLangToggle('ta')}
            className={`px-3 py-1 rounded text-xs font-bold transition ${
              lang === 'ta' ? 'bg-[#005691] text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            தமிழ்
          </button>
        </div>
      </div>

      {/* Safety & Medical Disclaimer Banner */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3.5 flex items-start gap-3 text-xs text-amber-900 leading-relaxed">
        <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Medical Transparency Notice:</strong> {t.disclaimer}
        </div>
      </div>

      {/* Search & AI Scan Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Search & Filter Controls */}
        <div className="lg:col-span-8 space-y-4">
          <div className="card-network p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#005691]"
                />
              </div>

              {/* District Dropdown */}
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#005691]"
              >
                <option value="ALL">{t.allDistricts}</option>
                <option value="Colombo">Colombo</option>
                <option value="Gampaha">Gampaha</option>
                <option value="Kalutara">Kalutara</option>
                <option value="Kandy">Kandy</option>
                <option value="Galle">Galle</option>
                <option value="Jaffna">Jaffna</option>
                <option value="Kurunegala">Kurunegala</option>
              </select>

              {/* Geolocation Button */}
              <button
                onClick={handleUseLocation}
                className="btn-secondary text-xs py-2 px-3 whitespace-nowrap"
                title="Sort pharmacies by distance from your current location"
              >
                <MapPin className="w-3.5 h-3.5" />
                {t.useLocation}
              </button>
            </div>

            {locationStatus && (
              <p className="text-[11px] text-slate-500">{locationStatus}</p>
            )}

            {/* Exact Variant Chips */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700 block">
                Select Exact Medicine Variant (Generic, Strength, Form):
              </span>
              <div className="flex flex-wrap gap-2">
                {filteredMedicines.slice(0, 10).map((m) => {
                  const isSelected = selectedMed?.id === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMed(m)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
                        isSelected
                          ? 'bg-[#005691] text-white border-[#005691] shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <strong className="font-semibold">{m.generic}</strong> {m.strength} {m.form}{' '}
                      <span className="opacity-75">({m.brand})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Gemma 4 Prescription Vision Scanner */}
        <div className="lg:col-span-4">
          <div className="card-network p-5 bg-gradient-to-br from-sky-50/70 to-white border-sky-200 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-[#005691] text-white flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Gemma 4 Prescription Scanner
                </h3>
                <span className="text-[10px] text-slate-500 font-medium">
                  Multimodal prescription OCR
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Upload or snap a photo of your paper prescription. Gemma reads prescribed medicine names
              and checks catalogue availability without storing your image.
            </p>

            <label className="btn-primary w-full text-xs py-2.5 cursor-pointer">
              <Camera className="w-4 h-4" />
              <span>{t.scanPrescription}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePrescriptionUpload}
                className="hidden"
              />
            </label>

            {scanning && (
              <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-600 font-medium">
                <RefreshCw className="w-4 h-4 animate-spin text-[#005691]" />
                <span>{t.scanningGemma}</span>
              </div>
            )}

            {scanResult && (
              <div className="space-y-3 pt-3 border-t border-sky-100 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">
                    {t.prescriptionReadHeader}
                  </span>
                  {scanResult.mock && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                      MOCK
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {scanResult.items.map((line, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-white rounded border border-slate-200 space-y-1.5"
                    >
                      <div className="font-semibold text-slate-800">
                        {line.generic} {line.strength} {line.form}{' '}
                        {line.brand ? `(${line.brand})` : ''}
                      </div>
                      {line.exactMatch ? (
                        <button
                          onClick={() => setSelectedMed(line.exactMatch)}
                          className="btn-primary text-[11px] py-1 px-2 w-full"
                        >
                          {t.findAvailability}: {line.exactMatch.generic}
                        </button>
                      ) : (
                        <div className="text-[11px] text-slate-500">
                          {line.candidates.length > 0 ? (
                            <div className="space-y-1">
                              <span>Choose exact variant:</span>
                              <div className="flex flex-wrap gap-1">
                                {line.candidates.map((c) => (
                                  <button
                                    key={c.id}
                                    onClick={() => setSelectedMed(c)}
                                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[10px] text-slate-700 font-semibold"
                                  >
                                    {c.strength} {c.form}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <span className="text-amber-700">
                              Variant not currently stocked in catalogue.
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Availability Results Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {selectedMed
                ? `Participating Pharmacy Stock: ${selectedMed.generic} ${selectedMed.strength} ${selectedMed.form}`
                : 'Pharmacy Availability'}
            </h2>
            <p className="text-xs text-slate-500">
              Exact unit counts are not shown publicly to prevent speculative hoarding.
            </p>
          </div>
        </div>

        {/* Map View */}
        {availability && availability.results.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#005691]" />
              Geographic Pharmacy Stock Map
            </span>
            <MapView pharmacies={availability.results} />
          </div>
        )}

        {/* Pharmacy Results Cards */}
        {loadingStock ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true">
            {[1, 2, 3].map((n) => (
              <div key={n} className="card-network p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="skeleton skeleton--text w-1/2" aria-hidden="true" />
                  <div className="skeleton w-16 h-5 rounded-full" aria-hidden="true" />
                </div>
                <div className="space-y-2">
                  <div className="skeleton skeleton--text-sm w-3/4" aria-hidden="true" />
                  <div className="skeleton skeleton--text-sm w-1/2" aria-hidden="true" />
                </div>
                <div className="pt-2 flex items-center gap-2">
                  <div className="skeleton h-8 w-1/2 rounded-lg" aria-hidden="true" />
                  <div className="skeleton h-8 w-1/2 rounded-lg" aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>
        ) : availability && availability.results.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availability.results.map(({ pharmacy, band, lastVerified, fresh, distanceKm }) => (
              <div
                key={pharmacy.id}
                className="card-network p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">{pharmacy.name}</h3>
                    <RiskBadge type="band" value={band} />
                  </div>

                  <div className="space-y-1 text-xs text-slate-600">
                    <p className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>
                        {pharmacy.town}, {pharmacy.district}
                        {distanceKm !== null ? ` • ${distanceKm} km away` : ''}
                      </span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>{pharmacy.phone}</span>
                    </p>
                    <p className="text-[11px] text-slate-500">{pharmacy.hours}</p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {t.lastVerified} {ago(lastVerified)}
                    </span>
                    {!fresh && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold text-[10px]">
                        {t.staleWarning}
                      </span>
                    )}
                  </div>
                </div>

                {/* Hold / Confirm Request Buttons */}
                <div className="pt-2 flex items-center gap-2">
                  <button
                    onClick={() => setRequestTarget({ pharmacy, type: 'confirm' })}
                    disabled={band === 'out'}
                    className="flex-1 btn-secondary text-xs py-1.5 px-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {t.askConfirm}
                  </button>
                  <button
                    onClick={() => setRequestTarget({ pharmacy, type: 'reserve' })}
                    disabled={band === 'out'}
                    className="flex-1 btn-primary text-xs py-1.5 px-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {t.requestReservation}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-network p-8 text-center text-slate-500 text-sm">
            {t.noResults}
          </div>
        )}
      </div>

      {/* Reservation Request Modal */}
      {requestTarget && selectedMed && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-5 border border-slate-200">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{t.reserveModalTitle}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Target Pharmacy: <strong>{requestTarget.pharmacy.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setRequestTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
              <div>
                Medicine: <strong>{selectedMed.generic} {selectedMed.strength} {selectedMed.form}</strong>
              </div>
              <div className="text-slate-500">
                Patient: <strong>{session.user}</strong>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {t.quantityLabel}
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={requestQty}
                  onChange={(e) => setRequestQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#005691]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {t.notesLabel}
                </label>
                <textarea
                  rows={2}
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  placeholder="e.g. Arriving between 5-6 PM with doctor prescription..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#005691]"
                />
              </div>

              {reqMessage && (
                <div
                  className={`p-2.5 rounded text-xs ${
                    reqMessage.error
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {reqMessage.text}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRequestTarget(null)}
                className="btn-secondary text-xs py-2 px-3"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleSubmitRequest}
                disabled={submittingReq}
                className="btn-primary text-xs py-2 px-4"
              >
                <Send className="w-3.5 h-3.5" />
                {submittingReq ? 'Sending...' : t.submitRequest}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My Active Requests Section */}
      <div className="space-y-4 pt-6 border-t border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#005691]" />
          {t.myRequests} ({myRequests.length})
        </h2>

        {myRequests.length > 0 ? (
          <div className="card-network overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Medicine Variant</th>
                    <th className="py-3 px-4">Pharmacy</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Qty</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Requested</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {(req as any).medicineLabel || req.medicineId}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {(req as any).pharmacyName || req.pharmacyId}
                      </td>
                      <td className="py-3 px-4 uppercase text-[10px] font-bold tracking-wider text-slate-500">
                        {req.type}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">{req.quantity}</td>
                      <td className="py-3 px-4">
                        <RiskBadge type="request" value={req.status} />
                      </td>
                      <td className="py-3 px-4 text-slate-500">{ago(req.createdAt)}</td>
                      <td className="py-3 px-4 text-right">
                        {['pending', 'confirmed', 'reserved'].includes(req.status) && (
                          <button
                            onClick={() => handleCancelRequest(req.id)}
                            className="text-rose-600 hover:text-rose-800 font-semibold"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            You do not currently have any active hold or confirmation requests.
          </p>
        )}
      </div>
    </div>
  );
}
