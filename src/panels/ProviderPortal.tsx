import React, { useMemo, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  LogOut,
  Menu,
  Upload,
  X,
  AlertTriangle,
} from 'lucide-react';
import {
  addStatusHistory,
  fileToDataUrl,
  loadDB,
  loginProvider,
  pushNotification,
  registerProvider,
  saveDB,
  sendOtp,
} from '../services/backend';
import { BookingRecord, ProviderAccount, ServiceCategory } from '../types';
import { StatusIndicator } from '../components/StatusIndicator';

export const ProviderPortal: React.FC = () => {
  const [provider, setProvider] = useState<ProviderAccount | null>(() => {
    const saved = sessionStorage.getItem('vv_provider_session');
    return saved ? (JSON.parse(saved) as ProviderAccount) : null;
  });
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'earnings'>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  // Login state
  const [loginCategory, setLoginCategory] = useState<ServiceCategory>('electrician');
  const [loginMobile, setLoginMobile] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Registration state
  const [regForm, setRegForm] = useState({
    service_category: 'electrician' as ServiceCategory,
    full_name: '',
    mobile_number: '',
    password: '',
    address: '',
    pin_code: '',
    qualification_details: '',
    experience_details: '',
    otp_code: '',
  });
  const [sentOtp, setSentOtp] = useState<string | null>(null);
  const [qualDoc, setQualDoc] = useState<{ file_data_url: string; original_name: string } | null>(null);
  const [expDoc, setExpDoc] = useState<{ file_data_url: string; original_name: string } | null>(null);
  const [policeDoc, setPoliceDoc] = useState<{ file_data_url: string; original_name: string } | null>(null);

  // Selected booking & completion upload state
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [completionDesc, setCompletionDesc] = useState('');
  const [completionPhotos, setCompletionPhotos] = useState<{ file_data_url: string; original_name: string }[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const db = useMemo(() => loadDB(), [refreshTick, provider, activeTab]);
  const triggerRefresh = () => setRefreshTick((t) => t + 1);

  const liveProvider = useMemo(() => {
    if (!provider) return null;
    const list = provider.service_category === 'electrician' ? db.electricians : db.plumbers;
    return list.find((p) => p.id === provider.id) || provider;
  }, [db, provider]);

  const assignedBookings = useMemo(() => {
    if (!liveProvider) return [];
    return db.bookings.filter(
      (b) => b.assigned_provider_type === liveProvider.service_category && b.assigned_provider_id === liveProvider.id
    );
  }, [db, liveProvider]);

  const myCharges = useMemo(() => {
    if (!liveProvider) return [];
    return db.electrician_service_charges.filter(
      (c) => c.provider_type === liveProvider.service_category && c.provider_id === liveProvider.id
    );
  }, [db, liveProvider]);

  const myPayouts = useMemo(() => {
    if (!liveProvider) return [];
    return db.electrician_payouts.filter(
      (p) => p.provider_type === liveProvider.service_category && p.provider_id === liveProvider.id
    );
  }, [db, liveProvider]);

  const handleSendOtp = () => {
    setAuthError(null);
    if (!/^[0-9]{10,15}$/.test(regForm.mobile_number.trim())) {
      setAuthError('Enter a valid 10-digit mobile number.');
      return;
    }
    const { otp } = sendOtp(regForm.mobile_number.trim(), regForm.service_category);
    setSentOtp(otp);
  };

  const handleDocSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<{ file_data_url: string; original_name: string } | null>>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setter({ file_data_url: dataUrl, original_name: file.name });
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!expDoc || !policeDoc) {
      setAuthError('Experience Certificate and Police Verification Certificate are mandatory.');
      return;
    }
    const docs: {
      document_type: 'qualification_certificate' | 'experience_certificate' | 'police_verification';
      file_data_url: string;
      original_name: string;
    }[] = [
      { document_type: 'experience_certificate', ...expDoc },
      { document_type: 'police_verification', ...policeDoc },
    ];
    if (qualDoc) {
      docs.push({ document_type: 'qualification_certificate', ...qualDoc });
    }
    const res = registerProvider({ ...regForm, documents: docs });
    if (res.error) {
      setAuthError(res.error);
      return;
    }
    if (res.provider) {
      sessionStorage.setItem('vv_provider_session', JSON.stringify(res.provider));
      setProvider(res.provider);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const res = loginProvider(loginCategory, loginMobile, loginPassword);
    if (res.error) {
      setAuthError(res.error);
      return;
    }
    if (res.provider) {
      sessionStorage.setItem('vv_provider_session', JSON.stringify(res.provider));
      setProvider(res.provider);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('vv_provider_session');
    setProvider(null);
  };

  const handleBookingAction = (booking: BookingRecord, action: 'accept' | 'reject' | 'in_progress') => {
    if (!liveProvider || liveProvider.approval_status !== 'approved') return;
    const currentDb = loadDB();
    const target = currentDb.bookings.find((b) => b.id === booking.id);
    if (!target) return;

    if (action === 'accept') {
      target.status = 'Accepted';
      addStatusHistory(currentDb, target.id, 'Accepted', liveProvider.service_category, liveProvider.id, `${liveProvider.full_name} accepted the job.`);
      pushNotification(currentDb, 'user', target.user_id, 'booking_accepted', 'Technician Accepted Booking', `${liveProvider.full_name} accepted ${target.booking_code}.`, target.id);
    } else if (action === 'reject') {
      target.assigned_provider_id = null;
      target.assigned_provider_type = null;
      target.status = 'Waiting for Electrician';
      addStatusHistory(currentDb, target.id, 'Waiting for Electrician', liveProvider.service_category, liveProvider.id, `Rejected by ${liveProvider.full_name}.`);
      pushNotification(currentDb, 'admin', null, 'provider_rejected_job', 'Booking Rejected by Provider', `${target.booking_code} needs reassignment.`, target.id);
    } else if (action === 'in_progress') {
      target.status = 'In Progress';
      addStatusHistory(currentDb, target.id, 'In Progress', liveProvider.service_category, liveProvider.id, 'Work started on site.');
      pushNotification(currentDb, 'user', target.user_id, 'in_progress', 'Work In Progress', `${liveProvider.full_name} has started work on ${target.booking_code}.`, target.id);
    }
    target.updated_at = new Date().toISOString();
    saveDB(currentDb);
    triggerRefresh();
  };

  const handleCompletionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const converted = await Promise.all(
      files.map(async (f) => ({
        file_data_url: await fileToDataUrl(f),
        original_name: f.name,
      }))
    );
    setCompletionPhotos((prev) => [...prev, ...converted]);
  };

  const handleSubmitCompletion = (booking: BookingRecord) => {
    if (!liveProvider) return;
    setActionError(null);
    if (completionPhotos.length === 0 || !completionDesc.trim()) {
      setActionError('Upload at least one completion photo and provide a work completion description.');
      return;
    }
    const currentDb = loadDB();
    const target = currentDb.bookings.find((b) => b.id === booking.id);
    if (!target) return;

    completionPhotos.forEach((p) => {
      const nextPhotoId = currentDb.work_completion_photos.length === 0 ? 1 : Math.max(...currentDb.work_completion_photos.map((x) => x.id)) + 1;
      currentDb.work_completion_photos.push({
        id: nextPhotoId,
        booking_id: target.id,
        provider_type: liveProvider.service_category,
        provider_id: liveProvider.id,
        file_data_url: p.file_data_url,
        original_name: p.original_name,
        uploaded_at: new Date().toISOString(),
      });
    });

    target.completion_description = completionDesc.trim();
    target.status = 'Customer Review Pending';
    target.updated_at = new Date().toISOString();

    addStatusHistory(currentDb, target.id, 'Work Completed', liveProvider.service_category, liveProvider.id, completionDesc.trim());
    addStatusHistory(currentDb, target.id, 'Customer Review Pending', 'system', null, 'Awaiting customer confirmation and review.');

    pushNotification(currentDb, 'user', target.user_id, 'work_completed', 'Work Completed — Review Required', `Inspect completion photos for ${target.booking_code} and submit your review.`, target.id);
    pushNotification(currentDb, 'admin', null, 'work_completed', 'Work Completion Submitted', `${liveProvider.full_name} completed ${target.booking_code}.`, target.id);

    saveDB(currentDb);
    setCompletionDesc('');
    setCompletionPhotos([]);
    triggerRefresh();
  };

  // PROVIDER AUTH VIEW
  if (!liveProvider) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <span className="text-lg font-bold text-slate-900">Volt & Valve · Technician Portal</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setAuthError(null); setAuthMode('login'); }}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg ${authMode === 'login' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Technician Login
            </button>
            <button
              type="button"
              onClick={() => { setAuthError(null); setAuthMode('register'); }}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg ${authMode === 'register' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Apply as Technician
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          {authMode === 'login' ? (
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Service Provider Login</h1>
                <p className="text-sm text-slate-600 mt-1">Sign in to view assigned jobs, upload completion photos, and track service charges.</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Service Category</label>
                  <select
                    value={loginCategory}
                    onChange={(e) => setLoginCategory(e.target.value as ServiceCategory)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                  >
                    <option value="electrician">Electrician</option>
                    <option value="plumber">Plumber</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    required
                    value={loginMobile}
                    onChange={(e) => setLoginMobile(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                {authError && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{authError}</p>}
                <button type="submit" className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg">
                  Sign In to Provider Panel
                </button>
              </form>
            </div>
          ) : (
            <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl p-8 space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Electrician / Plumber Application</h1>
                <p className="text-sm text-slate-600 mt-1">Upload mandatory verification documents and verify mobile OTP. Admin approval is required before accepting bookings.</p>
              </div>
              <form onSubmit={handleRegister} className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Service Category</label>
                  <select
                    value={regForm.service_category}
                    onChange={(e) => setRegForm({ ...regForm, service_category: e.target.value as ServiceCategory })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  >
                    <option value="electrician">Electrician</option>
                    <option value="plumber">Plumber</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={regForm.full_name}
                    onChange={(e) => setRegForm({ ...regForm, full_name: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Mobile Number</label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      required
                      value={regForm.mobile_number}
                      onChange={(e) => setRegForm({ ...regForm, mobile_number: e.target.value })}
                      className="flex-1 px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                    <button type="button" onClick={handleSendOtp} className="px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg whitespace-nowrap">
                      Send OTP
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">OTP Code</label>
                  <input
                    type="text"
                    required
                    value={regForm.otp_code}
                    onChange={(e) => setRegForm({ ...regForm, otp_code: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg"
                  />
                </div>
                {sentOtp && (
                  <div className="sm:col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
                    Verification OTP: <span className="font-mono-tabular font-bold">{sentOtp}</span>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={regForm.password}
                    onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">PIN Code</label>
                  <input
                    type="text"
                    required
                    value={regForm.pin_code}
                    onChange={(e) => setRegForm({ ...regForm, pin_code: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Complete Address</label>
                  <input
                    type="text"
                    required
                    value={regForm.address}
                    onChange={(e) => setRegForm({ ...regForm, address: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Qualification Details</label>
                  <input
                    type="text"
                    required
                    value={regForm.qualification_details}
                    onChange={(e) => setRegForm({ ...regForm, qualification_details: e.target.value })}
                    placeholder="ITI / Diploma / License"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Experience Details</label>
                  <input
                    type="text"
                    required
                    value={regForm.experience_details}
                    onChange={(e) => setRegForm({ ...regForm, experience_details: e.target.value })}
                    placeholder="e.g. 5 years residential wiring"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                {/* Mandatory Document Uploads */}
                <div className="sm:col-span-2 border-t border-slate-200 pt-3 space-y-3">
                  <p className="text-xs font-bold text-slate-900">Document Uploads</p>
                  <div className="grid sm:grid-cols-3 gap-3 text-xs">
                    <label className="border border-slate-300 rounded-lg p-3 cursor-pointer hover:bg-slate-50">
                      <span className="block font-semibold text-slate-800">Qualification Certificate</span>
                      <span className="text-slate-500 block mt-0.5 truncate">{qualDoc ? qualDoc.original_name : 'Upload (if applicable)'}</span>
                      <input type="file" accept="image/*,.pdf" onChange={(e) => handleDocSelect(e, setQualDoc)} className="hidden" />
                    </label>
                    <label className="border border-slate-300 rounded-lg p-3 cursor-pointer hover:bg-slate-50">
                      <span className="block font-semibold text-slate-800">Experience Certificate *</span>
                      <span className="text-slate-500 block mt-0.5 truncate">{expDoc ? expDoc.original_name : 'Mandatory'}</span>
                      <input type="file" accept="image/*,.pdf" onChange={(e) => handleDocSelect(e, setExpDoc)} className="hidden" />
                    </label>
                    <label className="border border-slate-300 rounded-lg p-3 cursor-pointer hover:bg-slate-50">
                      <span className="block font-semibold text-slate-800">Police Verification *</span>
                      <span className="text-slate-500 block mt-0.5 truncate">{policeDoc ? policeDoc.original_name : 'Mandatory'}</span>
                      <input type="file" accept="image/*,.pdf" onChange={(e) => handleDocSelect(e, setPoliceDoc)} className="hidden" />
                    </label>
                  </div>
                </div>

                {authError && <p className="sm:col-span-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{authError}</p>}

                <div className="sm:col-span-2">
                  <button type="submit" className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg">
                    Verify OTP & Submit Application
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    );
  }

  // APPROVAL GATE (Pending / Rejected / Blocked)
  if (liveProvider.approval_status !== 'approved') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <span className="text-lg font-bold text-slate-900">Volt & Valve · Technician Portal</span>
          <button type="button" onClick={handleLogout} className="text-xs font-semibold text-red-700 hover:underline">
            Sign Out
          </button>
        </header>
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
              <h1 className="text-xl font-bold text-slate-900">
                Application Status: <span className="capitalize">{liveProvider.approval_status}</span>
              </h1>
            </div>
            {liveProvider.approval_status === 'pending' && (
              <p className="text-sm text-slate-600">
                Your OTP is verified and your documents have been queued for Administrator review. You cannot accept customer bookings until your account is approved.
              </p>
            )}
            {liveProvider.approval_status === 'rejected' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 space-y-1">
                <p className="font-semibold">Application Rejected</p>
                <p>Reason: {liveProvider.rejection_reason || 'Document verification failed.'}</p>
              </div>
            )}
            {liveProvider.approval_status === 'blocked' && (
              <p className="text-sm text-red-700">Your service provider account has been blocked by the administrator.</p>
            )}
          </div>
        </main>
      </div>
    );
  }

  // APPROVED PROVIDER DASHBOARD
  const totalCharges = myCharges.reduce((s, c) => s + c.assigned_charge, 0);
  const pendingCharges = myCharges.filter((c) => c.payout_status === 'pending').reduce((s, c) => s + c.assigned_charge, 0);
  const paidCharges = myCharges.filter((c) => c.payout_status === 'paid').reduce((s, c) => s + c.assigned_charge, 0);

  const selectedBooking = assignedBookings.find((b) => b.id === selectedBookingId) || null;

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform lg:static lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <span className="text-lg font-bold text-slate-900">Provider Panel</span>
          <button type="button" onClick={() => setMobileMenuOpen(false)} className="lg:hidden p-1 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-900 truncate">{liveProvider.full_name}</p>
          <p className="text-xs text-slate-500 capitalize">
            {liveProvider.service_category} · Rating: {liveProvider.average_rating || 'New'}
          </p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'overview', label: 'Dashboard Overview', Icon: Briefcase },
            { id: 'bookings', label: `Assigned Bookings (${assignedBookings.length})`, Icon: ClipboardList },
            { id: 'earnings', label: 'Service Charges & Payouts', Icon: CreditCard },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setActiveTab(id as typeof activeTab); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200">
          <button type="button" onClick={handleLogout} className="w-full flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-red-700 hover:bg-red-50 rounded-lg">
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-1.5 border border-slate-200 rounded-lg">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-slate-900">
              {activeTab === 'overview' && 'Provider Dashboard'}
              {activeTab === 'bookings' && 'Assigned Bookings & Work Completion'}
              {activeTab === 'earnings' && 'Assigned Service Charges & Payment History'}
            </h1>
          </div>
          <StatusIndicator status={liveProvider.approval_status} />
        </header>

        <main className="flex-1 p-6 max-w-6xl w-full mx-auto space-y-6">
          {activeTab === 'overview' && (
            <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { label: 'Total Assigned', val: assignedBookings.length },
                { label: 'New Bookings', val: assignedBookings.filter((b) => b.status === 'Waiting for Electrician').length },
                { label: 'Accepted', val: assignedBookings.filter((b) => b.status === 'Accepted').length },
                { label: 'In Progress', val: assignedBookings.filter((b) => b.status === 'In Progress').length },
                { label: 'Completed', val: assignedBookings.filter((b) => ['Work Completed', 'Customer Review Pending', 'Completed and Reviewed'].includes(b.status)).length },
                { label: 'Cancelled', val: assignedBookings.filter((b) => b.status === 'Cancelled').length },
                { label: 'Total Service Charges', val: `₹${totalCharges.toFixed(2)}` },
                { label: 'Payment Pending', val: `₹${pendingCharges.toFixed(2)}` },
                { label: 'Payment Received', val: `₹${paidCharges.toFixed(2)}` },
              ].map((stat) => (
                <div key={stat.label} className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">{stat.label}</p>
                  <p className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">{stat.val}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'bookings' && (
            <div className="grid lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200">
                  <h2 className="text-sm font-bold text-slate-900">Assigned Jobs</h2>
                </div>
                {assignedBookings.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">No bookings assigned to you yet.</div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {assignedBookings.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBookingId(b.id)}
                        className={`p-4 cursor-pointer hover:bg-slate-50 ${selectedBookingId === b.id ? 'bg-blue-50/50' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono-tabular text-sm font-bold text-slate-900">{b.booking_code}</span>
                          <StatusIndicator status={b.status} />
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{b.preferred_date} · {b.preferred_time}</p>
                        <p className="text-xs text-slate-700 mt-1 line-clamp-1">{b.problem_description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-6">
                {selectedBooking ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <span className="font-mono-tabular font-bold text-slate-900">{selectedBooking.booking_code}</span>
                      <StatusIndicator status={selectedBooking.status} />
                    </div>
                    {(() => {
                      const cust = db.users.find((u) => u.id === selectedBooking.user_id);
                      const charge = myCharges.find((c) => c.booking_id === selectedBooking.id);
                      const probs = db.booking_images.filter((i) => i.booking_id === selectedBooking.id);
                      return (
                        <>
                          {cust && (
                            <div className="text-xs space-y-1">
                              <p className="font-semibold text-slate-900">Customer: {cust.full_name} ({cust.mobile_number})</p>
                              <p className="text-slate-600">Address: {selectedBooking.service_address}</p>
                            </div>
                          )}
                          <div className="text-xs">
                            <p className="font-semibold text-slate-900">Problem Description</p>
                            <p className="text-slate-700 mt-1">{selectedBooking.problem_description}</p>
                          </div>
                          {probs.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-slate-900 mb-2">Customer Problem Photos</p>
                              <div className="grid grid-cols-3 gap-2">
                                {probs.map((img) => (
                                  <img key={img.id} src={img.file_data_url} alt={img.original_name} className="w-full aspect-square object-cover rounded-lg border border-slate-200" />
                                ))}
                              </div>
                            </div>
                          )}
                          {charge && (
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs flex items-center justify-between">
                              <span>Admin Assigned Service Charge:</span>
                              <span className="font-mono-tabular font-bold text-slate-900">₹{charge.assigned_charge.toFixed(2)} ({charge.payout_status})</span>
                            </div>
                          )}

                          {/* Action Buttons */}
                          {selectedBooking.status === 'Waiting for Electrician' && (
                            <div className="flex gap-3 pt-2">
                              <button
                                type="button"
                                onClick={() => handleBookingAction(selectedBooking, 'accept')}
                                className="flex-1 py-2 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg"
                              >
                                Accept Booking
                              </button>
                              <button
                                type="button"
                                onClick={() => handleBookingAction(selectedBooking, 'reject')}
                                className="py-2 px-4 border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-lg"
                              >
                                Reject
                              </button>
                            </div>
                          )}

                          {selectedBooking.status === 'Accepted' && (
                            <button
                              type="button"
                              onClick={() => handleBookingAction(selectedBooking, 'in_progress')}
                              className="w-full py-2 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg"
                            >
                              Mark Work as In Progress
                            </button>
                          )}

                          {selectedBooking.status === 'In Progress' && (
                            <div className="space-y-3 border-t border-slate-200 pt-3">
                              <p className="text-xs font-bold text-slate-900">Submit Work Completion</p>
                              <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold rounded-lg cursor-pointer">
                                <Upload className="w-4 h-4" />
                                <span>Upload Completion Photos ({completionPhotos.length})</span>
                                <input type="file" accept="image/*" multiple onChange={handleCompletionUpload} className="hidden" />
                              </label>
                              <textarea
                                rows={3}
                                value={completionDesc}
                                onChange={(e) => setCompletionDesc(e.target.value)}
                                placeholder="Describe work completed, parts replaced, and testing done..."
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                              />
                              {actionError && <p className="text-xs text-red-700">{actionError}</p>}
                              <button
                                type="button"
                                onClick={() => handleSubmitCompletion(selectedBooking)}
                                className="w-full py-2 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Submit Completion & Mark Completed</span>
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
                    Select an assigned booking to view customer details and update work progress.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'earnings' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200">
                  <h2 className="text-sm font-bold text-slate-900">Assigned Service Charges</h2>
                </div>
                {myCharges.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">No service charges assigned by Admin yet.</div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                        <th className="py-3 px-4">Booking ID</th>
                        <th className="py-3 px-4 text-right">Assigned Charge</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {myCharges.map((c) => {
                        const b = db.bookings.find((bk) => bk.id === c.booking_id);
                        return (
                          <tr key={c.id}>
                            <td className="py-3 px-4 font-mono-tabular font-semibold">{b?.booking_code || `#${c.booking_id}`}</td>
                            <td className="py-3 px-4 text-right font-mono-tabular font-bold">₹{c.assigned_charge.toFixed(2)}</td>
                            <td className="py-3 px-4"><StatusIndicator status={c.payout_status} /></td>
                            <td className="py-3 px-4 text-slate-600">{c.notes || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200">
                  <h2 className="text-sm font-bold text-slate-900">Payment History</h2>
                </div>
                {myPayouts.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">No payouts recorded yet.</div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">UTR / Reference</th>
                        <th className="py-3 px-4">Mode</th>
                        <th className="py-3 px-4 text-right">Amount Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {myPayouts.map((p) => (
                        <tr key={p.id}>
                          <td className="py-3 px-4 font-mono-tabular">{p.payment_date}</td>
                          <td className="py-3 px-4 font-mono-tabular font-semibold">{p.utr_reference}</td>
                          <td className="py-3 px-4">{p.payment_mode}</td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-bold text-emerald-700">₹{p.paid_amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
