import React, { useState, useMemo } from 'react';
import {
  Zap,
  Droplets,
  Phone,
  Upload,
  CheckCircle2,
  Star,
  Bell,
  User as UserIcon,
  Calendar,
  CreditCard,
  ClipboardList,
  LogOut,
  FileText,
  ArrowRight,
  Menu,
  X,
  Tag,
  Layers,
} from 'lucide-react';
import {
  createBooking,
  createRetryPaymentOrder,
  fileToDataUrl,
  loadDB,
  loginUser,
  registerUser,
  saveDB,
  sendOtp,
  submitCustomerReview,
  validateVoucherForUser,
} from '../services/backend';
import { BookingRecord, ServiceCategory, UserAccount } from '../types';
import { RazorpayModal } from '../components/RazorpayModal';
import { StatusIndicator } from '../components/StatusIndicator';

import heroImg from '../assets/images/hero_service_technician_1794283157779.jpg';
import elecImg from '../assets/images/service_electrician_work_1794283157502.jpg';
import plumbImg from '../assets/images/service_plumber_work_1794283157183.jpg';

function formatPricingTypeLabel(type: string): string {
  switch (type) {
    case 'fixed':
      return 'Fixed Price';
    case 'starting_at':
      return 'Starting From';
    case 'hourly':
      return 'Hourly Rate';
    case 'custom_quote':
      return 'Custom Quote';
    case 'inspection':
      return 'Inspection';
    default:
      return type;
  }
}

function formatServiceCharge(price: number, type: string): string {
  switch (type) {
    case 'fixed':
      return `₹${price}`;
    case 'starting_at':
      return `₹${price} onwards`;
    case 'hourly':
      return `₹${price} / hr`;
    case 'custom_quote':
      return 'Quote After Inspection';
    case 'inspection':
      return `₹${price} (Inspection)`;
    default:
      return `₹${price}`;
  }
}

