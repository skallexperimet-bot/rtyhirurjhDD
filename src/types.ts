export type ServiceCategory = 'electrician' | 'plumber';
export type UserRole = 'user' | 'electrician' | 'plumber' | 'admin';

export type BookingStatus =
  | 'Payment Pending'
  | 'Booking Confirmed'
  | 'Waiting for Electrician'
  | 'Accepted'
  | 'In Progress'
  | 'Work Completed'
  | 'Customer Review Pending'
  | 'Completed and Reviewed'
  | 'Cancelled';

export interface UserAccount {
  id: number;
  full_name: string;
  mobile_number: string;
  password_hash: string;
  address: string;
  village_city: string;
  district: string;
  state: string;
  pin_code: string;
  is_otp_verified: boolean;
  status: 'active' | 'blocked';
  profile_image?: string | null;
  created_at: string;
}

export interface ProviderAccount {
  id: number;
  service_category: ServiceCategory;
  full_name: string;
  mobile_number: string;
  password_hash: string;
  address: string;
  pin_code: string;
  qualification_details: string;
  experience_details: string;
  is_otp_verified: boolean;
  approval_status: 'pending' | 'approved' | 'rejected' | 'blocked';
  rejection_reason: string | null;
  average_rating: number;
  total_reviews: number;
  created_at: string;
}

export interface ProviderDocument {
  id: number;
  provider_type: ServiceCategory;
  provider_id: number;
  document_type: 'qualification_certificate' | 'experience_certificate' | 'police_verification';
  file_data_url: string;
  original_name: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  verified_at: string | null;
  created_at: string;
}

export interface AdminUser {
  id: number;
  full_name: string;
  email: string;
  mobile_number: string;
  password_hash: string;
  role: 'super_admin' | 'admin';
  is_active: boolean;
}

export interface BookingRecord {
  id: number;
  booking_code: string;
  user_id: number;
  service_category: ServiceCategory;
  service_id?: number | null;
  service_name_snapshot?: string | null;
  service_price_snapshot?: number | null;
  voucher_id?: number | null;
  original_amount?: number;
  discount_amount?: number;
  booking_method: 'online' | 'phone_manual';
  assigned_provider_type: ServiceCategory | null;
  assigned_provider_id: number | null;
  problem_description: string;
  service_address: string;
  preferred_date: string;
  preferred_time: string;
  booking_amount: number;
  status: BookingStatus;
  completion_description: string | null;
  customer_confirmed_completion: boolean;
  created_at: string;
  updated_at: string;
}

export interface BookingImage {
  id: number;
  booking_id: number;
  file_data_url: string;
  original_name: string;
  uploaded_at: string;
}

export interface BookingStatusHistory {
  id: number;
  booking_id: number;
  status: BookingStatus;
  changed_by_role: UserRole | 'system';
  changed_by_id: number | null;
  remarks: string;
  changed_at: string;
}

export interface PaymentRecord {
  id: number;
  booking_id: number;
  user_id: number;
  amount: number;
  currency: string;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  payment_method: string;
  payment_status: 'created' | 'pending' | 'success' | 'failed' | 'refunded';
  failure_reason: string | null;
  refunded_amount?: number;
  refund_reason?: string | null;
  refunded_at?: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface ElectricianServiceCharge {
  id: number;
  booking_id: number;
  provider_type: ServiceCategory;
  provider_id: number;
  assigned_charge: number;
  payout_status: 'pending' | 'paid';
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ElectricianPayout {
  id: number;
  service_charge_id: number;
  booking_id: number;
  provider_type: ServiceCategory;
  provider_id: number;
  paid_amount: number;
  utr_reference: string;
  payment_mode: string;
  payment_date: string;
  remarks: string;
  created_at: string;
}

export interface WorkCompletionPhoto {
  id: number;
  booking_id: number;
  provider_type: ServiceCategory;
  provider_id: number;
  file_data_url: string;
  original_name: string;
  uploaded_at: string;
}

export interface CustomerReview {
  id: number;
  booking_id: number;
  user_id: number;
  provider_type: ServiceCategory;
  provider_id: number;
  rating: number;
  service_quality: number;
  provider_behaviour: number;
  work_satisfaction: number;
  written_feedback: string;
  is_visible?: boolean;
  created_at: string;
}

export interface NotificationItem {
  id: number;
  recipient_role: UserRole;
  recipient_id: number | null;
  event_type: string;
  title: string;
  message: string;
  related_booking_id: number | null;
  is_read: boolean;
  created_at: string;
}

export interface OtpEntry {
  id: number;
  mobile_number: string;
  role: 'user' | 'electrician' | 'plumber';
  otp_code: string;
  is_used: boolean;
  expires_at: number;
}

export interface ServiceCategoryItem {
  id: number;
  slug: string;
  name: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export interface ServiceItem {
  id: number;
  category_id: number;
  service_name: string;
  description: string;
  image_data_url: string;
  price: number;
  pricing_type: 'fixed' | 'starting_at' | 'hourly' | 'custom_quote' | 'inspection';
  is_available: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export interface GiftVoucher {
  id: number;
  voucher_name: string;
  voucher_code: string;
  description: string;
  discount_type: 'fixed' | 'percentage';
  discount_value: number;
  min_booking_amount: number;
  max_discount_amount: number | null;
  start_date: string;
  expiry_date: string;
  total_usage_limit: number;
  per_user_limit: number;
  applicable_scope: 'all_services' | 'specific_services';
  applicable_service_ids: number[];
  target_audience: 'all_users' | 'specific_users';
  is_active: boolean;
  created_at: string;
}

export interface VoucherAssignment {
  id: number;
  voucher_id: number;
  user_id: number;
  assigned_at: string;
}

export interface VoucherRedemption {
  id: number;
  voucher_id: number;
  user_id: number;
  booking_id: number;
  original_amount: number;
  discount_amount: number;
  final_amount: number;
  redeemed_at: string;
}

export interface ReviewVisibilityLog {
  id: number;
  review_id: number;
  admin_id: number;
  action: 'hidden' | 'unhidden';
  reason: string;
  created_at: string;
}

export interface AppDatabase {
  users: UserAccount[];
  electricians: ProviderAccount[];
  plumbers: ProviderAccount[];
  admin_users: AdminUser[];
  otp_verifications: OtpEntry[];
  provider_documents: ProviderDocument[];
  bookings: BookingRecord[];
  booking_images: BookingImage[];
  booking_status_history: BookingStatusHistory[];
  payments: PaymentRecord[];
  electrician_service_charges: ElectricianServiceCharge[];
  electrician_payouts: ElectricianPayout[];
  work_completion_photos: WorkCompletionPhoto[];
  customer_reviews: CustomerReview[];
  notifications: NotificationItem[];
  service_categories: ServiceCategoryItem[];
  services: ServiceItem[];
  gift_vouchers: GiftVoucher[];
  voucher_assignments: VoucherAssignment[];
  voucher_redemptions: VoucherRedemption[];
  review_visibility_logs: ReviewVisibilityLog[];
}
