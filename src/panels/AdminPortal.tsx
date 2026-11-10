import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Wrench,
  ClipboardList,
  CreditCard,
  Wallet,
  Bell,
  LogOut,
  Search,
  Menu,
  X,
  Plus,
  Shield,
  Tag,
  Star,
  Layers,
  Settings,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  addStatusHistory,
  createBooking,
  fileToDataUrl,
  loadDB,
  loginAdmin,
  pushNotification,
  refundPayment,
  saveDB,
} from '../services/backend';
import { phpApiGet, phpApiPost } from '../services/phpApi';
import { AdminUser, BookingStatus, CustomerReview, GiftVoucher, PaymentRecord, ProviderAccount, ServiceCategory, ServiceItem } from '../types';
import { StatusIndicator } from '../components/StatusIndicator';
import { RazorpayModal } from '../components/RazorpayModal';

type AdminTab = 'overview' | 'users' | 'providers' | 'services' | 'vouchers' | 'bookings' | 'payments' | 'payouts' | 'reviews' | 'notifications' | 'settings';

export const AdminPortal: React.FC = () => {
  const [admin, setAdmin] = useState<AdminUser | null>(() => {
    const saved = sessionStorage.getItem('vv_admin_session');
    return saved ? (JSON.parse(saved) as AdminUser) : null;
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  // Search & selection states
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedProviderKey, setSelectedProviderKey] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'success' | 'failed' | 'pending' | 'refunded' | 'created'>('all');
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundMsg, setRefundMsg] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<CustomerReview | null>(null);

  // Service Management state
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
  const [serviceForm, setServiceForm] = useState({
    category_id: '1',
    service_name: '',
    description: '',
    image_data_url: '',
    price: '299',
    pricing_type: 'fixed' as 'fixed' | 'starting_at' | 'hourly' | 'custom_quote' | 'inspection',
    is_available: true,
    is_active: true,
    display_order: '0',
  });
  const [serviceMsg, setServiceMsg] = useState<string | null>(null);

  // Gift Voucher Management state
  const [editingVoucherId, setEditingVoucherId] = useState<number | null>(null);
  const [voucherForm, setVoucherForm] = useState({
    voucher_name: '',
    voucher_code: '',
    description: '',
    discount_type: 'fixed' as 'fixed' | 'percentage',
    discount_value: '50',
    min_booking_amount: '200',
    max_discount_amount: '',
    start_date: new Date().toISOString().slice(0, 10),
    expiry_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    total_usage_limit: '100',
    per_user_limit: '1',
    applicable_scope: 'all_services' as 'all_services' | 'specific_services',
    applicable_service_ids: [] as number[],
    target_audience: 'all_users' as 'all_users' | 'specific_users',
    assigned_user_ids: [] as number[],
    is_active: true,
  });
  const [voucherMsg, setVoucherMsg] = useState<string | null>(null);

  // Manual phone booking state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    user_id: '',
    service_category: 'electrician' as ServiceCategory,
    problem_description: '',
    service_address: '',
    preferred_date: new Date().toISOString().slice(0, 10),
    preferred_time: '10:00 AM - 12:00 PM',
    booking_amount: '299',
  });
  const [manualPhotos, setManualPhotos] = useState<{ file_data_url: string; original_name: string }[]>([]);
  const [rzpCheckout, setRzpCheckout] = useState<{
    bookingId: number;
    bookingCode: string;
    orderId: string;
    amount: number;
    customerName: string;
    customerMobile: string;
  } | null>(null);

  // Service charge & payout state
  const [chargeInputs, setChargeInputs] = useState<Record<number, string>>({});
  const [payoutModalChargeId, setPayoutModalChargeId] = useState<number | null>(null);
  const [payoutForm, setPayoutForm] = useState({
    utr_reference: '',
    payment_mode: 'UPI / IMPS',
    payment_date: new Date().toISOString().slice(0, 10),
    remarks: '',
  });

  const db = useMemo(() => loadDB(), [refreshTick, admin, activeTab]);
  const triggerRefresh = () => setRefreshTick((t) => t + 1);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const res = loginAdmin(email, password);
    if (res.error) {
      setAuthError(res.error);
      return;
    }
    if (res.admin) {
      sessionStorage.setItem('vv_admin_session', JSON.stringify(res.admin));
      setAdmin(res.admin);
    }
  };

  // Razorpay Test Mode Settings state (Secret key is NEVER persisted in frontend JS/localStorage)
  const [rzpTestKeyId, setRzpTestKeyId] = useState(() =>
    typeof window !== 'undefined' ? window.localStorage.getItem('vv_razorpay_test_key_id') || '' : ''
  );
  const [rzpTestKeySecret, setRzpTestKeySecret] = useState('');
  const [rzpMaskedSecret, setRzpMaskedSecret] = useState('');
  const [rzpIsConfigured, setRzpIsConfigured] = useState(false);
  const [rzpSettingsLoading, setRzpSettingsLoading] = useState(false);
  const [rzpTestingConn, setRzpTestingConn] = useState(false);
  const [rzpSettingsFeedback, setRzpSettingsFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [rzpLastTestInfo, setRzpLastTestInfo] = useState<{ status: string | null; message: string | null; at: string | null }>({
    status: null,
    message: null,
    at: null,
  });

  useEffect(() => {
    if (!admin || activeTab !== 'settings') return;
    let cancelled = false;
    setRzpSettingsLoading(true);
    phpApiGet<{
      test_key_id: string;
      has_secret: boolean;
      masked_secret: string;
      is_configured: boolean;
      last_tested_at: string | null;
      last_test_status: string | null;
      last_test_message: string | null;
    }>('admin', 'get_razorpay_test_settings')
      .then((res) => {
        if (cancelled) return;
        if (res.test_key_id) {
          setRzpTestKeyId(res.test_key_id);
          window.localStorage.setItem('vv_razorpay_test_key_id', res.test_key_id);
        }
        setRzpMaskedSecret(res.masked_secret || '');
        setRzpIsConfigured(Boolean(res.is_configured));
        setRzpLastTestInfo({
          status: res.last_test_status,
          message: res.last_test_message,
          at: res.last_tested_at,
        });
      })
      .catch(() => {
        // Static Vite preview without PHP server: keep public Key ID if saved
      })
      .finally(() => {
        if (!cancelled) setRzpSettingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [admin, activeTab]);

  const handleSaveRazorpayTestKeys = async (isUpdate: boolean) => {
    setRzpSettingsFeedback(null);
    const trimmedKeyId = rzpTestKeyId.trim();
    const trimmedSecret = rzpTestKeySecret.trim();

    if (!trimmedKeyId.startsWith('rzp_test_')) {
      setRzpSettingsFeedback({ type: 'error', text: 'Razorpay Test Key ID must start with rzp_test_.' });
      return;
    }
    if (!isUpdate && trimmedSecret === '') {
      setRzpSettingsFeedback({ type: 'error', text: 'Razorpay Test Key Secret is required.' });
      return;
    }
    if (isUpdate && !rzpIsConfigured && trimmedSecret === '') {
      setRzpSettingsFeedback({ type: 'error', text: 'Please enter your Razorpay Test Key Secret.' });
      return;
    }

    setRzpSettingsLoading(true);
    try {
      const res = await phpApiPost<{
        success: boolean;
        test_key_id: string;
        masked_secret: string;
        is_configured: boolean;
        message?: string;
      }>('admin', 'save_razorpay_test_settings', {
        test_key_id: trimmedKeyId,
        test_key_secret: trimmedSecret,
      });
      // Only store public Key ID in localStorage for Checkout; NEVER store secret
      window.localStorage.setItem('vv_razorpay_test_key_id', res.test_key_id);
      setRzpTestKeySecret('');
      setRzpMaskedSecret(res.masked_secret);
      setRzpIsConfigured(true);
      setRzpSettingsFeedback({
        type: 'success',
        text: res.message || 'Razorpay Test Mode keys saved securely on the server.',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Server request failed.';
      // If PHP backend is not running (e.g. static preview), save ONLY public Key ID and inform Admin honestly
      if (msg.toLowerCase().includes('unexpected token') || msg.toLowerCase().includes('failed to fetch')) {
        window.localStorage.setItem('vv_razorpay_test_key_id', trimmedKeyId);
        setRzpTestKeySecret('');
        setRzpSettingsFeedback({
          type: 'error',
          text: 'Public Test Key ID saved for Checkout preview, but PHP backend is not active here. Deploy to InfinityFree PHP+MySQL so the Test Key Secret is encrypted and stored in MySQL.',
        });
      } else {
        setRzpSettingsFeedback({ type: 'error', text: msg });
      }
    } finally {
      setRzpSettingsLoading(false);
    }
  };

  const handleTestRazorpayConnection = async () => {
    setRzpSettingsFeedback(null);
    setRzpTestingConn(true);
    try {
      const res = await phpApiPost<{ connected: boolean; message: string; http_code?: number }>(
        'admin',
        'test_razorpay_connection',
        {
          test_key_id: rzpTestKeyId.trim(),
          test_key_secret: rzpTestKeySecret.trim(),
        }
      );
      setRzpLastTestInfo({
        status: res.connected ? 'connected' : 'failed',
        message: res.message,
        at: new Date().toISOString(),
      });
      setRzpSettingsFeedback({
        type: res.connected ? 'success' : 'error',
        text: res.message,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reach PHP backend.';
      const friendly =
        msg.toLowerCase().includes('unexpected token') || msg.toLowerCase().includes('failed to fetch')
          ? 'Test Connection requires the PHP backend running with cURL access to api.razorpay.com (InfinityFree server).'
          : msg;
      setRzpSettingsFeedback({ type: 'error', text: friendly });
    } finally {
      setRzpTestingConn(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('vv_admin_session');
    setAdmin(null);
  };

  // Financial Calculations (strictly separating Customer Collections from Platform Earnings)
  const financials = useMemo(() => {
    const successfulPayments = db.payments.filter((p) => p.payment_status === 'success');
    const failedPayments = db.payments.filter((p) => p.payment_status === 'failed');
    const pendingPayments = db.payments.filter((p) => p.payment_status === 'pending' || p.payment_status === 'created');
    const refundedPayments = db.payments.filter((p) => p.payment_status === 'refunded');

    const totalCustomerCollections = successfulPayments.reduce((s, p) => s + p.amount, 0);
    const totalFailedAmount = failedPayments.reduce((s, p) => s + p.amount, 0);
    const totalPendingAmount = pendingPayments.reduce((s, p) => s + p.amount, 0);
    const totalRefundedAmount = refundedPayments.reduce((s, p) => s + (p.refunded_amount ?? p.amount), 0);
    const totalAssignedCharges = db.electrician_service_charges.reduce((s, c) => s + c.assigned_charge, 0);
    const paidElectricianCharges = db.electrician_service_charges
      .filter((c) => c.payout_status === 'paid')
      .reduce((s, c) => s + c.assigned_charge, 0);
    const pendingElectricianLiability = totalAssignedCharges - paidElectricianCharges;
    const platformEarnings = totalCustomerCollections - totalAssignedCharges;

    return {
      totalCustomerCollections,
      totalFailedAmount,
      totalPendingAmount,
      totalRefundedAmount,
      successfulCount: successfulPayments.length,
      failedCount: failedPayments.length,
      pendingCount: pendingPayments.length,
      refundedCount: refundedPayments.length,
      totalAssignedCharges,
      paidElectricianCharges,
      pendingElectricianLiability,
      platformEarnings,
    };
  }, [db]);

  const allProviders = useMemo(() => {
    return [...db.electricians, ...db.plumbers];
  }, [db]);

  if (!admin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-xl p-8 space-y-6 shadow-xl">
          <div className="flex items-center gap-2.5 text-slate-900">
            <Shield className="w-6 h-6 text-blue-700" />
            <div>
              <h1 className="text-xl font-bold">Volt & Valve Admin Portal</h1>
              <p className="text-xs text-slate-500">Restricted Administrative Access</p>
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Administrator Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@voltvalve.in"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>
            {authError && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{authError}</p>}
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Authenticate & Enter Admin Panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Admin Operations
  const toggleUserStatus = (userId: number) => {
    const currentDb = loadDB();
    const u = currentDb.users.find((x) => x.id === userId);
    if (u) {
      u.status = u.status === 'active' ? 'blocked' : 'active';
      saveDB(currentDb);
      triggerRefresh();
    }
  };

  const updateProviderApproval = (
    provider: ProviderAccount,
    status: 'approved' | 'rejected' | 'blocked',
    reason: string | null = null
  ) => {
    const currentDb = loadDB();
    const list = provider.service_category === 'electrician' ? currentDb.electricians : currentDb.plumbers;
    const p = list.find((x) => x.id === provider.id);
    if (p) {
      p.approval_status = status;
      p.rejection_reason = status === 'rejected' ? reason || 'Application did not meet verification requirements.' : null;
      pushNotification(
        currentDb,
        provider.service_category,
        provider.id,
        'approval_updated',
        `Application ${status}`,
        p.rejection_reason || `Your account status is now ${status}.`
      );
      saveDB(currentDb);
      setRejectReason('');
      triggerRefresh();
    }
  };

  const verifyDocument = (docId: number, status: 'verified' | 'rejected') => {
    const currentDb = loadDB();
    const d = currentDb.provider_documents.find((x) => x.id === docId);
    if (d) {
      d.verification_status = status;
      d.verified_at = new Date().toISOString();
      saveDB(currentDb);
      triggerRefresh();
    }
  };

  const assignProviderToBooking = (bookingId: number, providerValue: string) => {
    if (!providerValue) return;
    const [pType, pIdStr] = providerValue.split(':');
    const pId = Number(pIdStr);
    const currentDb = loadDB();
    const b = currentDb.bookings.find((x) => x.id === bookingId);
    if (!b) return;
    b.assigned_provider_type = pType as ServiceCategory;
    b.assigned_provider_id = pId;
    b.status = 'Waiting for Electrician';
    b.updated_at = new Date().toISOString();
    addStatusHistory(currentDb, b.id, 'Waiting for Electrician', 'admin', admin.id, `Assigned to ${pType} #${pId}.`);
    pushNotification(currentDb, pType as ServiceCategory, pId, 'booking_assigned', 'New Job Assigned', `Booking ${b.booking_code} assigned to you.`, b.id);
    saveDB(currentDb);
    triggerRefresh();
  };

  const updateBookingStatusAdmin = (bookingId: number, status: BookingStatus) => {
    const currentDb = loadDB();
    const b = currentDb.bookings.find((x) => x.id === bookingId);
    if (!b) return;
    b.status = status;
    b.updated_at = new Date().toISOString();
    addStatusHistory(currentDb, b.id, status, 'admin', admin.id, `Status updated by Admin to ${status}.`);
    if (status === 'Cancelled') {
      pushNotification(currentDb, 'admin', null, 'booking_cancelled', 'Booking Cancelled', `${b.booking_code} was cancelled.`, b.id);
    }
    saveDB(currentDb);
    triggerRefresh();
  };

  const handleAssignServiceCharge = (bookingId: number, providerType: ServiceCategory, providerId: number) => {
    const raw = chargeInputs[bookingId];
    const amount = Number(raw);
    if (!amount || amount <= 0) return;
    const currentDb = loadDB();
    const existing = currentDb.electrician_service_charges.find((c) => c.booking_id === bookingId);
    if (existing) {
      if (existing.payout_status === 'paid') return;
      existing.assigned_charge = amount;
      existing.updated_at = new Date().toISOString();
    } else {
      const nextChargeId =
        currentDb.electrician_service_charges.length === 0
          ? 1
          : Math.max(...currentDb.electrician_service_charges.map((c) => c.id)) + 1;
      currentDb.electrician_service_charges.push({
        id: nextChargeId,
        booking_id: bookingId,
        provider_type: providerType,
        provider_id: providerId,
        assigned_charge: amount,
        payout_status: 'pending',
        notes: 'Assigned by Admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      pushNotification(currentDb, 'admin', null, 'pending_payout', 'Pending Electrician Payment', `Service charge ₹${amount} pending payout for booking #${bookingId}.`, bookingId);
    }
    saveDB(currentDb);
    triggerRefresh();
  };

  const handleRecordManualPayout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutModalChargeId || !payoutForm.utr_reference.trim()) return;
    const currentDb = loadDB();
    const charge = currentDb.electrician_service_charges.find((c) => c.id === payoutModalChargeId);
    if (!charge) return;

    const nextPayId =
      currentDb.electrician_payouts.length === 0 ? 1 : Math.max(...currentDb.electrician_payouts.map((p) => p.id)) + 1;
    currentDb.electrician_payouts.unshift({
      id: nextPayId,
      service_charge_id: charge.id,
      booking_id: charge.booking_id,
      provider_type: charge.provider_type,
      provider_id: charge.provider_id,
      paid_amount: charge.assigned_charge,
      utr_reference: payoutForm.utr_reference.trim(),
      payment_mode: payoutForm.payment_mode,
      payment_date: payoutForm.payment_date,
      remarks: payoutForm.remarks.trim(),
      created_at: new Date().toISOString(),
    });
    charge.payout_status = 'paid';
    charge.updated_at = new Date().toISOString();

    pushNotification(
      currentDb,
      charge.provider_type,
      charge.provider_id,
      'payout_received',
      'Service Charge Paid',
      `₹${charge.assigned_charge} paid via ${payoutForm.payment_mode} (UTR: ${payoutForm.utr_reference}).`,
      charge.booking_id
    );
    saveDB(currentDb);
    setPayoutModalChargeId(null);
    setPayoutForm({ utr_reference: '', payment_mode: 'UPI / IMPS', payment_date: new Date().toISOString().slice(0, 10), remarks: '' });
    triggerRefresh();
  };

  const handleManualPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const converted = await Promise.all(
      files.map(async (f) => ({
        file_data_url: await fileToDataUrl(f),
        original_name: f.name,
      }))
    );
    setManualPhotos((prev) => [...prev, ...converted]);
  };

  const handleCreateManualBooking = (e: React.FormEvent) => {
    e.preventDefault();
    const cust = db.users.find((u) => u.id === Number(manualForm.user_id));
    if (!cust) return;
    const { booking, razorpay_order_id } = createBooking({
      user_id: cust.id,
      service_category: manualForm.service_category,
      booking_method: 'phone_manual',
      problem_description: manualForm.problem_description,
      service_address: manualForm.service_address || `${cust.address}, ${cust.village_city}`,
      preferred_date: manualForm.preferred_date,
      preferred_time: manualForm.preferred_time,
      booking_amount: Number(manualForm.booking_amount) || 299,
      photos: manualPhotos,
      actor_role: 'admin',
      actor_id: admin.id,
    });
    setShowManualModal(false);
    setManualPhotos([]);
    setRzpCheckout({
      bookingId: booking.id,
      bookingCode: booking.booking_code,
      orderId: razorpay_order_id,
      amount: booking.booking_amount,
      customerName: cust.full_name,
      customerMobile: cust.mobile_number,
    });
  };

  // Service & Category Management Handlers
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const currentDb = loadDB();
    const id = currentDb.service_categories.length === 0 ? 1 : Math.max(...currentDb.service_categories.map((c) => c.id)) + 1;
    currentDb.service_categories.push({
      id,
      slug: newCategoryName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      name: newCategoryName.trim(),
      is_active: true,
      display_order: currentDb.service_categories.length + 1,
      created_at: new Date().toISOString(),
    });
    saveDB(currentDb);
    setNewCategoryName('');
    triggerRefresh();
  };

  const handleServiceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setServiceForm((prev) => ({ ...prev, image_data_url: dataUrl }));
  };

  const handleSaveService = (e: React.FormEvent) => {
    e.preventDefault();
    setServiceMsg(null);
    if (!serviceForm.service_name.trim()) return;
    const currentDb = loadDB();
    if (editingServiceId) {
      const target = currentDb.services.find((s) => s.id === editingServiceId);
      if (target) {
        target.category_id = Number(serviceForm.category_id);
        target.service_name = serviceForm.service_name.trim();
        target.description = serviceForm.description.trim();
        if (serviceForm.image_data_url) target.image_data_url = serviceForm.image_data_url;
        target.price = Number(serviceForm.price) || 299;
        target.pricing_type = serviceForm.pricing_type;
        target.is_available = serviceForm.is_available;
        target.is_active = serviceForm.is_active;
        target.display_order = Number(serviceForm.display_order) || 0;
      }
      setServiceMsg('Service updated.');
    } else {
      const id = currentDb.services.length === 0 ? 1 : Math.max(...currentDb.services.map((s) => s.id)) + 1;
      currentDb.services.push({
        id,
        category_id: Number(serviceForm.category_id),
        service_name: serviceForm.service_name.trim(),
        description: serviceForm.description.trim(),
        image_data_url: serviceForm.image_data_url,
        price: Number(serviceForm.price) || 299,
        pricing_type: serviceForm.pricing_type,
        is_available: serviceForm.is_available,
        is_active: serviceForm.is_active,
        display_order: Number(serviceForm.display_order) || 0,
        created_at: new Date().toISOString(),
      });
      setServiceMsg('Service added.');
    }
    saveDB(currentDb);
    setEditingServiceId(null);
    setServiceForm({
      category_id: String(currentDb.service_categories[0]?.id || 1),
      service_name: '',
      description: '',
      image_data_url: '',
      price: '299',
      pricing_type: 'fixed',
      is_available: true,
      is_active: true,
      display_order: '0',
    });
    triggerRefresh();
  };

  const handleToggleService = (svc: ServiceItem) => {
    const currentDb = loadDB();
    const t = currentDb.services.find((s) => s.id === svc.id);
    if (t) {
      t.is_active = !t.is_active;
      saveDB(currentDb);
      triggerRefresh();
    }
  };

  const handleDeleteService = (svcId: number) => {
    setServiceMsg(null);
    const currentDb = loadDB();
    const hasBookings = currentDb.bookings.some((b) => b.service_id === svcId);
    if (hasBookings) {
      setServiceMsg('Cannot delete service with historical bookings. Disable it instead.');
      return;
    }
    currentDb.services = currentDb.services.filter((s) => s.id !== svcId);
    saveDB(currentDb);
    setServiceMsg('Service deleted.');
    triggerRefresh();
  };

  // Gift Voucher Management Handlers
  const generateUniqueVoucherCode = () => {
    const code = 'VV-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    setVoucherForm((prev) => ({ ...prev, voucher_code: code }));
  };

  const handleSaveVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    setVoucherMsg(null);
    const code = voucherForm.voucher_code.trim().toUpperCase();
    if (!code || !voucherForm.voucher_name.trim()) return;
    const currentDb = loadDB();

    let voucherId = editingVoucherId;
    if (editingVoucherId) {
      const target = currentDb.gift_vouchers.find((v) => v.id === editingVoucherId);
      if (target) {
        target.voucher_name = voucherForm.voucher_name.trim();
        target.voucher_code = code;
        target.description = voucherForm.description.trim();
        target.discount_type = voucherForm.discount_type;
        target.discount_value = Number(voucherForm.discount_value) || 0;
        target.min_booking_amount = Number(voucherForm.min_booking_amount) || 0;
        target.max_discount_amount = voucherForm.max_discount_amount ? Number(voucherForm.max_discount_amount) : null;
        target.start_date = voucherForm.start_date;
        target.expiry_date = voucherForm.expiry_date;
        target.total_usage_limit = Math.max(1, Number(voucherForm.total_usage_limit) || 100);
        target.per_user_limit = Math.max(1, Number(voucherForm.per_user_limit) || 1);
        target.applicable_scope = voucherForm.applicable_scope;
        target.applicable_service_ids = voucherForm.applicable_service_ids;
        target.target_audience = voucherForm.target_audience;
        target.is_active = voucherForm.is_active;
      }
      setVoucherMsg('Voucher updated.');
    } else {
      if (currentDb.gift_vouchers.some((v) => v.voucher_code.toUpperCase() === code)) {
        setVoucherMsg('Voucher code already exists.');
        return;
      }
      voucherId = currentDb.gift_vouchers.length === 0 ? 1 : Math.max(...currentDb.gift_vouchers.map((v) => v.id)) + 1;
      currentDb.gift_vouchers.unshift({
        id: voucherId,
        voucher_name: voucherForm.voucher_name.trim(),
        voucher_code: code,
        description: voucherForm.description.trim(),
        discount_type: voucherForm.discount_type,
        discount_value: Number(voucherForm.discount_value) || 0,
        min_booking_amount: Number(voucherForm.min_booking_amount) || 0,
        max_discount_amount: voucherForm.max_discount_amount ? Number(voucherForm.max_discount_amount) : null,
        start_date: voucherForm.start_date,
        expiry_date: voucherForm.expiry_date,
        total_usage_limit: Math.max(1, Number(voucherForm.total_usage_limit) || 100),
        per_user_limit: Math.max(1, Number(voucherForm.per_user_limit) || 1),
        applicable_scope: voucherForm.applicable_scope,
        applicable_service_ids: voucherForm.applicable_service_ids,
        target_audience: voucherForm.target_audience,
        is_active: voucherForm.is_active,
        created_at: new Date().toISOString(),
      });
      setVoucherMsg('Gift voucher created.');
    }

    if (voucherId) {
      currentDb.voucher_assignments = currentDb.voucher_assignments.filter((a) => a.voucher_id !== voucherId);
      if (voucherForm.target_audience === 'specific_users') {
        voucherForm.assigned_user_ids.forEach((uid) => {
          const aid = currentDb.voucher_assignments.length === 0 ? 1 : Math.max(...currentDb.voucher_assignments.map((a) => a.id)) + 1;
          currentDb.voucher_assignments.push({
            id: aid,
            voucher_id: voucherId!,
            user_id: uid,
            assigned_at: new Date().toISOString(),
          });
        });
      }
    }

    saveDB(currentDb);
    setEditingVoucherId(null);
    triggerRefresh();
  };

  const handleToggleVoucher = (v: GiftVoucher) => {
    const currentDb = loadDB();
    const t = currentDb.gift_vouchers.find((x) => x.id === v.id);
    if (t) {
      t.is_active = !t.is_active;
      saveDB(currentDb);
      triggerRefresh();
    }
  };

  const handleDeleteVoucher = (voucherId: number) => {
    setVoucherMsg(null);
    const currentDb = loadDB();
    if (currentDb.voucher_redemptions.some((r) => r.voucher_id === voucherId)) {
      setVoucherMsg('Cannot delete a voucher that has been redeemed. Deactivate it instead.');
      return;
    }
    currentDb.gift_vouchers = currentDb.gift_vouchers.filter((v) => v.id !== voucherId);
    currentDb.voucher_assignments = currentDb.voucher_assignments.filter((a) => a.voucher_id !== voucherId);
    saveDB(currentDb);
    setVoucherMsg('Unused voucher deleted.');
    triggerRefresh();
  };

  const handleToggleReviewVisibility = (reviewId: number, currentVisible: boolean) => {
    if (!admin) return;
    const currentDb = loadDB();
    const r = currentDb.customer_reviews.find((x) => x.id === reviewId);
    if (!r) return;
    const nextVisible = !currentVisible;
    r.is_visible = nextVisible;
    const logId = currentDb.review_visibility_logs.length === 0 ? 1 : Math.max(...currentDb.review_visibility_logs.map((l) => l.id)) + 1;
    currentDb.review_visibility_logs.unshift({
      id: logId,
      review_id: reviewId,
      admin_id: admin.id,
      action: nextVisible ? 'unhidden' : 'hidden',
      reason: nextVisible ? 'Restored by Admin' : 'Hidden by Admin',
      created_at: new Date().toISOString(),
    });
    saveDB(currentDb);
    triggerRefresh();
  };

  const filteredUsers = db.users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.mobile_number.includes(userSearch)
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-100 flex flex-col transition-transform lg:static lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <span className="text-lg font-bold text-white">Volt & Valve Admin</span>
          <button type="button" onClick={() => setMobileMenuOpen(false)} className="lg:hidden p-1 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'overview', label: 'Dashboard Overview', Icon: LayoutDashboard },
            { id: 'users', label: 'User Management', Icon: Users },
            { id: 'providers', label: 'Providers & Approvals', Icon: Wrench },
            { id: 'services', label: 'Service Management', Icon: Layers },
            { id: 'vouchers', label: 'Gift Vouchers', Icon: Tag },
            { id: 'bookings', label: 'Bookings & Manual Entry', Icon: ClipboardList },
            { id: 'payments', label: 'Customer Payments', Icon: CreditCard },
            { id: 'payouts', label: 'Provider Payouts (Manual)', Icon: Wallet },
            { id: 'reviews', label: 'Customer Reviews', Icon: Star },
            { id: 'notifications', label: `Notifications (${db.notifications.filter((n) => n.recipient_role === 'admin' && !n.is_read).length})`, Icon: Bell },
            { id: 'settings', label: 'Settings', Icon: Settings },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setActiveTab(id as AdminTab); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === id ? 'bg-blue-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button type="button" onClick={handleLogout} className="w-full flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-red-400 hover:bg-slate-800 rounded-lg">
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-1.5 border border-slate-200 rounded-lg">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-slate-900 capitalize">{activeTab.replace('_', ' ')}</h1>
          </div>
          <span className="text-xs text-slate-500">{admin.email}</span>
        </header>

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { label: 'Total Users', val: db.users.length },
                { label: 'Total Electricians', val: db.electricians.length },
                { label: 'Total Plumbers', val: db.plumbers.length },
                { label: 'Pending Applications', val: allProviders.filter((p) => p.approval_status === 'pending').length },
                { label: 'Approved Providers', val: allProviders.filter((p) => p.approval_status === 'approved').length },
                { label: 'Rejected Applications', val: allProviders.filter((p) => p.approval_status === 'rejected').length },
                { label: 'Total Bookings', val: db.bookings.length },
                { label: 'Pending Bookings', val: db.bookings.filter((b) => ['Payment Pending', 'Booking Confirmed', 'Waiting for Electrician', 'Accepted', 'In Progress'].includes(b.status)).length },
                { label: 'Completed Bookings', val: db.bookings.filter((b) => ['Work Completed', 'Customer Review Pending', 'Completed and Reviewed'].includes(b.status)).length },
                { label: 'Cancelled Bookings', val: db.bookings.filter((b) => b.status === 'Cancelled').length },
                { label: 'Total Customer Payments', val: `₹${financials.totalCustomerCollections.toFixed(2)}` },
                { label: 'Total Provider Charges', val: `₹${financials.totalAssignedCharges.toFixed(2)}` },
                { label: 'Total Platform Earnings', val: `₹${financials.platformEarnings.toFixed(2)}` },
                { label: 'Pending Provider Payouts', val: `₹${financials.pendingElectricianLiability.toFixed(2)}` },
                { label: 'Paid Provider Payouts', val: `₹${financials.paidElectricianCharges.toFixed(2)}` },
              ].map((m) => (
                <div key={m.label} className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">{m.label}</p>
                  <p className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">{m.val}</p>
                </div>
              ))}
            </div>
          )}

          {/* USER MANAGEMENT TAB */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2.5 max-w-md">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users by name or mobile number..."
                  className="flex-1 text-sm focus:outline-none"
                />
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                      <th className="py-3 px-4">Full Name</th>
                      <th className="py-3 px-4">Mobile</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500">No registered users found.</td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-semibold text-slate-900">{u.full_name}</td>
                          <td className="py-3 px-4 font-mono-tabular">{u.mobile_number}</td>
                          <td className="py-3 px-4 text-slate-600">{u.village_city}, {u.district} - {u.pin_code}</td>
                          <td className="py-3 px-4"><StatusIndicator status={u.status} /></td>
                          <td className="py-3 px-4 flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setSelectedUserId(selectedUserId === u.id ? null : u.id)}
                              className="text-blue-700 font-semibold hover:underline"
                            >
                              History
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleUserStatus(u.id)}
                              className={`font-semibold hover:underline ${u.status === 'active' ? 'text-red-700' : 'text-emerald-700'}`}
                            >
                              {u.status === 'active' ? 'Block' : 'Unblock'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {selectedUserId && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-slate-900">User Booking & Payment History</h3>
                  <div className="grid md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="font-semibold mb-2">Bookings ({db.bookings.filter((b) => b.user_id === selectedUserId).length})</p>
                      {db.bookings
                        .filter((b) => b.user_id === selectedUserId)
                        .map((b) => (
                          <div key={b.id} className="border-b border-slate-100 py-1.5 flex justify-between">
                            <span className="font-mono-tabular">{b.booking_code}</span>
                            <StatusIndicator status={b.status} />
                          </div>
                        ))}
                    </div>
                    <div>
                      <p className="font-semibold mb-2">Payments ({db.payments.filter((p) => p.user_id === selectedUserId).length})</p>
                      {db.payments
                        .filter((p) => p.user_id === selectedUserId)
                        .map((p) => (
                          <div key={p.id} className="border-b border-slate-100 py-1.5 flex justify-between">
                            <span className="font-mono-tabular">₹{p.amount.toFixed(2)}</span>
                            <StatusIndicator status={p.payment_status} />
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PROVIDERS & APPROVALS TAB */}
          {activeTab === 'providers' && (
            <div className="grid lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200">
                  <h2 className="text-sm font-bold text-slate-900">Electricians & Plumbers ({allProviders.length})</h2>
                </div>
                {allProviders.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">No electrician or plumber applications submitted yet.</div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {allProviders.map((p) => {
                      const key = `${p.service_category}:${p.id}`;
                      return (
                        <div
                          key={key}
                          onClick={() => setSelectedProviderKey(key)}
                          className={`p-4 cursor-pointer hover:bg-slate-50 ${selectedProviderKey === key ? 'bg-blue-50/50' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-900">{p.full_name}</span>
                            <StatusIndicator status={p.approval_status} />
                          </div>
                          <p className="text-xs text-slate-600 capitalize mt-1">
                            {p.service_category} · {p.mobile_number} · PIN {p.pin_code} · Rating {p.average_rating || 'New'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="lg:col-span-6">
                {selectedProviderKey ? (() => {
                  const [type, idStr] = selectedProviderKey.split(':');
                  const prov = allProviders.find((p) => p.service_category === type && p.id === Number(idStr));
                  if (!prov) return null;
                  const docs = db.provider_documents.filter((d) => d.provider_type === prov.service_category && d.provider_id === prov.id);
                  return (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <div>
                          <h3 className="text-base font-bold text-slate-900">{prov.full_name}</h3>
                          <p className="text-xs text-slate-500 capitalize">{prov.service_category} · {prov.mobile_number}</p>
                        </div>
                        <StatusIndicator status={prov.approval_status} />
                      </div>
                      <div className="text-xs space-y-1">
                        <p><span className="font-semibold">Address:</span> {prov.address} (PIN {prov.pin_code})</p>
                        <p><span className="font-semibold">Qualification:</span> {prov.qualification_details}</p>
                        <p><span className="font-semibold">Experience:</span> {prov.experience_details}</p>
                      </div>

                      <div className="space-y-2 border-t border-slate-200 pt-3">
                        <p className="text-xs font-bold text-slate-900">Uploaded Verification Documents</p>
                        {docs.map((d) => (
                          <div key={d.id} className="flex items-center justify-between border border-slate-200 rounded-lg p-2.5 text-xs">
                            <div>
                              <p className="font-semibold capitalize">{d.document_type.replace(/_/g, ' ')}</p>
                              <a href={d.file_data_url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                                View {d.original_name}
                              </a>
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusIndicator status={d.verification_status} />
                              <button type="button" onClick={() => verifyDocument(d.id, 'verified')} className="px-2 py-1 bg-emerald-700 text-white rounded text-[11px]">
                                Verify
                              </button>
                              <button type="button" onClick={() => verifyDocument(d.id, 'rejected')} className="px-2 py-1 bg-red-700 text-white rounded text-[11px]">
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-3 border-t border-slate-200 pt-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => updateProviderApproval(prov, 'approved')}
                            className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg"
                          >
                            Approve Provider
                          </button>
                          <button
                            type="button"
                            onClick={() => updateProviderApproval(prov, 'blocked')}
                            className="px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-lg"
                          >
                            Block
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Rejection reason (visible to applicant)..."
                            className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => updateProviderApproval(prov, 'rejected', rejectReason)}
                            className="px-4 py-1.5 bg-red-700 text-white text-xs font-semibold rounded-lg"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
                    Select a service provider application to inspect documents and approve or reject.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BOOKINGS & MANUAL ENTRY TAB */}
          {activeTab === 'bookings' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowManualModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Phone-Call Booking</span>
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                      <th className="py-3 px-4">Booking ID</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Method</th>
                      <th className="py-3 px-4">Assign Technician</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Cancel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {db.bookings.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-500">No bookings recorded yet.</td>
                      </tr>
                    ) : (
                      db.bookings.map((b) => {
                        const cust = db.users.find((u) => u.id === b.user_id);
                        const eligibleProviders = (b.service_category === 'electrician' ? db.electricians : db.plumbers).filter(
                          (p) => p.approval_status === 'approved'
                        );
                        return (
                          <tr key={b.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-mono-tabular font-bold">{b.booking_code}</td>
                            <td className="py-3 px-4">{cust?.full_name} ({cust?.mobile_number})</td>
                            <td className="py-3 px-4 capitalize">{b.service_category}</td>
                            <td className="py-3 px-4">{b.booking_method === 'phone_manual' ? 'Phone Call' : 'Online'}</td>
                            <td className="py-3 px-4">
                              <select
                                value={b.assigned_provider_id ? `${b.assigned_provider_type}:${b.assigned_provider_id}` : ''}
                                onChange={(e) => assignProviderToBooking(b.id, e.target.value)}
                                className="px-2 py-1 border border-slate-300 rounded text-xs"
                              >
                                <option value="">Select Approved {b.service_category}</option>
                                {eligibleProviders.map((p) => (
                                  <option key={p.id} value={`${p.service_category}:${p.id}`}>
                                    {p.full_name} ({p.pin_code})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-4"><StatusIndicator status={b.status} /></td>
                            <td className="py-3 px-4">
                              {b.status !== 'Cancelled' && (
                                <button
                                  type="button"
                                  onClick={() => updateBookingStatusAdmin(b.id, 'Cancelled')}
                                  className="text-red-700 font-semibold hover:underline"
                                >
                                  Cancel
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PAYMENTS TAB */}
          {activeTab === 'payments' && (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { label: 'Total Successful Payments', val: `${financials.successfulCount} (₹${financials.totalCustomerCollections.toFixed(2)})` },
                  { label: 'Total Failed Payments', val: `${financials.failedCount} (₹${financials.totalFailedAmount.toFixed(2)})` },
                  { label: 'Total Pending Payments', val: `${financials.pendingCount} (₹${financials.totalPendingAmount.toFixed(2)})` },
                  { label: 'Total Refunded Amount', val: `₹${financials.totalRefundedAmount.toFixed(2)}` },
                  { label: 'Total Customer Collections', val: `₹${financials.totalCustomerCollections.toFixed(2)}` },
                ].map((c) => (
                  <div key={c.label} className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-500">{c.label}</p>
                    <p className="text-base font-bold font-mono-tabular text-slate-900 mt-1">{c.val}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(['all', 'success', 'pending', 'failed', 'refunded', 'created'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setPaymentFilter(status)}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
                      paymentFilter === status ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {status === 'all' ? 'All Transactions' : status}
                  </button>
                ))}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Booking ID</th>
                      <th className="py-3 px-4">Service Name</th>
                      <th className="py-3 px-4">Razorpay Order ID</th>
                      <th className="py-3 px-4">Razorpay Payment ID</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {db.payments.filter((p) => paymentFilter === 'all' || p.payment_status === paymentFilter).length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-slate-500">No customer payments matching filter.</td>
                      </tr>
                    ) : (
                      db.payments
                        .filter((p) => paymentFilter === 'all' || p.payment_status === paymentFilter)
                        .map((p) => {
                          const cust = db.users.find((u) => u.id === p.user_id);
                          const b = db.bookings.find((bk) => bk.id === p.booking_id);
                          const svcLabel = b?.service_name_snapshot || (b ? `${b.service_category} Service` : 'Service');
                          return (
                            <tr key={p.id}>
                              <td className="py-3 px-4">{cust?.full_name} ({cust?.mobile_number})</td>
                              <td className="py-3 px-4 font-mono-tabular font-semibold">{b?.booking_code}</td>
                              <td className="py-3 px-4 capitalize text-slate-700">{svcLabel}</td>
                              <td className="py-3 px-4 font-mono-tabular text-slate-600">{p.razorpay_order_id}</td>
                              <td className="py-3 px-4 font-mono-tabular text-slate-600">{p.razorpay_payment_id || '—'}</td>
                              <td className="py-3 px-4 text-right font-mono-tabular font-bold">₹{p.amount.toFixed(2)}</td>
                              <td className="py-3 px-4"><StatusIndicator status={p.payment_status} /></td>
                              <td className="py-3 px-4 font-mono-tabular">{new Date(p.paid_at || p.created_at).toLocaleString()}</td>
                              <td className="py-3 px-4">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPayment(p);
                                    setRefundAmount(String(p.amount));
                                    setRefundReason('');
                                    setRefundMsg(null);
                                  }}
                                  className="text-blue-700 font-semibold hover:underline"
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>

              {selectedPayment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                  <div className="w-full max-w-md bg-white rounded-xl p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <h3 className="text-base font-bold text-slate-900">Transaction Details</h3>
                      <button type="button" onClick={() => setSelectedPayment(null)}><X className="w-5 h-5 text-slate-500" /></button>
                    </div>
                    <dl className="space-y-2 text-xs">
                      <div className="flex justify-between"><dt className="text-slate-500">Order ID</dt><dd className="font-mono-tabular font-semibold">{selectedPayment.razorpay_order_id}</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">Payment ID</dt><dd className="font-mono-tabular font-semibold">{selectedPayment.razorpay_payment_id || 'N/A'}</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">Amount</dt><dd className="font-mono-tabular font-bold">₹{selectedPayment.amount.toFixed(2)}</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">Method</dt><dd className="uppercase">{selectedPayment.payment_method}</dd></div>
                      <div className="flex justify-between"><dt className="text-slate-500">Status</dt><dd><StatusIndicator status={selectedPayment.payment_status} /></dd></div>
                      {selectedPayment.failure_reason && (
                        <div><dt className="text-slate-500">Failure Reason</dt><dd className="text-red-700 mt-0.5">{selectedPayment.failure_reason}</dd></div>
                      )}
                      {selectedPayment.payment_status === 'refunded' && (
                        <div className="pt-2 border-t border-slate-200 space-y-1">
                          <div className="flex justify-between"><dt className="text-slate-500">Refunded Amount</dt><dd className="font-mono-tabular font-semibold text-purple-700">₹{(selectedPayment.refunded_amount ?? selectedPayment.amount).toFixed(2)}</dd></div>
                          {selectedPayment.refund_reason && (
                            <div><dt className="text-slate-500">Refund Reason</dt><dd className="text-slate-700 mt-0.5">{selectedPayment.refund_reason}</dd></div>
                          )}
                        </div>
                      )}
                    </dl>
                    {selectedPayment.payment_status === 'success' && (
                      <div className="border-t border-slate-200 pt-3 space-y-2">
                        <p className="text-xs font-semibold text-slate-900">Record Refund</p>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                            placeholder="Refund amount"
                            className="px-2.5 py-1.5 text-xs font-mono-tabular border border-slate-300 rounded-lg"
                          />
                          <input
                            type="text"
                            value={refundReason}
                            onChange={(e) => setRefundReason(e.target.value)}
                            placeholder="Refund reason"
                            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                          />
                        </div>
                        {refundMsg && <p className="text-xs text-blue-700">{refundMsg}</p>}
                        <button
                          type="button"
                          onClick={() => {
                            const res = refundPayment(selectedPayment.id, Number(refundAmount || selectedPayment.amount), refundReason, admin.id);
                            if (res.error) {
                              setRefundMsg(res.error);
                              return;
                            }
                            triggerRefresh();
                            setSelectedPayment(null);
                          }}
                          className="w-full py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-lg"
                        >
                          Mark as Refunded
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MANUAL PROVIDER PAYOUTS TAB */}
          {activeTab === 'payouts' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                <div className="px-5 py-4 border-b border-slate-200">
                  <h2 className="text-sm font-bold text-slate-900">Assign Service Charge & Record Manual Payouts</h2>
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                      <th className="py-3 px-4">Booking ID</th>
                      <th className="py-3 px-4">Assigned Provider</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Service Charge (₹)</th>
                      <th className="py-3 px-4">Payout Status</th>
                      <th className="py-3 px-4">Manual Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {db.bookings.filter((b) => b.assigned_provider_id).map((b) => {
                      const prov = (b.assigned_provider_type === 'electrician' ? db.electricians : db.plumbers).find(
                        (p) => p.id === b.assigned_provider_id
                      );
                      const charge = db.electrician_service_charges.find((c) => c.booking_id === b.id);
                      return (
                        <tr key={b.id}>
                          <td className="py-3 px-4 font-mono-tabular font-semibold">{b.booking_code}</td>
                          <td className="py-3 px-4">{prov?.full_name} ({b.assigned_provider_type})</td>
                          <td className="py-3 px-4"><StatusIndicator status={b.status} /></td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                disabled={charge?.payout_status === 'paid'}
                                value={chargeInputs[b.id] ?? (charge ? String(charge.assigned_charge) : '')}
                                onChange={(e) => setChargeInputs({ ...chargeInputs, [b.id]: e.target.value })}
                                placeholder="Amount"
                                className="w-24 px-2 py-1 border border-slate-300 rounded font-mono-tabular"
                              />
                              {charge?.payout_status !== 'paid' && (
                                <button
                                  type="button"
                                  onClick={() => handleAssignServiceCharge(b.id, b.assigned_provider_type!, b.assigned_provider_id!)}
                                  className="px-2.5 py-1 bg-slate-900 text-white rounded font-semibold"
                                >
                                  Save
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {charge ? <StatusIndicator status={charge.payout_status} /> : <span className="text-slate-400">Not Assigned</span>}
                          </td>
                          <td className="py-3 px-4">
                            {charge && charge.payout_status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => setPayoutModalChargeId(charge.id)}
                                className="px-3 py-1 bg-emerald-700 text-white rounded font-semibold"
                              >
                                Mark Paid (UTR)
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                <div className="px-5 py-4 border-b border-slate-200">
                  <h2 className="text-sm font-bold text-slate-900">Recorded Payout History</h2>
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Provider</th>
                      <th className="py-3 px-4">UTR / Transaction Ref</th>
                      <th className="py-3 px-4">Mode</th>
                      <th className="py-3 px-4 text-right">Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {db.electrician_payouts.length === 0 ? (
                      <tr><td colSpan={5} className="py-6 text-center text-slate-500">No manual payouts recorded yet.</td></tr>
                    ) : (
                      db.electrician_payouts.map((p) => {
                        const prov = (p.provider_type === 'electrician' ? db.electricians : db.plumbers).find((x) => x.id === p.provider_id);
                        return (
                          <tr key={p.id}>
                            <td className="py-3 px-4 font-mono-tabular">{p.payment_date}</td>
                            <td className="py-3 px-4">{prov?.full_name} ({p.provider_type})</td>
                            <td className="py-3 px-4 font-mono-tabular font-semibold">{p.utr_reference}</td>
                            <td className="py-3 px-4">{p.payment_mode}</td>
                            <td className="py-3 px-4 text-right font-mono-tabular font-bold text-emerald-700">₹{p.paid_amount.toFixed(2)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SERVICE MANAGEMENT TAB */}
          {activeTab === 'services' && (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { label: 'Total Services', val: db.services.length },
                  { label: 'Active Services', val: db.services.filter((s) => s.is_active).length },
                  { label: 'Disabled Services', val: db.services.filter((s) => !s.is_active).length },
                ].map((c) => (
                  <div key={c.label} className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-500">{c.label}</p>
                    <p className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">{c.val}</p>
                  </div>
                ))}
              </div>
              <div className="grid lg:grid-cols-12 gap-6">
                <form onSubmit={handleSaveService} className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <h2 className="text-sm font-bold text-slate-900">{editingServiceId ? 'Edit Service' : 'Add New Service'}</h2>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Service Category</label>
                    <select
                      value={serviceForm.category_id}
                      onChange={(e) => setServiceForm({ ...serviceForm, category_id: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                    >
                      {db.service_categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Service Name</label>
                    <input
                      type="text"
                      required
                      value={serviceForm.service_name}
                      onChange={(e) => setServiceForm({ ...serviceForm, service_name: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                    <textarea
                      rows={3}
                      required
                      value={serviceForm.description}
                      onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Price (₹)</label>
                      <input
                        type="number"
                        required
                        value={serviceForm.price}
                        onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Pricing Type</label>
                      <select
                        value={serviceForm.pricing_type}
                        onChange={(e) => setServiceForm({ ...serviceForm, pricing_type: e.target.value as 'fixed' | 'starting_at' | 'hourly' | 'custom_quote' | 'inspection' })}
                        className="w-full px-2 py-2 text-xs border border-slate-300 rounded-lg"
                      >
                        <option value="fixed">Fixed Price</option>
                        <option value="starting_at">Starting From</option>
                        <option value="hourly">Hourly Rate</option>
                        <option value="custom_quote">Custom Quote</option>
                        <option value="inspection">Inspection</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Order</label>
                      <input
                        type="number"
                        value={serviceForm.display_order}
                        onChange={(e) => setServiceForm({ ...serviceForm, display_order: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Service Image</label>
                    <input type="file" accept="image/*" onChange={handleServiceImageUpload} className="text-xs" />
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={serviceForm.is_available} onChange={(e) => setServiceForm({ ...serviceForm, is_available: e.target.checked })} />
                      <span>Available</span>
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={serviceForm.is_active} onChange={(e) => setServiceForm({ ...serviceForm, is_active: e.target.checked })} />
                      <span>Active on User Panel</span>
                    </label>
                  </div>
                  {serviceMsg && <p className="text-xs text-blue-700">{serviceMsg}</p>}
                  <button type="submit" className="w-full py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg">
                    {editingServiceId ? 'Save Service Changes' : 'Create Service'}
                  </button>
                </form>

                <div className="lg:col-span-7 space-y-4">
                  <form onSubmit={handleAddCategory} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Add new service category (e.g. Appliance Repair)..."
                      className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                    <button type="submit" className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg whitespace-nowrap">
                      Add Category
                    </button>
                  </form>

                  <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                          <th className="py-3 px-4">Service</th>
                          <th className="py-3 px-4">Category</th>
                          <th className="py-3 px-4 text-right">Price</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {db.services.map((s) => {
                          const cat = db.service_categories.find((c) => c.id === s.category_id);
                          return (
                            <tr key={s.id}>
                              <td className="py-3 px-4 font-semibold">{s.service_name}</td>
                              <td className="py-3 px-4">{cat?.name}</td>
                              <td className="py-3 px-4 text-right font-mono-tabular">
                                ₹{s.price} <span className="text-[10px] font-sans text-slate-500">({s.pricing_type.replace('_', ' ')})</span>
                              </td>
                              <td className="py-3 px-4"><StatusIndicator status={s.is_active ? 'active' : 'blocked'} /></td>
                              <td className="py-3 px-4 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingServiceId(s.id);
                                    setServiceForm({
                                      category_id: String(s.category_id),
                                      service_name: s.service_name,
                                      description: s.description,
                                      image_data_url: s.image_data_url,
                                      price: String(s.price),
                                      pricing_type: s.pricing_type,
                                      is_available: s.is_available,
                                      is_active: s.is_active,
                                      display_order: String(s.display_order),
                                    });
                                  }}
                                  className="text-blue-700 font-semibold hover:underline"
                                >
                                  Edit
                                </button>
                                <button type="button" onClick={() => handleToggleService(s)} className="text-amber-700 font-semibold hover:underline">
                                  {s.is_active ? 'Disable' : 'Enable'}
                                </button>
                                <button type="button" onClick={() => handleDeleteService(s.id)} className="text-red-700 font-semibold hover:underline">
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* GIFT VOUCHERS TAB */}
          {activeTab === 'vouchers' && (
            <div className="space-y-6">
              <div className="grid lg:grid-cols-12 gap-6">
                <form onSubmit={handleSaveVoucher} className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <h2 className="text-sm font-bold text-slate-900">{editingVoucherId ? 'Edit Gift Voucher' : 'Create Custom Gift Voucher'}</h2>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Voucher Name</label>
                      <input type="text" required value={voucherForm.voucher_name} onChange={(e) => setVoucherForm({ ...voucherForm, voucher_name: e.target.value })} className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Voucher Code</label>
                      <div className="flex gap-1">
                        <input type="text" required value={voucherForm.voucher_code} onChange={(e) => setVoucherForm({ ...voucherForm, voucher_code: e.target.value.toUpperCase() })} className="flex-1 px-2 py-1.5 text-xs font-mono-tabular uppercase border border-slate-300 rounded-lg" />
                        <button type="button" onClick={generateUniqueVoucherCode} className="px-2 py-1.5 bg-slate-900 text-white text-[11px] rounded-lg">Gen</button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                    <input type="text" value={voucherForm.description} onChange={(e) => setVoucherForm({ ...voucherForm, description: e.target.value })} className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
                      <select value={voucherForm.discount_type} onChange={(e) => setVoucherForm({ ...voucherForm, discount_type: e.target.value as 'fixed' | 'percentage' })} className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg">
                        <option value="fixed">Fixed ₹</option>
                        <option value="percentage">Percent %</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Value</label>
                      <input type="number" required value={voucherForm.discount_value} onChange={(e) => setVoucherForm({ ...voucherForm, discount_value: e.target.value })} className="w-full px-2 py-1.5 text-xs font-mono-tabular border border-slate-300 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Min Order ₹</label>
                      <input type="number" value={voucherForm.min_booking_amount} onChange={(e) => setVoucherForm({ ...voucherForm, min_booking_amount: e.target.value })} className="w-full px-2 py-1.5 text-xs font-mono-tabular border border-slate-300 rounded-lg" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Max Disc ₹</label>
                      <input type="number" value={voucherForm.max_discount_amount} onChange={(e) => setVoucherForm({ ...voucherForm, max_discount_amount: e.target.value })} className="w-full px-2 py-1.5 text-xs font-mono-tabular border border-slate-300 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
                      <input type="date" required value={voucherForm.start_date} onChange={(e) => setVoucherForm({ ...voucherForm, start_date: e.target.value })} className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Expiry Date</label>
                      <input type="date" required value={voucherForm.expiry_date} onChange={(e) => setVoucherForm({ ...voucherForm, expiry_date: e.target.value })} className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Total Limit</label>
                      <input type="number" value={voucherForm.total_usage_limit} onChange={(e) => setVoucherForm({ ...voucherForm, total_usage_limit: e.target.value })} className="w-full px-2 py-1.5 text-xs font-mono-tabular border border-slate-300 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Per User Limit</label>
                      <input type="number" value={voucherForm.per_user_limit} onChange={(e) => setVoucherForm({ ...voucherForm, per_user_limit: e.target.value })} className="w-full px-2 py-1.5 text-xs font-mono-tabular border border-slate-300 rounded-lg" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Target Audience</label>
                      <select value={voucherForm.target_audience} onChange={(e) => setVoucherForm({ ...voucherForm, target_audience: e.target.value as 'all_users' | 'specific_users' })} className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg">
                        <option value="all_users">All Users</option>
                        <option value="specific_users">Specific Users</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Applicable Services</label>
                      <select value={voucherForm.applicable_scope} onChange={(e) => setVoucherForm({ ...voucherForm, applicable_scope: e.target.value as 'all_services' | 'specific_services' })} className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg">
                        <option value="all_services">All Services</option>
                        <option value="specific_services">Specific Services</option>
                      </select>
                    </div>
                  </div>
                  {voucherForm.target_audience === 'specific_users' && (
                    <div className="border border-slate-200 rounded-lg p-2 max-h-28 overflow-y-auto text-xs space-y-1">
                      <p className="font-semibold text-slate-700">Assign to Users:</p>
                      {db.users.map((u) => (
                        <label key={u.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={voucherForm.assigned_user_ids.includes(u.id)}
                            onChange={(e) => {
                              const ids = e.target.checked
                                ? [...voucherForm.assigned_user_ids, u.id]
                                : voucherForm.assigned_user_ids.filter((id) => id !== u.id);
                              setVoucherForm({ ...voucherForm, assigned_user_ids: ids });
                            }}
                          />
                          <span>{u.full_name} ({u.mobile_number})</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {voucherMsg && <p className="text-xs text-blue-700">{voucherMsg}</p>}
                  <button type="submit" className="w-full py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg">
                    {editingVoucherId ? 'Update Voucher' : 'Create Gift Voucher'}
                  </button>
                </form>

                <div className="lg:col-span-7 space-y-4">
                  <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                    <div className="px-4 py-3 border-b border-slate-200">
                      <h3 className="text-xs font-bold text-slate-900">Vouchers ({db.gift_vouchers.length})</h3>
                    </div>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                          <th className="py-2.5 px-3">Code</th>
                          <th className="py-2.5 px-3">Discount</th>
                          <th className="py-2.5 px-3">Usage</th>
                          <th className="py-2.5 px-3">Expiry</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {db.gift_vouchers.length === 0 ? (
                          <tr><td colSpan={6} className="py-6 text-center text-slate-500">No vouchers created yet.</td></tr>
                        ) : (
                          db.gift_vouchers.map((v) => {
                            const used = db.voucher_redemptions.filter((r) => r.voucher_id === v.id).length;
                            const isExpired = v.expiry_date < new Date().toISOString().slice(0, 10);
                            return (
                              <tr key={v.id}>
                                <td className="py-2.5 px-3 font-mono-tabular font-bold">{v.voucher_code}</td>
                                <td className="py-2.5 px-3 font-mono-tabular">{v.discount_type === 'fixed' ? `₹${v.discount_value}` : `${v.discount_value}%`}</td>
                                <td className="py-2.5 px-3 font-mono-tabular">{used} / {v.total_usage_limit}</td>
                                <td className="py-2.5 px-3 font-mono-tabular">{v.expiry_date}</td>
                                <td className="py-2.5 px-3">
                                  <StatusIndicator status={isExpired ? 'failed' : v.is_active ? 'active' : 'blocked'} />
                                </td>
                                <td className="py-2.5 px-3 flex items-center gap-2">
                                  <button type="button" onClick={() => handleToggleVoucher(v)} className="text-amber-700 font-semibold hover:underline">
                                    {v.is_active ? 'Deactivate' : 'Activate'}
                                  </button>
                                  <button type="button" onClick={() => handleDeleteVoucher(v.id)} className="text-red-700 font-semibold hover:underline">
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                    <div className="px-4 py-3 border-b border-slate-200">
                      <h3 className="text-xs font-bold text-slate-900">Voucher Usage History</h3>
                    </div>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                          <th className="py-2.5 px-3">Voucher</th>
                          <th className="py-2.5 px-3">Customer</th>
                          <th className="py-2.5 px-3">Booking</th>
                          <th className="py-2.5 px-3 text-right">Discount Given</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {db.voucher_redemptions.length === 0 ? (
                          <tr><td colSpan={4} className="py-5 text-center text-slate-500">No voucher redemptions yet.</td></tr>
                        ) : (
                          db.voucher_redemptions.map((r) => {
                            const v = db.gift_vouchers.find((x) => x.id === r.voucher_id);
                            const u = db.users.find((x) => x.id === r.user_id);
                            const b = db.bookings.find((x) => x.id === r.booking_id);
                            return (
                              <tr key={r.id}>
                                <td className="py-2.5 px-3 font-mono-tabular font-semibold">{v?.voucher_code}</td>
                                <td className="py-2.5 px-3">{u?.full_name}</td>
                                <td className="py-2.5 px-3 font-mono-tabular">{b?.booking_code}</td>
                                <td className="py-2.5 px-3 text-right font-mono-tabular text-emerald-700">₹{r.discount_amount.toFixed(2)}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CUSTOMER REVIEWS MODERATION TAB */}
          {activeTab === 'reviews' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-sm font-bold text-slate-900">Genuine Customer Reviews ({db.customer_reviews.length})</h2>
                <p className="text-xs text-slate-500 mt-0.5">Only genuine reviews submitted by customers after completed bookings appear here. Admin can hide or unhide visibility.</p>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4">Rating</th>
                    <th className="py-3 px-4">Feedback</th>
                    <th className="py-3 px-4">Visibility</th>
                    <th className="py-3 px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {db.customer_reviews.length === 0 ? (
                    <tr><td colSpan={6} className="py-6 text-center text-slate-500">No genuine customer reviews submitted yet.</td></tr>
                  ) : (
                    db.customer_reviews.map((r) => {
                      const cust = db.users.find((u) => u.id === r.user_id);
                      const isVis = r.is_visible !== false;
                      return (
                        <tr key={r.id}>
                          <td className="py-3 px-4 font-semibold">{cust?.full_name}</td>
                          <td className="py-3 px-4 capitalize">{r.provider_type}</td>
                          <td className="py-3 px-4 font-mono-tabular font-bold">{r.rating} / 5</td>
                          <td className="py-3 px-4 max-w-md">{r.written_feedback}</td>
                          <td className="py-3 px-4"><StatusIndicator status={isVis ? 'active' : 'blocked'} /></td>
                          <td className="py-3 px-4 flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleToggleReviewVisibility(r.id, isVis)}
                              className="text-blue-700 font-semibold hover:underline"
                            >
                              {isVis ? 'Hide Review' : 'Unhide Review'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedReview(r)}
                              className="text-slate-700 font-semibold hover:underline"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {selectedReview && (() => {
                const cust = db.users.find((u) => u.id === selectedReview.user_id);
                const bk = db.bookings.find((b) => b.id === selectedReview.booking_id);
                return (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                    <div className="w-full max-w-md bg-white rounded-xl p-6 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <h3 className="text-base font-bold text-slate-900">Review & Booking Details</h3>
                        <button type="button" onClick={() => setSelectedReview(null)}><X className="w-5 h-5 text-slate-500" /></button>
                      </div>
                      <dl className="space-y-2 text-xs">
                        <div className="flex justify-between"><dt className="text-slate-500">Customer Name</dt><dd className="font-semibold text-slate-900">{cust?.full_name || 'N/A'}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">Mobile Number</dt><dd className="font-mono-tabular">{cust?.mobile_number || 'N/A'}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">Booking Code</dt><dd className="font-mono-tabular font-semibold">{bk?.booking_code || 'N/A'}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">Service Category</dt><dd className="capitalize">{selectedReview.provider_type}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">Preferred Date</dt><dd className="font-mono-tabular">{bk?.preferred_date || 'N/A'}</dd></div>
                        <div><dt className="text-slate-500">Service Address</dt><dd className="text-slate-700 mt-0.5">{bk?.service_address || 'N/A'}</dd></div>
                        <div><dt className="text-slate-500">Problem Description</dt><dd className="text-slate-700 mt-0.5">{bk?.problem_description || 'N/A'}</dd></div>
                        <div><dt className="text-slate-500">Customer Feedback ({selectedReview.rating}/5)</dt><dd className="text-slate-900 mt-0.5">{selectedReview.written_feedback}</dd></div>
                      </dl>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
              {db.notifications.filter((n) => n.recipient_role === 'admin').length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No admin notifications yet.</div>
              ) : (
                db.notifications
                  .filter((n) => n.recipient_role === 'admin')
                  .map((n) => (
                    <div key={n.id} className="p-4 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                        <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                      </div>
                      <span className="text-xs font-mono-tabular text-slate-400 whitespace-nowrap">
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))
              )}
            </div>
          )}

          {/* SETTINGS -> PAYMENT GATEWAY -> RAZORPAY TEST MODE */}
          {activeTab === 'settings' && (
            <div className="max-w-3xl space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <p className="text-xs font-semibold text-blue-700">
                      Settings / Payment Gateway / Razorpay Test Mode
                    </p>
                    <h2 className="text-lg font-bold text-slate-900 mt-0.5 flex items-center gap-2">
                      <KeyRound className="w-5 h-5 text-blue-700" />
                      <span>Razorpay Test API Keys</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Configure your Razorpay Test Mode credentials. Secret keys are encrypted on the PHP server and never exposed in frontend code.
                    </p>
                  </div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 whitespace-nowrap self-start">
                    Test Mode Only
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Razorpay Test Key ID
                    </label>
                    <input
                      type="text"
                      value={rzpTestKeyId}
                      onChange={(e) => setRzpTestKeyId(e.target.value)}
                      placeholder="rzp_test_xxxxxxxxxxxxx"
                      className="w-full px-3.5 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Must start with <code className="px-1 py-0.5 bg-slate-100 rounded">rzp_test_</code>. Used by User Panel Razorpay Checkout.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        Razorpay Test Key Secret
                      </label>
                      {rzpMaskedSecret && (
                        <span className="text-[11px] font-mono-tabular text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          Saved Secret: {rzpMaskedSecret}
                        </span>
                      )}
                    </div>
                    <input
                      type="password"
                      value={rzpTestKeySecret}
                      onChange={(e) => setRzpTestKeySecret(e.target.value)}
                      placeholder={rzpMaskedSecret ? 'Enter new Test Key Secret to update (leave blank to keep saved)' : 'Enter your Razorpay Test Key Secret'}
                      autoComplete="new-password"
                      className="w-full px-3.5 py-2.5 text-sm font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Stored encrypted on the PHP server for order creation and HMAC-SHA256 signature verification. Never sent back to the browser.
                    </p>
                  </div>
                </div>

                {rzpSettingsFeedback && (
                  <div
                    className={`flex items-start gap-2 text-xs rounded-lg p-3 border ${
                      rzpSettingsFeedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                  >
                    {rzpSettingsFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <span>{rzpSettingsFeedback.text}</span>
                  </div>
                )}

                {rzpLastTestInfo.status && (
                  <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3">
                    <div>
                      <span className="font-semibold text-slate-700">Last Connection Check: </span>
                      <span className={rzpLastTestInfo.status === 'connected' ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
                        {rzpLastTestInfo.status === 'connected' ? 'Connected' : 'Failed'}
                      </span>
                      {rzpLastTestInfo.message && <p className="text-slate-600 mt-0.5">{rzpLastTestInfo.message}</p>}
                    </div>
                    {rzpLastTestInfo.at && (
                      <span className="font-mono-tabular text-[11px] text-slate-400 whitespace-nowrap">
                        {new Date(rzpLastTestInfo.at).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200">
                  {!rzpIsConfigured && (
                    <button
                      type="button"
                      disabled={rzpSettingsLoading}
                      onClick={() => handleSaveRazorpayTestKeys(false)}
                      className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      {rzpSettingsLoading ? 'Saving...' : 'Save Test Keys'}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={rzpSettingsLoading}
                    onClick={() => handleSaveRazorpayTestKeys(true)}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    {rzpSettingsLoading ? 'Updating...' : 'Update Test Keys'}
                  </button>
                  <button
                    type="button"
                    disabled={rzpTestingConn || rzpSettingsLoading}
                    onClick={handleTestRazorpayConnection}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-slate-300 hover:bg-slate-50 disabled:opacity-60 text-slate-800 text-xs font-semibold rounded-lg transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${rzpTestingConn ? 'animate-spin' : ''}`} />
                    <span>{rzpTestingConn ? 'Testing Connection...' : 'Test Connection'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MANUAL PHONE BOOKING MODAL */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <form onSubmit={handleCreateManualBooking} className="w-full max-w-lg bg-white rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">Create Phone-Call Booking</h3>
              <button type="button" onClick={() => setShowManualModal(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Select Registered Customer</label>
              <select
                required
                value={manualForm.user_id}
                onChange={(e) => setManualForm({ ...manualForm, user_id: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              >
                <option value="">Choose Customer...</option>
                {db.users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name} ({u.mobile_number})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Service Category</label>
                <select
                  value={manualForm.service_category}
                  onChange={(e) => setManualForm({ ...manualForm, service_category: e.target.value as ServiceCategory })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  <option value="electrician">Electrician</option>
                  <option value="plumber">Plumber</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Booking Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={manualForm.booking_amount}
                  onChange={(e) => setManualForm({ ...manualForm, booking_amount: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Problem Description</label>
              <textarea
                required
                rows={3}
                value={manualForm.problem_description}
                onChange={(e) => setManualForm({ ...manualForm, problem_description: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Service Address (leave blank to use customer profile address)</label>
              <input
                type="text"
                value={manualForm.service_address}
                onChange={(e) => setManualForm({ ...manualForm, service_address: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Problem Photos (Optional)</label>
              <input type="file" accept="image/*" multiple onChange={handleManualPhotoUpload} className="text-xs" />
            </div>
            <button type="submit" className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg">
              Create & Verify Payment via Razorpay
            </button>
          </form>
        </div>
      )}

      {/* MANUAL PAYOUT MODAL */}
      {payoutModalChargeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <form onSubmit={handleRecordManualPayout} className="w-full max-w-md bg-white rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">Record Manual Provider Payout</h3>
              <button type="button" onClick={() => setPayoutModalChargeId(null)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">UTR / Transaction Reference Number</label>
              <input
                type="text"
                required
                value={payoutForm.utr_reference}
                onChange={(e) => setPayoutForm({ ...payoutForm, utr_reference: e.target.value })}
                placeholder="e.g. 431209847123"
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Payment Mode</label>
                <input
                  type="text"
                  required
                  value={payoutForm.payment_mode}
                  onChange={(e) => setPayoutForm({ ...payoutForm, payment_mode: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  required
                  value={payoutForm.payment_date}
                  onChange={(e) => setPayoutForm({ ...payoutForm, payment_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <button type="submit" className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-lg">
              Confirm & Mark Paid
            </button>
          </form>
        </div>
      )}

      {rzpCheckout && (
        <RazorpayModal
          bookingId={rzpCheckout.bookingId}
          bookingCode={rzpCheckout.bookingCode}
          orderId={rzpCheckout.orderId}
          amount={rzpCheckout.amount}
          customerName={rzpCheckout.customerName}
          customerMobile={rzpCheckout.customerMobile}
          actorRole="admin"
          actorId={admin.id}
          onSuccess={() => {
            setRzpCheckout(null);
            triggerRefresh();
          }}
          onClose={() => {
            setRzpCheckout(null);
            triggerRefresh();
          }}
        />
      )}
    </div>
  );
};