export const UserPortal: React.FC = () => {
  const [user, setUser] = useState<UserAccount | null>(() => {
    const saved = sessionStorage.getItem('vv_user_session');
    return saved ? (JSON.parse(saved) as UserAccount) : null;
  });
  const [authView, setAuthView] = useState<'landing' | 'login' | 'register'>('landing');
  const [activeTab, setActiveTab] = useState<'services' | 'book' | 'bookings' | 'payments' | 'vouchers' | 'notifications' | 'profile'>('services');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [showAllReviewsModal, setShowAllReviewsModal] = useState(false);

  // Registration state
  const [regForm, setRegForm] = useState({
    full_name: '',
    mobile_number: '',
    password: '',
    address: '',
    village_city: '',
    district: '',
    state: '',
    pin_code: '',
    otp_code: '',
  });
  const [sentOtpPreview, setSentOtpPreview] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Login state
  const [loginMobile, setLoginMobile] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Booking form state
  const [category, setCategory] = useState<ServiceCategory>('electrician');
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<{ code: string; discount: number; finalAmount: number } | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [problemDesc, setProblemDesc] = useState('');
  const [serviceAddress, setServiceAddress] = useState('');
  const [prefDate, setPrefDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [prefTime, setPrefTime] = useState('10:00 AM - 12:00 PM');
  const [problemPhotos, setProblemPhotos] = useState<{ file_data_url: string; original_name: string }[]>([]);
  const [reviewStep, setReviewStep] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Razorpay modal state
  const [rzpCheckout, setRzpCheckout] = useState<{
    bookingId: number;
    bookingCode: string;
    orderId: string;
    amount: number;
    serviceName?: string;
  } | null>(null);

  // Selected booking for tracking / review / receipt
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    service_quality: 5,
    provider_behaviour: 5,
    work_satisfaction: 5,
    written_feedback: '',
  });
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  // Profile edit state
  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name || '',
    address: user?.address || '',
    village_city: user?.village_city || '',
    district: user?.district || '',
    state: user?.state || '',
    pin_code: user?.pin_code || '',
  });
  const [profileSaved, setProfileSaved] = useState(false);

  const db = useMemo(() => loadDB(), [refreshTick, user, activeTab, authView]);
  const triggerRefresh = () => setRefreshTick((t) => t + 1);

  const userBookings = useMemo(
    () => (user ? db.bookings.filter((b) => b.user_id === user.id) : []),
    [db, user]
  );
  const userPayments = useMemo(
    () => (user ? db.payments.filter((p) => p.user_id === user.id) : []),
    [db, user]
  );
  const userNotifications = useMemo(
    () => (user ? db.notifications.filter((n) => n.recipient_role === 'user' && n.recipient_id === user.id) : []),
    [db, user]
  );

  const handleSendOtp = () => {
    setAuthError(null);
    if (!/^[0-9]{10,15}$/.test(regForm.mobile_number.trim())) {
      setAuthError('Enter a valid 10-digit mobile number before requesting OTP.');
      return;
    }
    const { otp } = sendOtp(regForm.mobile_number.trim(), 'user');
    setSentOtpPreview(otp);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const res = registerUser(regForm);
    if (res.error) {
      setAuthError(res.error);
      return;
    }
    if (res.user) {
      sessionStorage.setItem('vv_user_session', JSON.stringify(res.user));
      setUser(res.user);
      setServiceAddress(`${res.user.address}, ${res.user.village_city}, ${res.user.district}, ${res.user.state} - ${res.user.pin_code}`);
      setProfileForm({
        full_name: res.user.full_name,
        address: res.user.address,
        village_city: res.user.village_city,
        district: res.user.district,
        state: res.user.state,
        pin_code: res.user.pin_code,
      });
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const res = loginUser(loginMobile, loginPassword);
    if (res.error) {
      setAuthError(res.error);
      return;
    }
    if (res.user) {
      sessionStorage.setItem('vv_user_session', JSON.stringify(res.user));
      setUser(res.user);
      setServiceAddress(`${res.user.address}, ${res.user.village_city}, ${res.user.district}, ${res.user.state} - ${res.user.pin_code}`);
      setProfileForm({
        full_name: res.user.full_name,
        address: res.user.address,
        village_city: res.user.village_city,
        district: res.user.district,
        state: res.user.state,
        pin_code: res.user.pin_code,
      });
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('vv_user_session');
    setUser(null);
    setAuthView('landing');
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const converted = await Promise.all(
      files.map(async (f) => ({
        file_data_url: await fileToDataUrl(f),
        original_name: f.name,
      }))
    );
    setProblemPhotos((prev) => [...prev, ...converted]);
  };

  const activeServices = useMemo(
    () =>
      db.services
        .filter((s) => s.is_active)
        .sort((a, b) => a.display_order - b.display_order),
    [db]
  );

  const selectedService = useMemo(
    () =>
      activeServices.find((s) => s.id === selectedServiceId) ||
      activeServices.find((s) => s.is_available) ||
      null,
    [activeServices, selectedServiceId]
  );

  const baseBookingAmount = selectedService ? selectedService.price : 0;

  const genuineVisibleReviews = useMemo(() => {
    return db.customer_reviews
      .filter((r) => {
        if (r.is_visible === false) return false;
        const b = db.bookings.find((bk) => bk.id === r.booking_id);
        return b && (b.status === 'Work Completed' || b.status === 'Completed and Reviewed');
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [db]);

  const averageCustomerRating = useMemo(() => {
    if (genuineVisibleReviews.length === 0) return 0;
    const sum = genuineVisibleReviews.reduce((s, r) => s + r.rating, 0);
    return Number((sum / genuineVisibleReviews.length).toFixed(1));
  }, [genuineVisibleReviews]);

  const userAvailableVouchers = useMemo(() => {
    if (!user) return [];
    const today = new Date().toISOString().slice(0, 10);
    return db.gift_vouchers.filter((v) => {
      if (!v.is_active || v.expiry_date < today) return false;
      if (v.target_audience === 'all_users') return true;
      return db.voucher_assignments.some((a) => a.voucher_id === v.id && a.user_id === user.id);
    });
  }, [db, user]);

  const userVoucherRedemptions = useMemo(() => {
    if (!user) return [];
    return db.voucher_redemptions.filter((r) => r.user_id === user.id);
  }, [db, user]);

  const handleApplyVoucher = () => {
    if (!user) return;
    setVoucherError(null);
    const res = validateVoucherForUser(db, user.id, voucherCodeInput, baseBookingAmount, selectedService?.id);
    if (!res.valid || !res.voucher) {
      setAppliedVoucher(null);
      setVoucherError(res.error || 'Invalid voucher.');
      return;
    }
    setAppliedVoucher({
      code: res.voucher.voucher_code,
      discount: res.discount_amount || 0,
      finalAmount: res.final_amount || baseBookingAmount,
    });
  };

  const handleProceedToPayment = () => {
    if (!user) return;
    setBookingError(null);
    if (!selectedService) {
      setBookingError('No active service is currently available for booking.');
      return;
    }
    if (!problemDesc.trim() || !serviceAddress.trim()) {
      setBookingError('Please describe the problem and provide the complete service address.');
      return;
    }
    const { booking, razorpay_order_id } = createBooking({
      user_id: user.id,
      service_category: category,
      service_id: selectedService?.id ?? null,
      voucher_code: selectedService.pricing_type === 'custom_quote' ? undefined : appliedVoucher?.code,
      booking_method: 'online',
      problem_description: problemDesc,
      service_address: serviceAddress,
      preferred_date: prefDate,
      preferred_time: prefTime,
      booking_amount: baseBookingAmount,
      photos: problemPhotos,
      actor_role: 'user',
      actor_id: user.id,
    });

    if (selectedService.pricing_type === 'custom_quote' || !razorpay_order_id) {
      setReviewStep(false);
      setProblemDesc('');
      setProblemPhotos([]);
      setAppliedVoucher(null);
      setVoucherCodeInput('');
      setActiveTab('bookings');
      setSelectedBookingId(booking.id);
      triggerRefresh();
      return;
    }

    setRzpCheckout({
      bookingId: booking.id,
      bookingCode: booking.booking_code,
      orderId: razorpay_order_id,
      amount: booking.booking_amount,
      serviceName: selectedService.service_name,
    });
  };

  const handleSubmitReview = (booking: BookingRecord) => {
    if (!user) return;
    setReviewMessage(null);
    const res = submitCustomerReview({
      booking_id: booking.id,
      user_id: user.id,
      ...reviewForm,
    });
    if (res.error) {
      setReviewMessage(res.error);
      return;
    }
    setReviewMessage('Thank you. Your completion confirmation and review have been saved.');
    setReviewForm({ rating: 5, service_quality: 5, provider_behaviour: 5, work_satisfaction: 5, written_feedback: '' });
    triggerRefresh();
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const currentDb = loadDB();
    const target = currentDb.users.find((u) => u.id === user.id);
    if (target) {
      Object.assign(target, profileForm);
      saveDB(currentDb);
      sessionStorage.setItem('vv_user_session', JSON.stringify(target));
      setUser({ ...target });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    }
  };

  // PUBLIC LANDING / AUTH VIEW (Zero Admin or Electrician login options)
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
            <button
              type="button"
              onClick={() => setAuthView('landing')}
              className="text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
            >
              Volt & Valve
            </button>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <a href="#services" onClick={() => setAuthView('landing')} className="hover:text-slate-900 whitespace-nowrap shrink-0">
                Services
              </a>
              <a href="#booking-methods" onClick={() => setAuthView('landing')} className="hover:text-slate-900 whitespace-nowrap shrink-0">
                Booking Methods
              </a>
              <a href="#workflow" onClick={() => setAuthView('landing')} className="hover:text-slate-900 whitespace-nowrap shrink-0">
                How It Works
              </a>
              <button
                type="button"
                onClick={() => setAuthView('login')}
                className="hover:text-slate-900 whitespace-nowrap shrink-0"
              >
                Customer Sign In
              </button>
            </nav>
            <div className="shrink-0">
              <button
                type="button"
                onClick={() => setAuthView('register')}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Book a Service
              </button>
            </div>
          </div>
        </header>

        {authView === 'landing' && (
          <main className="flex-1">
            {/* Hero Section */}
            <section className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
              <div className="grid lg:grid-cols-12 gap-10 items-stretch">
                <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
                  <p className="text-sm font-medium text-blue-700">
                    Verified Residential Electrical & Plumbing Dispatch
                  </p>
                  <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-tight" style={{ textWrap: 'balance' }}>
                    Certified Electricians and Plumbers at Your Doorstep
                  </h1>
                  <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                    Book a police-verified technician online with photo diagnostics and Razorpay-secured payment, or call our dispatch desk for assisted booking.
                  </p>
                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    <button
                      type="button"
                      onClick={() => setAuthView('register')}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                    >
                      <span>Create Account & Book</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthView('login')}
                      className="px-6 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                    >
                      Customer Login
                    </button>
                  </div>
                </div>
                <div className="lg:col-span-6">
                  <div className="h-full min-h-[320px] rounded-xl overflow-hidden border border-slate-200 bg-slate-200">
                    <img
                      src={heroImg}
                      alt="Certified residential electrician inspecting distribution panel"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Services Section (Dynamic from Admin Service Management) */}
            <section id="services" className="bg-white border-y border-slate-200 py-16">
              <div className="max-w-7xl mx-auto px-6 space-y-12">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold text-blue-700">Our Services / हमारी सेवाएँ</p>
                  <h2 className="text-3xl font-bold text-slate-900 mt-1">Verified Electrician & Plumber Services</h2>
                  <p className="text-slate-600 mt-2">
                    Transparent pricing managed directly by our operations team. Every technician is document-verified and police-cleared.
                  </p>
                </div>

                {activeServices.length === 0 ? (
                  <div className="border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
                    No active services available right now. Please check back soon or call our booking desk.
                  </div>
                ) : (
                  db.service_categories
                    .filter((c) => c.is_active)
                    .sort((a, b) => a.display_order - b.display_order)
                    .map((cat) => {
                      const catServices = activeServices.filter((s) => s.category_id === cat.id);
                      if (catServices.length === 0) return null;
                      const catSlug = (cat.slug === 'plumber' ? 'plumber' : 'electrician') as ServiceCategory;
                      const fallbackImg = catSlug === 'plumber' ? plumbImg : elecImg;
                      return (
                        <div key={cat.id} className="space-y-5">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <h3 className="text-xl font-bold text-slate-900 inline-flex items-center gap-2">
                              {catSlug === 'plumber' ? (
                                <Droplets className="w-5 h-5 text-blue-700" />
                              ) : (
                                <Zap className="w-5 h-5 text-blue-700" />
                              )}
                              <span>{cat.name} Services</span>
                            </h3>
                            <span className="text-xs font-mono-tabular text-slate-500">
                              {catServices.length} Service{catServices.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {catServices.map((svc) => (
                              <div key={svc.id} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex flex-col">
                                <div className="aspect-[4/3] bg-slate-200 overflow-hidden">
                                  <img
                                    src={svc.image_data_url || fallbackImg}
                                    alt={svc.service_name}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                                  <div>
                                    <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                                      <span className="text-blue-700">{cat.name}</span>
                                      <span className="text-slate-500">{formatPricingTypeLabel(svc.pricing_type)}</span>
                                    </div>
                                    <h4 className="text-base font-bold text-slate-900 mt-1.5">{svc.service_name}</h4>
                                    <p className="text-sm text-slate-600 mt-1.5">{svc.description}</p>
                                  </div>
                                  <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                                    <span className="text-base font-bold font-mono-tabular text-slate-900">
                                      {formatServiceCharge(svc.price, svc.pricing_type)}
                                    </span>
                                    {svc.is_available ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCategory(catSlug);
                                          setSelectedServiceId(svc.id);
                                          setAuthView('register');
                                        }}
                                        className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                                      >
                                        <span>Book Now</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                      </button>
                                    ) : (
                                      <span className="text-xs font-medium text-amber-700">Currently Unavailable</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </section>

            {/* Booking Methods Section */}
            <section id="booking-methods" className="max-w-7xl mx-auto px-6 py-16">
              <h2 className="text-3xl font-bold text-slate-900 mb-8">Two Ways to Book</h2>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                  <p className="text-xs font-semibold text-blue-700">Method A</p>
                  <h3 className="text-xl font-bold text-slate-900">Online Self-Service Booking</h3>
                  <p className="text-sm text-slate-600">
                    Register with mobile OTP, upload photos of the electrical or plumbing issue, pick your preferred date and time, and pay securely via Razorpay to receive an instant Booking ID.
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                  <p className="text-xs font-semibold text-blue-700">Method B</p>
                  <h3 className="text-xl font-bold text-slate-900">Booking Through Phone Call</h3>
                  <p className="text-sm text-slate-600">
                    Prefer speaking to our dispatch team? Call us directly, explain the issue, and our administrator will log your booking and send a verified payment link before confirmation.
                  </p>
                  <div className="pt-2 flex items-center gap-2 text-lg font-bold font-mono-tabular text-slate-900">
                    <Phone className="w-5 h-5 text-blue-700" />
                    <span>+91 1800-419-2080</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Workflow Section */}
            <section id="workflow" className="bg-white border-t border-slate-200 py-14">
              <div className="max-w-7xl mx-auto px-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">End-to-End Service Verification</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { step: '01', title: 'OTP & Payment', desc: 'Verify your mobile number and confirm your booking through Razorpay.' },
                    { step: '02', title: 'Verified Dispatch', desc: 'Admin assigns an approved, police-verified technician to your address.' },
                    { step: '03', title: 'Photo Proof', desc: 'Technician uploads work completion photos and notes upon finishing.' },
                    { step: '04', title: 'Confirm & Rate', desc: 'Inspect completion photos, confirm the job, and submit a 1–5 star review.' },
                  ].map((item) => (
                    <div key={item.step} className="space-y-2 border-t border-slate-200 pt-4">
                      <span className="text-xs font-mono-tabular font-semibold text-blue-700">{item.step}</span>
                      <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                      <p className="text-sm text-slate-600">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Genuine Customer Reviews Section */}
            <section id="reviews" className="max-w-7xl mx-auto px-6 py-16">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900">Verified Customer Reviews</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    {genuineVisibleReviews.length > 0
                      ? `Average Rating: ${averageCustomerRating} / 5.0 from ${genuineVisibleReviews.length} completed booking${genuineVisibleReviews.length > 1 ? 's' : ''}`
                      : 'Genuine ratings appear here once customers confirm completed bookings.'}
                  </p>
                </div>
                {genuineVisibleReviews.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllReviewsModal(true)}
                    className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-800 rounded-lg whitespace-nowrap"
                  >
                    View All Reviews ({genuineVisibleReviews.length})
                  </button>
                )}
              </div>

              {genuineVisibleReviews.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
                  No completed booking reviews published yet.
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {genuineVisibleReviews.slice(0, 4).map((r) => {
                    const cust = db.users.find((u) => u.id === r.user_id);
                    const initials = (cust?.full_name || 'Verified Customer')
                      .split(' ')
                      .map((p) => p[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();
                    return (
                      <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-1 text-amber-500">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`w-4 h-4 ${i < r.rating ? 'fill-amber-500 text-amber-500' : 'text-slate-300'}`} />
                            ))}
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed">{r.written_feedback}</p>
                        </div>
                        <div className="border-t border-slate-100 pt-3 flex items-center gap-3 text-xs text-slate-500">
                          {cust?.profile_image ? (
                            <img
                              src={cust.profile_image}
                              alt={cust.full_name}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-semibold flex items-center justify-center shrink-0">
                              {initials}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{cust?.full_name || 'Verified Customer'}</p>
                            <p className="capitalize mt-0.5 truncate">
                              {r.provider_type} Service · {new Date(r.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {showAllReviewsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                  <div className="w-full max-w-3xl max-h-[85vh] bg-white rounded-xl overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">All Verified Customer Reviews</h3>
                        <p className="text-xs text-slate-500">
                          Average Rating: {averageCustomerRating} / 5.0 · {genuineVisibleReviews.length} Review{genuineVisibleReviews.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <button type="button" onClick={() => setShowAllReviewsModal(false)}><X className="w-5 h-5 text-slate-500" /></button>
                    </div>
                    <div className="p-6 overflow-y-auto divide-y divide-slate-200 space-y-4">
                      {genuineVisibleReviews.map((r) => {
                        const cust = db.users.find((u) => u.id === r.user_id);
                        const initials = (cust?.full_name || 'Verified Customer')
                          .split(' ')
                          .map((p) => p[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase();
                        return (
                          <div key={r.id} className="pt-4 first:pt-0 space-y-1.5">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                {cust?.profile_image ? (
                                  <img
                                    src={cust.profile_image}
                                    alt={cust.full_name}
                                    className="w-7 h-7 rounded-full object-cover border border-slate-200"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold flex items-center justify-center">
                                    {initials}
                                  </div>
                                )}
                                <span className="text-sm font-semibold text-slate-900">{cust?.full_name || 'Verified Customer'}</span>
                              </div>
                              <span className="text-xs font-mono-tabular text-slate-500">{new Date(r.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <span className="font-semibold text-amber-600">{r.rating} / 5 Stars</span>
                              <span>·</span>
                              <span className="capitalize">{r.provider_type} Service</span>
                            </div>
                            <p className="text-sm text-slate-700">{r.written_feedback}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </main>
        )}

        {authView === 'login' && (
          <main className="flex-1 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Customer Sign In</h1>
                <p className="text-sm text-slate-600 mt-1">Access your bookings, receipts, and service tracking.</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    required
                    value={loginMobile}
                    onChange={(e) => setLoginMobile(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
                {authError && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{authError}</p>}
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Sign In
                </button>
              </form>
              <p className="text-xs text-slate-600 text-center">
                New customer?{' '}
                <button type="button" onClick={() => { setAuthError(null); setAuthView('register'); }} className="text-blue-700 font-semibold hover:underline">
                  Register with Mobile OTP
                </button>
              </p>
            </div>
          </main>
        )}

        {authView === 'register' && (
          <main className="flex-1 flex items-center justify-center p-6">
            <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl p-8 space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Customer Registration</h1>
                <p className="text-sm text-slate-600 mt-1">Verify your mobile number via OTP to create your service account.</p>
              </div>
              <form onSubmit={handleRegister} className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Real Full Name</label>
                  <input
                    type="text"
                    required
                    value={regForm.full_name}
                    onChange={(e) => setRegForm({ ...regForm, full_name: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
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
                      placeholder="10-digit mobile"
                      className="flex-1 px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
                    >
                      Send OTP
                    </button>
                  </div>
                </div>

                {sentOtpPreview && (
                  <div className="sm:col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
                    OTP dispatched (SMS Gateway ready). Verification Code: <span className="font-mono-tabular font-bold">{sentOtpPreview}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Enter Mobile OTP</label>
                  <input
                    type="text"
                    required
                    value={regForm.otp_code}
                    onChange={(e) => setRegForm({ ...regForm, otp_code: e.target.value })}
                    placeholder="6-digit OTP"
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={regForm.password}
                    onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Complete Address</label>
                  <input
                    type="text"
                    required
                    value={regForm.address}
                    onChange={(e) => setRegForm({ ...regForm, address: e.target.value })}
                    placeholder="House No, Street, Landmark"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Village / City</label>
                  <input
                    type="text"
                    required
                    value={regForm.village_city}
                    onChange={(e) => setRegForm({ ...regForm, village_city: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">District</label>
                  <input
                    type="text"
                    required
                    value={regForm.district}
                    onChange={(e) => setRegForm({ ...regForm, district: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    required
                    value={regForm.state}
                    onChange={(e) => setRegForm({ ...regForm, state: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">PIN Code</label>
                  <input
                    type="text"
                    required
                    value={regForm.pin_code}
                    onChange={(e) => setRegForm({ ...regForm, pin_code: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>

                {authError && (
                  <p className="sm:col-span-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{authError}</p>
                )}

                <div className="sm:col-span-2 pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Verify OTP & Create Account
                  </button>
                </div>
              </form>
              <p className="text-xs text-slate-600 text-center">
                Already registered?{' '}
                <button type="button" onClick={() => { setAuthError(null); setAuthView('login'); }} className="text-blue-700 font-semibold hover:underline">
                  Sign In
                </button>
              </p>
            </div>
          </main>
        )}

        <footer className="bg-white border-t border-slate-200 py-6">
          <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <span>© {new Date().getFullYear()} Volt & Valve Home Services.</span>
            <span>Customer Support & Phone Booking: +91 1800-419-2080</span>
          </div>
        </footer>
      </div>
    );
  }

  // AUTHENTICATED USER DASHBOARD
  const selectedBooking = userBookings.find((b) => b.id === selectedBookingId) || null;

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform lg:static lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <span className="text-lg font-bold text-slate-900">Volt & Valve</span>
          <button type="button" onClick={() => setMobileMenuOpen(false)} className="lg:hidden p-1 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-900 truncate">{user.full_name}</p>
          <p className="text-xs text-slate-500 font-mono-tabular">{user.mobile_number}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'services', label: 'Our Services / हमारी सेवाएँ', Icon: Layers },
            { id: 'book', label: 'Book Service', Icon: Calendar },
            { id: 'bookings', label: 'My Bookings', Icon: ClipboardList },
            { id: 'payments', label: 'Payments & Receipts', Icon: CreditCard },
            { id: 'vouchers', label: `Gift Vouchers (${userAvailableVouchers.length})`, Icon: Tag },
            { id: 'notifications', label: `Notifications (${userNotifications.filter((n) => !n.is_read).length})`, Icon: Bell },
            { id: 'profile', label: 'Profile Settings', Icon: UserIcon },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id as typeof activeTab);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-red-700 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-1.5 border border-slate-200 rounded-lg">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-slate-900">
              {activeTab === 'services' && 'Our Services / हमारी सेवाएँ'}
              {activeTab === 'book' && 'Book Electrician or Plumber'}
              {activeTab === 'bookings' && 'Booking History & Live Tracking'}
              {activeTab === 'payments' && 'Payment History & Receipts'}
              {activeTab === 'vouchers' && 'Gift Vouchers & Redemption History'}
              {activeTab === 'notifications' && 'Notifications'}
              {activeTab === 'profile' && 'Customer Profile'}
            </h1>
          </div>
          <div className="text-xs text-slate-500 hidden sm:block">
            Phone Booking Desk: <span className="font-mono-tabular font-semibold text-slate-900">+91 1800-419-2080</span>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-6xl w-full mx-auto space-y-6">
          {/* OUR SERVICES CATALOG TAB */}
          {activeTab === 'services' && (
            <div className="space-y-8">
              {activeServices.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
                  No active services are currently listed. Please contact our support desk.
                </div>
              ) : (
                db.service_categories
                  .filter((c) => c.is_active)
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((cat) => {
                    const catServices = activeServices.filter((s) => s.category_id === cat.id);
                    if (catServices.length === 0) return null;
                    const catSlug = (cat.slug === 'plumber' ? 'plumber' : 'electrician') as ServiceCategory;
                    const fallbackImg = catSlug === 'plumber' ? plumbImg : elecImg;
                    return (
                      <section key={cat.id} className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                          <h2 className="text-base font-bold text-slate-900 inline-flex items-center gap-2">
                            {catSlug === 'plumber' ? (
                              <Droplets className="w-4 h-4 text-blue-700" />
                            ) : (
                              <Zap className="w-4 h-4 text-blue-700" />
                            )}
                            <span>{cat.name} Services</span>
                          </h2>
                          <span className="text-xs font-mono-tabular text-slate-500">
                            {catServices.length} Service{catServices.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                          {catServices.map((svc) => (
                            <div key={svc.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                              <div className="aspect-[16/10] bg-slate-100 overflow-hidden">
                                <img
                                  src={svc.image_data_url || fallbackImg}
                                  alt={svc.service_name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                <div>
                                  <div className="flex items-center justify-between text-[11px] font-semibold">
                                    <span className="text-blue-700">{cat.name}</span>
                                    <span className="text-slate-500">{formatPricingTypeLabel(svc.pricing_type)}</span>
                                  </div>
                                  <h3 className="text-sm font-bold text-slate-900 mt-1">{svc.service_name}</h3>
                                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">{svc.description}</p>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                  <span className="text-sm font-bold font-mono-tabular text-slate-900">
                                    {formatServiceCharge(svc.price, svc.pricing_type)}
                                  </span>
                                  {svc.is_available ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCategory(catSlug);
                                        setSelectedServiceId(svc.id);
                                        setAppliedVoucher(null);
                                        setVoucherError(null);
                                        setReviewStep(false);
                                        setActiveTab('book');
                                      }}
                                      className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg"
                                    >
                                      Book Now
                                    </button>
                                  ) : (
                                    <span className="text-[11px] font-medium text-amber-700">Unavailable</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  })
              )}
            </div>
          )}

          {/* BOOK SERVICE TAB */}
          {activeTab === 'book' && (
            <div className="grid lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Select Active Service</h2>
                  <div className="grid sm:grid-cols-2 gap-3 mt-3">
                    {activeServices.filter((s) => s.is_available).map((svc) => {
                      const cat = db.service_categories.find((c) => c.id === svc.category_id);
                      const catSlug = (cat?.slug === 'plumber' ? 'plumber' : 'electrician') as ServiceCategory;
                      const isSel = selectedService?.id === svc.id;
                      return (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => {
                            setCategory(catSlug);
                            setSelectedServiceId(svc.id);
                            setAppliedVoucher(null);
                            setVoucherError(null);
                          }}
                          className={`p-4 rounded-xl border text-left transition-colors ${
                            isSel ? 'border-blue-700 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 font-semibold text-slate-900 text-sm">
                            <span className="inline-flex items-center gap-1.5">
                              {catSlug === 'plumber' ? <Droplets className="w-4 h-4 text-blue-700" /> : <Zap className="w-4 h-4 text-blue-700" />}
                              <span>{svc.service_name}</span>
                            </span>
                            <span className="font-mono-tabular text-blue-800 whitespace-nowrap">{formatServiceCharge(svc.price, svc.pricing_type)}</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2">{svc.description}</p>
                          <p className="text-[11px] text-slate-500 mt-1.5">
                            {cat?.name} · {formatPricingTypeLabel(svc.pricing_type)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {!reviewStep ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">Describe the Problem in Detail</label>
                      <textarea
                        rows={4}
                        value={problemDesc}
                        onChange={(e) => setProblemDesc(e.target.value)}
                        placeholder="Describe symptoms, room location, or faulty appliance/pipe..."
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">Upload Problem Photos (Optional, Multiple)</label>
                      <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer">
                        <Upload className="w-4 h-4" />
                        <span>Choose Photos</span>
                        <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
                      </label>
                      {problemPhotos.length > 0 && (
                        <div className="grid grid-cols-4 gap-3 mt-3">
                          {problemPhotos.map((p, idx) => (
                            <div key={idx} className="relative border border-slate-200 rounded-lg overflow-hidden aspect-square bg-slate-100">
                              <img src={p.file_data_url} alt={p.original_name} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">Complete Service Address</label>
                      <textarea
                        rows={2}
                        value={serviceAddress}
                        onChange={(e) => setServiceAddress(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">Preferred Date</label>
                        <input
                          type="date"
                          value={prefDate}
                          onChange={(e) => setPrefDate(e.target.value)}
                          className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">Preferred Time Slot</label>
                        <select
                          value={prefTime}
                          onChange={(e) => setPrefTime(e.target.value)}
                          className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                        >
                          <option>09:00 AM - 11:00 AM</option>
                          <option>10:00 AM - 12:00 PM</option>
                          <option>12:00 PM - 02:00 PM</option>
                          <option>03:00 PM - 05:00 PM</option>
                          <option>05:00 PM - 07:00 PM</option>
                        </select>
                      </div>
                    </div>

                    {bookingError && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{bookingError}</p>}

                    <button
                      type="button"
                      onClick={() => {
                        if (!problemDesc.trim() || !serviceAddress.trim()) {
                          setBookingError('Please fill in problem description and service address.');
                          return;
                        }
                        setBookingError(null);
                        setReviewStep(true);
                      }}
                      className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      Review Booking Details
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 border-t border-slate-200 pt-4">
                    <h3 className="text-base font-bold text-slate-900">Review Booking & Payment Summary</h3>
                    <dl className="grid sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-slate-500">Customer Name (User ID #{user.id})</dt>
                        <dd className="font-semibold text-slate-900">{user.full_name}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Mobile Number</dt>
                        <dd className="font-semibold font-mono-tabular text-slate-900">{user.mobile_number}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Selected Service</dt>
                        <dd className="font-semibold text-slate-900">
                          {selectedService?.service_name || `${category} Service`}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Schedule</dt>
                        <dd className="font-semibold font-mono-tabular">{prefDate} · {prefTime}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-slate-500">Service Address</dt>
                        <dd className="text-slate-800">{serviceAddress}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-slate-500">Problem Description</dt>
                        <dd className="text-slate-800">{problemDesc}</dd>
                      </div>
                      {selectedService?.pricing_type === 'custom_quote' ? (
                        <div className="sm:col-span-2 border border-amber-200 bg-amber-50 rounded-lg p-3.5 text-xs text-amber-900 space-y-1">
                          <p className="font-semibold">Custom Quotation Service</p>
                          <p>
                            Final service charge will be determined after on-site inspection and quotation confirmation. No online payment is collected before price confirmation.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="sm:col-span-2 border-t border-slate-200 pt-3 space-y-2">
                            <label className="block text-xs font-medium text-slate-700">Apply Gift Voucher Code (Optional)</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={voucherCodeInput}
                                onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
                                placeholder="Enter voucher code"
                                className="flex-1 px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-lg uppercase"
                              />
                              <button
                                type="button"
                                onClick={handleApplyVoucher}
                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
                              >
                                Apply
                              </button>
                            </div>
                            {voucherError && <p className="text-xs text-red-700">{voucherError}</p>}
                            {appliedVoucher && (
                              <p className="text-xs text-emerald-700 font-medium">
                                Voucher {appliedVoucher.code} applied — Discount: ₹{appliedVoucher.discount.toFixed(2)}
                              </p>
                            )}
                          </div>

                          <div className="sm:col-span-2 border-t border-slate-200 pt-3 flex items-center justify-between">
                            <div>
                              <dt className="text-xs text-slate-500">Service Price & Discount</dt>
                              <dd className="text-xs text-slate-600 font-mono-tabular">
                                Service Price: ₹{baseBookingAmount.toFixed(2)}
                                {appliedVoucher ? ` − Voucher Discount: ₹${appliedVoucher.discount.toFixed(2)}` : ''}
                              </dd>
                            </div>
                            <div className="text-right">
                              <dt className="text-xs text-slate-500">Final Payable Amount</dt>
                              <dd className="text-lg font-bold font-mono-tabular text-slate-900">
                                ₹{(appliedVoucher ? appliedVoucher.finalAmount : baseBookingAmount).toFixed(2)}
                              </dd>
                            </div>
                          </div>
                        </>
                      )}
                    </dl>
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleProceedToPayment}
                        className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors"
                      >
                        {selectedService?.pricing_type === 'custom_quote'
                          ? 'Submit Quote & Inspection Request'
                          : `Pay Now – ₹${(appliedVoucher ? appliedVoucher.finalAmount : baseBookingAmount).toFixed(2)}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setReviewStep(false)}
                        className="px-4 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50"
                      >
                        Edit Details
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-4 space-y-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-slate-900">Method B: Phone Call Booking</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Need help describing the issue? Call our dispatch desk. Our Admin team will create your booking manually and send a Razorpay payment link to confirm.
                  </p>
                  <p className="text-base font-bold font-mono-tabular text-blue-700">+91 1800-419-2080</p>
                </div>
              </div>
            </div>
          )}

          {/* MY BOOKINGS TAB */}
          {activeTab === 'bookings' && (
            <div className="grid lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">Your Bookings ({userBookings.length})</h2>
                </div>
                {userBookings.length === 0 ? (
                  <div className="p-8 text-center space-y-3">
                    <p className="text-sm text-slate-600">You have not created any service bookings yet.</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('book')}
                      className="px-4 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg"
                    >
                      Book Your First Service
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {userBookings.map((b) => {
                      const payment = db.payments.find((p) => p.booking_id === b.id);
                      return (
                        <div
                          key={b.id}
                          onClick={() => setSelectedBookingId(b.id)}
                          className={`p-4 cursor-pointer transition-colors hover:bg-slate-50 ${
                            selectedBookingId === b.id ? 'bg-blue-50/50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono-tabular text-sm font-bold text-slate-900">{b.booking_code}</span>
                            <StatusIndicator status={b.status} />
                          </div>
                          <p className="text-xs text-slate-600 mt-1 capitalize">
                            {b.service_category} · {b.preferred_date} · {b.preferred_time}
                          </p>
                          <p className="text-xs text-slate-700 mt-1 line-clamp-1">{b.problem_description}</p>
                          {b.status === 'Payment Pending' && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {payment && <StatusIndicator status={payment.payment_status} />}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const retry = createRetryPaymentOrder(b.id);
                                  if (retry.order_id) {
                                    setRzpCheckout({
                                      bookingId: b.id,
                                      bookingCode: b.booking_code,
                                      orderId: retry.order_id,
                                      amount: b.booking_amount,
                                      serviceName: b.service_name_snapshot || `${b.service_category} Service`,
                                    });
                                  }
                                }}
                                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-md"
                              >
                                {payment?.payment_status === 'failed' ? `Retry Payment (₹${b.booking_amount})` : `Pay Now – ₹${b.booking_amount}`}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="lg:col-span-5">
                {selectedBooking ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div>
                        <p className="text-xs text-slate-500">Booking ID</p>
                        <p className="font-mono-tabular font-bold text-slate-900">{selectedBooking.booking_code}</p>
                      </div>
                      <StatusIndicator status={selectedBooking.status} />
                    </div>

                    {/* Assigned Provider */}
                    {selectedBooking.assigned_provider_id && (
                      <div className="text-xs space-y-1 border-b border-slate-200 pb-3">
                        <p className="font-semibold text-slate-900">Assigned Service Provider</p>
                        {(() => {
                          const list = selectedBooking.assigned_provider_type === 'electrician' ? db.electricians : db.plumbers;
                          const prov = list.find((p) => p.id === selectedBooking.assigned_provider_id);
                          return prov ? (
                            <p className="text-slate-700">
                              {prov.full_name} · {prov.mobile_number} · Rating: {prov.average_rating || 'New'}/5
                            </p>
                          ) : null;
                        })()}
                      </div>
                    )}

                    {/* Status Timeline */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-900">Status Timeline</p>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {db.booking_status_history
                          .filter((h) => h.booking_id === selectedBooking.id)
                          .map((h) => (
                            <div key={h.id} className="text-xs border-b border-slate-100 pb-2">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-800">{h.status}</span>
                                <span className="font-mono-tabular text-slate-500">
                                  {new Date(h.changed_at).toLocaleString()}
                                </span>
                              </div>
                              {h.remarks && <p className="text-slate-600 mt-0.5">{h.remarks}</p>}
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Work Completion Photos & Customer Review */}
                    {(selectedBooking.status === 'Work Completed' ||
                      selectedBooking.status === 'Customer Review Pending' ||
                      selectedBooking.status === 'Completed and Reviewed') && (
                      <div className="space-y-3 border-t border-slate-200 pt-3">
                        <p className="text-xs font-semibold text-slate-900">Work Completion Photos & Notes</p>
                        {selectedBooking.completion_description && (
                          <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            {selectedBooking.completion_description}
                          </p>
                        )}
                        <div className="grid grid-cols-3 gap-2">
                          {db.work_completion_photos
                            .filter((w) => w.booking_id === selectedBooking.id)
                            .map((w) => (
                              <img key={w.id} src={w.file_data_url} alt={w.original_name} className="w-full aspect-square object-cover rounded-lg border border-slate-200" />
                            ))}
                        </div>

                        {(selectedBooking.status === 'Work Completed' || selectedBooking.status === 'Customer Review Pending') && (
                          <div className="space-y-3 border-t border-slate-200 pt-3">
                            <p className="text-xs font-bold text-slate-900">Confirm Completion & Submit Review</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {[
                                { key: 'rating', label: 'Overall Rating (1-5)' },
                                { key: 'service_quality', label: 'Service Quality' },
                                { key: 'provider_behaviour', label: 'Technician Behaviour' },
                                { key: 'work_satisfaction', label: 'Work Satisfaction' },
                              ].map((field) => (
                                <div key={field.key}>
                                  <label className="block text-slate-600 mb-1">{field.label}</label>
                                  <select
                                    value={reviewForm[field.key as keyof typeof reviewForm]}
                                    onChange={(e) => setReviewForm({ ...reviewForm, [field.key]: Number(e.target.value) })}
                                    className="w-full px-2 py-1.5 border border-slate-300 rounded-md"
                                  >
                                    {[5, 4, 3, 2, 1].map((n) => (
                                      <option key={n} value={n}>{n} Star{n > 1 ? 's' : ''}</option>
                                    ))}
                                  </select>
                                </div>
                              ))}
                            </div>
                            <textarea
                              rows={2}
                              value={reviewForm.written_feedback}
                              onChange={(e) => setReviewForm({ ...reviewForm, written_feedback: e.target.value })}
                              placeholder="Write your feedback about the completed service..."
                              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                            />
                            {reviewMessage && <p className="text-xs text-emerald-700">{reviewMessage}</p>}
                            <button
                              type="button"
                              onClick={() => handleSubmitReview(selectedBooking)}
                              className="w-full py-2 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg"
                            >
                              Confirm Work Completed & Submit Review
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
                    Select a booking on the left to view live timeline, technician details, completion photos, and review options.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PAYMENTS TAB */}
          {activeTab === 'payments' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-sm font-bold text-slate-900">Payment History & Receipts</h2>
              </div>
              {userPayments.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">No payment transactions recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4">Booking ID</th>
                        <th className="py-3 px-4">Service Name</th>
                        <th className="py-3 px-4">Razorpay Payment ID</th>
                        <th className="py-3 px-4">Method</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Receipt / Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {userPayments.map((p) => {
                        const b = db.bookings.find((bk) => bk.id === p.booking_id);
                        const svcLabel = b?.service_name_snapshot || (b ? `${b.service_category} Service` : 'Service');
                        return (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-mono-tabular font-semibold">{b?.booking_code || `#${p.booking_id}`}</td>
                            <td className="py-3 px-4 capitalize text-slate-700">{svcLabel}</td>
                            <td className="py-3 px-4 font-mono-tabular text-slate-600">{p.razorpay_payment_id || 'Pending'}</td>
                            <td className="py-3 px-4 uppercase text-slate-600">{p.payment_method}</td>
                            <td className="py-3 px-4 text-right font-mono-tabular font-semibold">₹{p.amount.toFixed(2)}</td>
                            <td className="py-3 px-4"><StatusIndicator status={p.payment_status} /></td>
                            <td className="py-3 px-4 font-mono-tabular text-slate-600">{new Date(p.paid_at || p.created_at).toLocaleDateString()}</td>
                            <td className="py-3 px-4">
                              {p.payment_status === 'success' ? (
                                <button
                                  type="button"
                                  onClick={() => window.print()}
                                  className="inline-flex items-center gap-1 text-blue-700 font-semibold hover:underline"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>Print</span>
                                </button>
                              ) : b?.status === 'Payment Pending' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const retry = createRetryPaymentOrder(b.id);
                                    if (retry.order_id) {
                                      setRzpCheckout({
                                        bookingId: b.id,
                                        bookingCode: b.booking_code,
                                        orderId: retry.order_id,
                                        amount: b.booking_amount,
                                        serviceName: svcLabel,
                                      });
                                    }
                                  }}
                                  className="text-blue-700 font-semibold hover:underline"
                                >
                                  Retry Payment
                                </button>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
              {userNotifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">No notifications yet.</div>
              ) : (
                userNotifications.map((n) => (
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

          {/* GIFT VOUCHERS TAB */}
          {activeTab === 'vouchers' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h2 className="text-sm font-bold text-slate-900">Available Gift Vouchers ({userAvailableVouchers.length})</h2>
                {userAvailableVouchers.length === 0 ? (
                  <p className="text-xs text-slate-500">No active gift vouchers available for your account right now.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {userAvailableVouchers.map((v) => (
                      <div key={v.id} className="border border-slate-200 rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono-tabular text-sm font-bold text-blue-700">{v.voucher_code}</span>
                          <span className="text-xs text-slate-500 font-mono-tabular">Exp: {v.expiry_date}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{v.voucher_name}</p>
                        <p className="text-xs text-slate-600">{v.description}</p>
                        <p className="text-xs font-mono-tabular text-slate-700">
                          {v.discount_type === 'fixed' ? `Flat ₹${v.discount_value} off` : `${v.discount_value}% off`} · Min ₹{v.min_booking_amount}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setVoucherCodeInput(v.voucher_code);
                            setActiveTab('book');
                          }}
                          className="text-xs font-semibold text-blue-700 hover:underline"
                        >
                          Use on Next Booking
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200">
                  <h2 className="text-sm font-bold text-slate-900">Redeemed Voucher History</h2>
                </div>
                {userVoucherRedemptions.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">You have not redeemed any vouchers yet.</div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                        <th className="py-3 px-4">Voucher Code</th>
                        <th className="py-3 px-4">Booking ID</th>
                        <th className="py-3 px-4 text-right">Discount Saved</th>
                        <th className="py-3 px-4 text-right">Final Paid</th>
                        <th className="py-3 px-4">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {userVoucherRedemptions.map((r) => {
                        const v = db.gift_vouchers.find((x) => x.id === r.voucher_id);
                        const b = db.bookings.find((x) => x.id === r.booking_id);
                        return (
                          <tr key={r.id}>
                            <td className="py-3 px-4 font-mono-tabular font-semibold">{v?.voucher_code}</td>
                            <td className="py-3 px-4 font-mono-tabular">{b?.booking_code}</td>
                            <td className="py-3 px-4 text-right font-mono-tabular text-emerald-700">₹{r.discount_amount.toFixed(2)}</td>
                            <td className="py-3 px-4 text-right font-mono-tabular font-semibold">₹{r.final_amount.toFixed(2)}</td>
                            <td className="py-3 px-4 font-mono-tabular">{new Date(r.redeemed_at).toLocaleDateString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="bg-white border border-slate-200 rounded-xl p-6 max-w-2xl space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Mobile Number (Verified)</label>
                  <input
                    type="text"
                    disabled
                    value={user.mobile_number}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular bg-slate-100 border border-slate-200 rounded-lg text-slate-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Address</label>
                  <input
                    type="text"
                    required
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Village / City</label>
                  <input
                    type="text"
                    required
                    value={profileForm.village_city}
                    onChange={(e) => setProfileForm({ ...profileForm, village_city: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">District</label>
                  <input
                    type="text"
                    required
                    value={profileForm.district}
                    onChange={(e) => setProfileForm({ ...profileForm, district: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    required
                    value={profileForm.state}
                    onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">PIN Code</label>
                  <input
                    type="text"
                    required
                    value={profileForm.pin_code}
                    onChange={(e) => setProfileForm({ ...profileForm, pin_code: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              {profileSaved && (
                <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Profile updated successfully.</span>
                </p>
              )}
              <button
                type="submit"
                className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg"
              >
                Save Profile Changes
              </button>
            </form>
          )}
        </main>
      </div>

      {rzpCheckout && (
        <RazorpayModal
          bookingId={rzpCheckout.bookingId}
          bookingCode={rzpCheckout.bookingCode}
          orderId={rzpCheckout.orderId}
          amount={rzpCheckout.amount}
          serviceName={rzpCheckout.serviceName}
          customerName={user.full_name}
          customerMobile={user.mobile_number}
          actorRole="user"
          actorId={user.id}
          onSuccess={() => {
            setRzpCheckout(null);
            setReviewStep(false);
            setProblemDesc('');
            setProblemPhotos([]);
            setActiveTab('bookings');
            setSelectedBookingId(rzpCheckout.bookingId);
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
