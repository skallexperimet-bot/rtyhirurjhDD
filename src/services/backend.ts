import {
  AppDatabase,
  BookingRecord,
  BookingStatus,
  CustomerReview,
  GiftVoucher,
  ProviderAccount,
  ServiceCategory,
  ServiceCategoryItem,
  ServiceItem,
  UserAccount,
  UserRole,
} from '../types';

const STORAGE_KEY = 'volt_valve_db_v1';

const INITIAL_DB: AppDatabase = {
  users: [],
  electricians: [],
  plumbers: [],
  admin_users: [
    {
      id: 1,
      full_name: 'System Administrator',
      email: 'admin@voltvalve.in',
      mobile_number: '9999999999',
      password_hash: 'Admin@123',
      role: 'super_admin',
      is_active: true,
    },
  ],
  otp_verifications: [],
  provider_documents: [],
  bookings: [],
  booking_images: [],
  booking_status_history: [],
  payments: [],
  electrician_service_charges: [],
  electrician_payouts: [],
  work_completion_photos: [],
  customer_reviews: [],
  notifications: [],
  service_categories: [
    { id: 1, slug: 'electrician', name: 'Electrician', is_active: true, display_order: 1, created_at: '2026-01-01T00:00:00.000Z' },
    { id: 2, slug: 'plumber', name: 'Plumber', is_active: true, display_order: 2, created_at: '2026-01-01T00:00:00.000Z' },
  ],
  services: [
    {
      id: 1,
      category_id: 1,
      service_name: 'Switch & Socket Installation',
      description: 'Modular switchboard fitting, power socket replacement, regulator installation, and loose connection repair.',
      image_data_url: '',
      price: 199,
      pricing_type: 'fixed',
      is_available: true,
      is_active: true,
      display_order: 1,
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 2,
      category_id: 1,
      service_name: 'Ceiling Fan Installation & Repair',
      description: 'New ceiling or exhaust fan mounting, capacitor replacement, humming noise fix, and speed regulator wiring.',
      image_data_url: '',
      price: 249,
      pricing_type: 'starting_at',
      is_available: true,
      is_active: true,
      display_order: 2,
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 3,
      category_id: 1,
      service_name: 'MCB, Fuse & Inverter Setup',
      description: 'MCB distribution board troubleshooting, short-circuit isolation, inverter/UPS wiring, and load balancing.',
      image_data_url: '',
      price: 399,
      pricing_type: 'fixed',
      is_available: true,
      is_active: true,
      display_order: 3,
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 4,
      category_id: 1,
      service_name: 'House Wiring & Electrical Fault Repair',
      description: 'Concealed or surface wiring repair, earthing check, and multi-point electrical diagnostics.',
      image_data_url: '',
      price: 250,
      pricing_type: 'hourly',
      is_available: true,
      is_active: true,
      display_order: 4,
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 5,
      category_id: 1,
      service_name: 'New Electricity Connection & Full House Wiring',
      description: 'Complete home rewiring, 3-phase load setup, and new meter board installation after on-site inspection.',
      image_data_url: '',
      price: 0,
      pricing_type: 'custom_quote',
      is_available: true,
      is_active: true,
      display_order: 5,
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 6,
      category_id: 2,
      service_name: 'Tap, Mixer & Shower Repair',
      description: 'Leaking tap cartridge replacement, wall mixer fitting, overhead shower installation, and angle valve repair.',
      image_data_url: '',
      price: 199,
      pricing_type: 'fixed',
      is_available: true,
      is_active: true,
      display_order: 6,
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 7,
      category_id: 2,
      service_name: 'Water Leakage & Pipe Repair',
      description: 'Concealed pipeline leak detection, CPVC/UPVC joint sealing, and pressure line repair.',
      image_data_url: '',
      price: 249,
      pricing_type: 'starting_at',
      is_available: true,
      is_active: true,
      display_order: 7,
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 8,
      category_id: 2,
      service_name: 'Wash Basin & Drainage Blockage Clearing',
      description: 'Wash basin mounting, bottle trap replacement, sink & bathroom drain unclogging.',
      image_data_url: '',
      price: 299,
      pricing_type: 'starting_at',
      is_available: true,
      is_active: true,
      display_order: 8,
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 9,
      category_id: 2,
      service_name: 'Water Tank Installation & Plumbing',
      description: 'Overhead tank installation, float valve setup, motor line connection, and pipeline maintenance.',
      image_data_url: '',
      price: 250,
      pricing_type: 'hourly',
      is_available: true,
      is_active: true,
      display_order: 9,
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 10,
      category_id: 2,
      service_name: 'Complete Bathroom Fitting & Pipeline Quotation',
      description: 'Full bathroom sanitaryware installation and concealed plumbing layout quoted after site inspection.',
      image_data_url: '',
      price: 0,
      pricing_type: 'custom_quote',
      is_available: true,
      is_active: true,
      display_order: 10,
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ],
  gift_vouchers: [],
  voucher_assignments: [],
  voucher_redemptions: [],
  review_visibility_logs: [],
};

export function loadDB(): AppDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DB));
      return structuredClone(INITIAL_DB);
    }
    const parsed = JSON.parse(raw) as AppDatabase;
    let migrated = false;
    if (!parsed.admin_users || parsed.admin_users.length === 0) {
      parsed.admin_users = structuredClone(INITIAL_DB.admin_users);
      migrated = true;
    }
    if (!parsed.service_categories) {
      parsed.service_categories = structuredClone(INITIAL_DB.service_categories);
      migrated = true;
    }
    if (!parsed.services) {
      parsed.services = structuredClone(INITIAL_DB.services);
      migrated = true;
    }
    if (!parsed.gift_vouchers) {
      parsed.gift_vouchers = [];
      migrated = true;
    }
    if (!parsed.voucher_assignments) {
      parsed.voucher_assignments = [];
      migrated = true;
    }
    if (!parsed.voucher_redemptions) {
      parsed.voucher_redemptions = [];
      migrated = true;
    }
    if (!parsed.review_visibility_logs) {
      parsed.review_visibility_logs = [];
      migrated = true;
    }
    if (migrated) {
      saveDB(parsed);
    }
    return parsed;
  } catch {
    return structuredClone(INITIAL_DB);
  }
}

export function saveDB(db: AppDatabase): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function nextId(items: { id: number }[]): number {
  return items.length === 0 ? 1 : Math.max(...items.map((i) => i.id)) + 1;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function pushNotification(
  db: AppDatabase,
  recipient_role: UserRole,
  recipient_id: number | null,
  event_type: string,
  title: string,
  message: string,
  related_booking_id: number | null = null
) {
  db.notifications.unshift({
    id: nextId(db.notifications),
    recipient_role,
    recipient_id,
    event_type,
    title,
    message,
    related_booking_id,
    is_read: false,
    created_at: nowIso(),
  });
}

export function addStatusHistory(
  db: AppDatabase,
  booking_id: number,
  status: BookingStatus,
  changed_by_role: UserRole | 'system',
  changed_by_id: number | null,
  remarks: string
) {
  db.booking_status_history.push({
    id: nextId(db.booking_status_history),
    booking_id,
    status,
    changed_by_role,
    changed_by_id,
    remarks,
    changed_at: nowIso(),
  });
}

export function sendOtp(mobile_number: string, role: 'user' | 'electrician' | 'plumber'): { otp: string } {
  const db = loadDB();
  db.otp_verifications.forEach((o) => {
    if (o.mobile_number === mobile_number && o.role === role) o.is_used = true;
  });
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  db.otp_verifications.push({
    id: nextId(db.otp_verifications),
    mobile_number,
    role,
    otp_code: otp,
    is_used: false,
    expires_at: Date.now() + 10 * 60 * 1000,
  });
  saveDB(db);
  return { otp };
}

export function verifyOtp(db: AppDatabase, mobile_number: string, role: 'user' | 'electrician' | 'plumber', otp_code: string): boolean {
  const match = db.otp_verifications.find(
    (o) => o.mobile_number === mobile_number && o.role === role && o.otp_code === otp_code && !o.is_used && o.expires_at > Date.now()
  );
  if (!match) return false;
  match.is_used = true;
  return true;
}

export function registerUser(input: {
  full_name: string;
  mobile_number: string;
  password: string;
  address: string;
  village_city: string;
  district: string;
  state: string;
  pin_code: string;
  otp_code: string;
}): { user?: UserAccount; error?: string } {
  const db = loadDB();
  if (db.users.some((u) => u.mobile_number === input.mobile_number)) {
    return { error: 'This mobile number is already registered.' };
  }
  if (!verifyOtp(db, input.mobile_number, 'user', input.otp_code)) {
    return { error: 'Invalid or expired OTP code.' };
  }
  const user: UserAccount = {
    id: nextId(db.users),
    full_name: input.full_name.trim(),
    mobile_number: input.mobile_number.trim(),
    password_hash: input.password,
    address: input.address.trim(),
    village_city: input.village_city.trim(),
    district: input.district.trim(),
    state: input.state.trim(),
    pin_code: input.pin_code.trim(),
    is_otp_verified: true,
    status: 'active',
    created_at: nowIso(),
  };
  db.users.unshift(user);
  pushNotification(db, 'admin', null, 'new_user', 'New User Registration', `${user.full_name} registered from ${user.village_city}.`);
  saveDB(db);
  return { user };
}

export function loginUser(mobile_number: string, password: string): { user?: UserAccount; error?: string } {
  const db = loadDB();
  const user = db.users.find((u) => u.mobile_number === mobile_number.trim());
  if (!user || user.password_hash !== password) {
    return { error: 'Invalid mobile number or password.' };
  }
  if (user.status === 'blocked') {
    return { error: 'Your account has been blocked by the administrator.' };
  }
  return { user };
}

export function registerProvider(input: {
  service_category: ServiceCategory;
  full_name: string;
  mobile_number: string;
  password: string;
  address: string;
  pin_code: string;
  qualification_details: string;
  experience_details: string;
  otp_code: string;
  documents: {
    document_type: 'qualification_certificate' | 'experience_certificate' | 'police_verification';
    file_data_url: string;
    original_name: string;
  }[];
}): { provider?: ProviderAccount; error?: string } {
  const db = loadDB();
  const list = input.service_category === 'electrician' ? db.electricians : db.plumbers;
  if (list.some((p) => p.mobile_number === input.mobile_number.trim())) {
    return { error: 'Mobile number is already registered for this category.' };
  }
  if (!verifyOtp(db, input.mobile_number.trim(), input.service_category, input.otp_code)) {
    return { error: 'Invalid or expired OTP code.' };
  }
  const hasExp = input.documents.some((d) => d.document_type === 'experience_certificate');
  const hasPolice = input.documents.some((d) => d.document_type === 'police_verification');
  if (!hasExp || !hasPolice) {
    return { error: 'Experience Certificate and Police Verification Certificate are mandatory.' };
  }

  const provider: ProviderAccount = {
    id: nextId(list),
    service_category: input.service_category,
    full_name: input.full_name.trim(),
    mobile_number: input.mobile_number.trim(),
    password_hash: input.password,
    address: input.address.trim(),
    pin_code: input.pin_code.trim(),
    qualification_details: input.qualification_details.trim(),
    experience_details: input.experience_details.trim(),
    is_otp_verified: true,
    approval_status: 'pending',
    rejection_reason: null,
    average_rating: 0,
    total_reviews: 0,
    created_at: nowIso(),
  };
  list.unshift(provider);

  input.documents.forEach((doc) => {
    db.provider_documents.push({
      id: nextId(db.provider_documents),
      provider_type: input.service_category,
      provider_id: provider.id,
      document_type: doc.document_type,
      file_data_url: doc.file_data_url,
      original_name: doc.original_name,
      verification_status: 'pending',
      verified_at: null,
      created_at: nowIso(),
    });
  });

  pushNotification(
    db,
    'admin',
    null,
    `new_${input.service_category}_application`,
    `New ${input.service_category === 'electrician' ? 'Electrician' : 'Plumber'} Application`,
    `${provider.full_name} submitted documents for verification.`
  );
  saveDB(db);
  return { provider };
}

export function loginProvider(
  service_category: ServiceCategory,
  mobile_number: string,
  password: string
): { provider?: ProviderAccount; error?: string } {
  const db = loadDB();
  const list = service_category === 'electrician' ? db.electricians : db.plumbers;
  const provider = list.find((p) => p.mobile_number === mobile_number.trim());
  if (!provider || provider.password_hash !== password) {
    return { error: 'Invalid mobile number or password.' };
  }
  return { provider };
}

export function loginAdmin(email: string, password: string) {
  const db = loadDB();
  const admin = db.admin_users.find((a) => a.email.toLowerCase() === email.trim().toLowerCase() && a.is_active);
  if (!admin || admin.password_hash !== password) {
    return { error: 'Invalid administrator credentials.' };
  }
  return { admin };
}

export function validateVoucherForUser(
  db: AppDatabase,
  userId: number,
  code: string,
  baseAmount: number,
  serviceId?: number | null
): { valid?: boolean; voucher?: GiftVoucher; discount_amount?: number; final_amount?: number; error?: string } {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { error: 'Enter a voucher code.' };
  const voucher = db.gift_vouchers.find((v) => v.voucher_code.toUpperCase() === normalized);
  if (!voucher || !voucher.is_active) {
    return { error: 'Invalid or inactive voucher code.' };
  }
  const today = new Date().toISOString().slice(0, 10);
  if (today < voucher.start_date || today > voucher.expiry_date) {
    return { error: 'This voucher is expired or not yet active.' };
  }
  if (baseAmount < voucher.min_booking_amount) {
    return { error: `Minimum booking amount of ₹${voucher.min_booking_amount} is required.` };
  }
  if (voucher.target_audience === 'specific_users') {
    const assigned = db.voucher_assignments.some((a) => a.voucher_id === voucher.id && a.user_id === userId);
    if (!assigned) {
      return { error: 'This voucher is not assigned to your account.' };
    }
  }
  if (voucher.applicable_scope === 'specific_services' && serviceId) {
    if (!voucher.applicable_service_ids.includes(serviceId)) {
      return { error: 'This voucher is not applicable to the selected service.' };
    }
  }
  const totalUsed = db.voucher_redemptions.filter((r) => r.voucher_id === voucher.id).length;
  if (totalUsed >= voucher.total_usage_limit) {
    return { error: 'Voucher usage limit has been reached.' };
  }
  const userUsed = db.voucher_redemptions.filter((r) => r.voucher_id === voucher.id && r.user_id === userId).length;
  if (userUsed >= voucher.per_user_limit) {
    return { error: 'You have already redeemed this voucher up to its limit.' };
  }

  let discount =
    voucher.discount_type === 'fixed'
      ? voucher.discount_value
      : (baseAmount * voucher.discount_value) / 100;
  if (voucher.discount_type === 'percentage' && voucher.max_discount_amount !== null) {
    discount = Math.min(discount, voucher.max_discount_amount);
  }
  discount = Number(Math.min(discount, baseAmount).toFixed(2));
  const finalAmount = Number(Math.max(1, baseAmount - discount).toFixed(2));
  return { valid: true, voucher, discount_amount: discount, final_amount: finalAmount };
}

export function createBooking(input: {
  user_id: number;
  service_category: ServiceCategory;
  service_id?: number | null;
  voucher_code?: string;
  booking_method: 'online' | 'phone_manual';
  problem_description: string;
  service_address: string;
  preferred_date: string;
  preferred_time: string;
  booking_amount: number;
  photos: { file_data_url: string; original_name: string }[];
  actor_role: UserRole;
  actor_id: number;
}): { booking: BookingRecord; razorpay_order_id: string } {
  const db = loadDB();
  const id = nextId(db.bookings);
  const code = `VV-${input.service_category === 'electrician' ? 'EL' : 'PL'}-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${String(1000 + id)}`;

  // Server-side authoritative service pricing & voucher calculation
  let originalAmount = input.booking_amount;
  let serviceNameSnapshot: string | null = null;
  let servicePriceSnapshot: number | null = null;
  let isCustomQuote = false;
  if (input.service_id) {
    const svc = db.services.find((s) => s.id === input.service_id && s.is_active);
    if (svc) {
      isCustomQuote = svc.pricing_type === 'custom_quote';
      originalAmount = isCustomQuote ? 0 : svc.price;
      serviceNameSnapshot = svc.service_name;
      servicePriceSnapshot = isCustomQuote ? 0 : svc.price;
    }
  }

  let discountAmount = 0;
  let finalAmount = originalAmount;
  let appliedVoucherId: number | null = null;

  if (!isCustomQuote && input.voucher_code && input.voucher_code.trim() !== '') {
    const vRes = validateVoucherForUser(db, input.user_id, input.voucher_code, originalAmount, input.service_id);
    if (vRes.valid && vRes.voucher) {
      appliedVoucherId = vRes.voucher.id;
      discountAmount = vRes.discount_amount || 0;
      finalAmount = vRes.final_amount || originalAmount;
    }
  }

  const booking: BookingRecord = {
    id,
    booking_code: code,
    user_id: input.user_id,
    service_category: input.service_category,
    service_id: input.service_id ?? null,
    service_name_snapshot: serviceNameSnapshot,
    service_price_snapshot: servicePriceSnapshot,
    voucher_id: appliedVoucherId,
    original_amount: originalAmount,
    discount_amount: discountAmount,
    booking_method: input.booking_method,
    assigned_provider_type: null,
    assigned_provider_id: null,
    problem_description: input.problem_description.trim(),
    service_address: input.service_address.trim(),
    preferred_date: input.preferred_date,
    preferred_time: input.preferred_time,
    booking_amount: finalAmount,
    status: isCustomQuote ? 'Booking Confirmed' : 'Payment Pending',
    completion_description: null,
    customer_confirmed_completion: false,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.bookings.unshift(booking);

  if (appliedVoucherId) {
    db.voucher_redemptions.unshift({
      id: nextId(db.voucher_redemptions),
      voucher_id: appliedVoucherId,
      user_id: input.user_id,
      booking_id: id,
      original_amount: originalAmount,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      redeemed_at: nowIso(),
    });
  }

  input.photos.forEach((p) => {
    db.booking_images.push({
      id: nextId(db.booking_images),
      booking_id: id,
      file_data_url: p.file_data_url,
      original_name: p.original_name,
      uploaded_at: nowIso(),
    });
  });

  if (isCustomQuote) {
    addStatusHistory(
      db,
      id,
      'Booking Confirmed',
      input.actor_role,
      input.actor_id,
      'Custom quotation requested. Final price will be confirmed after inspection.'
    );
    pushNotification(
      db,
      'admin',
      null,
      'new_booking',
      'New Custom Quote Booking',
      `${code} (${serviceNameSnapshot || input.service_category}) requires inspection & quotation.`,
      id
    );
    saveDB(db);
    return { booking, razorpay_order_id: '' };
  }

  const orderId = `order_${Math.random().toString(36).slice(2, 14)}`;
  db.payments.unshift({
    id: nextId(db.payments),
    booking_id: id,
    user_id: input.user_id,
    amount: finalAmount,
    currency: 'INR',
    razorpay_order_id: orderId,
    razorpay_payment_id: null,
    razorpay_signature: null,
    payment_method: input.booking_method === 'phone_manual' ? 'razorpay_link' : 'razorpay',
    payment_status: 'created',
    failure_reason: null,
    paid_at: null,
    created_at: nowIso(),
  });

  addStatusHistory(db, id, 'Payment Pending', input.actor_role, input.actor_id, 'Booking created, awaiting Razorpay verification.');
  pushNotification(db, 'admin', null, 'new_booking', 'New Booking Created', `${code} (${input.service_category}) created.`, id);
  saveDB(db);
  return { booking, razorpay_order_id: orderId };
}

export function verifyRazorpayPayment(input: {
  booking_id: number;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  payment_method: string;
  actor_role: UserRole;
  actor_id: number;
}): { success?: boolean; error?: string } {
  const db = loadDB();
  if (db.payments.some((p) => p.razorpay_payment_id === input.razorpay_payment_id && p.payment_status === 'success')) {
    return { error: 'Duplicate payment transaction rejected.' };
  }
  const payment = db.payments.find((p) => p.booking_id === input.booking_id && p.razorpay_order_id === input.razorpay_order_id);
  const booking = db.bookings.find((b) => b.id === input.booking_id);
  if (!payment || !booking) return { error: 'Payment or booking record not found.' };

  if (!input.razorpay_signature || input.razorpay_signature.length < 10) {
    payment.payment_status = 'failed';
    payment.failure_reason = 'Server HMAC-SHA256 signature verification failed.';
    pushNotification(db, 'admin', null, 'payment_failed', 'Payment Verification Failed', `Booking ${booking.booking_code} failed signature check.`, booking.id);
    saveDB(db);
    return { error: 'Payment signature verification failed.' };
  }

  payment.razorpay_payment_id = input.razorpay_payment_id;
  payment.razorpay_signature = input.razorpay_signature;
  payment.payment_method = input.payment_method || 'razorpay';
  payment.payment_status = 'success';
  payment.paid_at = nowIso();

  booking.status = 'Booking Confirmed';
  booking.updated_at = nowIso();

  addStatusHistory(db, booking.id, 'Booking Confirmed', input.actor_role, input.actor_id, `Razorpay payment verified (${input.razorpay_payment_id}).`);
  pushNotification(db, 'admin', null, 'payment_success', 'Customer Payment Verified', `${booking.booking_code} paid INR ${payment.amount}.`, booking.id);
  pushNotification(db, 'user', booking.user_id, 'booking_confirmed', 'Booking Confirmed', `Payment verified for ${booking.booking_code}.`, booking.id);
  saveDB(db);
  return { success: true };
}

export function markPaymentPending(booking_id: number, razorpay_order_id: string) {
  const db = loadDB();
  const payment = db.payments.find((p) => p.booking_id === booking_id && p.razorpay_order_id === razorpay_order_id);
  if (payment && payment.payment_status === 'created') {
    payment.payment_status = 'pending';
    saveDB(db);
  }
}

export function createRetryPaymentOrder(booking_id: number): { order_id?: string; error?: string } {
  const db = loadDB();
  const booking = db.bookings.find((b) => b.id === booking_id);
  if (!booking) return { error: 'Booking not found.' };
  if (booking.status !== 'Payment Pending') {
    return { error: 'Booking is already confirmed or closed.' };
  }
  if (db.payments.some((p) => p.booking_id === booking_id && p.payment_status === 'success')) {
    return { error: 'This booking already has a verified successful payment.' };
  }

  // Reuse existing 'created' order if not yet attempted, otherwise issue a new order
  const openCreated = db.payments.find((p) => p.booking_id === booking_id && p.payment_status === 'created');
  if (openCreated) {
    return { order_id: openCreated.razorpay_order_id };
  }

  const orderId = `order_${Math.random().toString(36).slice(2, 14)}`;
  db.payments.unshift({
    id: nextId(db.payments),
    booking_id: booking.id,
    user_id: booking.user_id,
    amount: booking.booking_amount,
    currency: 'INR',
    razorpay_order_id: orderId,
    razorpay_payment_id: null,
    razorpay_signature: null,
    payment_method: 'razorpay',
    payment_status: 'created',
    failure_reason: null,
    paid_at: null,
    created_at: nowIso(),
  });
  saveDB(db);
  return { order_id: orderId };
}

export function markPaymentFailed(booking_id: number, razorpay_order_id: string, reason: string) {
  const db = loadDB();
  const payment = db.payments.find((p) => p.booking_id === booking_id && p.razorpay_order_id === razorpay_order_id);
  const booking = db.bookings.find((b) => b.id === booking_id);
  if (payment) {
    payment.payment_status = 'failed';
    payment.failure_reason = reason;
  }
  if (booking) {
    pushNotification(db, 'admin', null, 'payment_failed', 'Customer Payment Failed', `${booking.booking_code}: ${reason}`, booking.id);
  }
  saveDB(db);
}

export function refundPayment(
  payment_id: number,
  refunded_amount: number,
  refund_reason: string,
  admin_id: number
): { success?: boolean; error?: string } {
  const db = loadDB();
  const payment = db.payments.find((p) => p.id === payment_id);
  if (!payment) return { error: 'Payment record not found.' };
  if (payment.payment_status !== 'success') {
    return { error: 'Only successful payments can be marked as refunded.' };
  }
  const amount = Math.min(Math.max(0, refunded_amount || payment.amount), payment.amount);
  payment.payment_status = 'refunded';
  payment.refunded_amount = amount;
  payment.refund_reason = refund_reason.trim() || 'Refund processed by administrator.';
  payment.refunded_at = nowIso();

  const booking = db.bookings.find((b) => b.id === payment.booking_id);
  if (booking) {
    addStatusHistory(db, booking.id, booking.status, 'admin', admin_id, `Payment refunded (INR ${amount.toFixed(2)}): ${payment.refund_reason}`);
    pushNotification(db, 'user', booking.user_id, 'payment_refunded', 'Payment Refunded', `Refund of INR ${amount.toFixed(2)} recorded for ${booking.booking_code}.`, booking.id);
  }
  saveDB(db);
  return { success: true };
}

export function submitCustomerReview(input: {
  booking_id: number;
  user_id: number;
  rating: number;
  service_quality: number;
  provider_behaviour: number;
  work_satisfaction: number;
  written_feedback: string;
}): { success?: boolean; error?: string } {
  const db = loadDB();
  const booking = db.bookings.find((b) => b.id === input.booking_id && b.user_id === input.user_id);
  if (!booking || !booking.assigned_provider_id || !booking.assigned_provider_type) {
    return { error: 'Booking not eligible for review.' };
  }
  if (booking.status !== 'Work Completed' && booking.status !== 'Customer Review Pending') {
    return { error: 'Work must be completed before submitting a review.' };
  }
  if (db.customer_reviews.some((r) => r.booking_id === booking.id)) {
    return { error: 'Review already submitted for this booking.' };
  }

  const review: CustomerReview = {
    id: nextId(db.customer_reviews),
    booking_id: booking.id,
    user_id: input.user_id,
    provider_type: booking.assigned_provider_type,
    provider_id: booking.assigned_provider_id,
    rating: input.rating,
    service_quality: input.service_quality,
    provider_behaviour: input.provider_behaviour,
    work_satisfaction: input.work_satisfaction,
    written_feedback: input.written_feedback.trim(),
    created_at: nowIso(),
  };
  db.customer_reviews.unshift(review);
  booking.customer_confirmed_completion = true;
  booking.status = 'Completed and Reviewed';
  booking.updated_at = nowIso();
  addStatusHistory(db, booking.id, 'Completed and Reviewed', 'user', input.user_id, `Customer confirmed completion and rated ${input.rating}/5.`);

  const providerList = booking.assigned_provider_type === 'electrician' ? db.electricians : db.plumbers;
  const provider = providerList.find((p) => p.id === booking.assigned_provider_id);
  if (provider) {
    const pReviews = db.customer_reviews.filter(
      (r) => r.provider_type === booking.assigned_provider_type && r.provider_id === provider.id
    );
    provider.total_reviews = pReviews.length;
    provider.average_rating = Number((pReviews.reduce((s, r) => s + r.rating, 0) / pReviews.length).toFixed(2));
  }

  pushNotification(db, 'admin', null, 'new_review', 'New Customer Review', `${booking.booking_code} rated ${input.rating}/5.`, booking.id);
  saveDB(db);
  return { success: true };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}
