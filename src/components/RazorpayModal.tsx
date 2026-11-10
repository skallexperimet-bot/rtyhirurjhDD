import React, { useState } from 'react';
import { ShieldCheck, X, AlertCircle, Lock, ExternalLink, RefreshCw } from 'lucide-react';
import {
  verifyRazorpayPayment,
  markPaymentFailed,
  markPaymentPending,
  createRetryPaymentOrder,
} from '../services/backend';
import { UserRole } from '../types';

interface RazorpayModalProps {
  bookingId: number;
  bookingCode: string;
  orderId: string;
  amount: number;
  customerName: string;
  customerMobile: string;
  serviceName?: string;
  keyId?: string;
  actorRole: UserRole;
  actorId: number;
  onSuccess: () => void;
  onClose: () => void;
}

export const RazorpayModal: React.FC<RazorpayModalProps> = ({
  bookingId,
  bookingCode,
  orderId,
  amount,
  customerName,
  customerMobile,
  serviceName,
  keyId,
  actorRole,
  actorId,
  onSuccess,
  onClose,
}) => {
  const [activeOrderId, setActiveOrderId] = useState(orderId);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);

  const envKeyId = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_RAZORPAY_KEY_ID || '';
  const savedPublicKeyId =
    typeof window !== 'undefined' ? window.localStorage.getItem('vv_razorpay_test_key_id') || '' : '';
  const activeKeyId = (
    keyId && keyId.startsWith('rzp_')
      ? keyId
      : envKeyId.startsWith('rzp_')
        ? envKeyId
        : savedPublicKeyId
  ).trim();
  const hasKeyId = activeKeyId.startsWith('rzp_') && !activeKeyId.includes('REPLACE_WITH');

  const win = window as unknown as {
    Razorpay?: new (opts: Record<string, unknown>) => {
      open: () => void;
      on: (e: string, cb: (r: { error?: { description?: string } }) => void) => void;
    };
  };
  const isScriptLoaded = Boolean(win.Razorpay);
  const isRazorpayConfigured = hasKeyId && isScriptLoaded;

  const launchCheckout = (targetOrderId: string) => {
    setError(null);
    setCanRetry(false);

    if (!hasKeyId) {
      setError('Razorpay Key ID is not configured.');
      return;
    }
    if (!win.Razorpay) {
      setError('Razorpay Checkout script failed to load. Please check your internet connection and try again.');
      setCanRetry(true);
      return;
    }

    setProcessing(true);
    markPaymentPending(bookingId, targetOrderId);

    try {
      const rzp = new win.Razorpay({
        key: activeKeyId,
        amount: Math.round(amount * 100),
        currency: 'INR',
        name: 'Volt & Valve Services',
        description: serviceName ? `${serviceName} (${bookingCode})` : `Booking ${bookingCode}`,
        order_id: targetOrderId,
        prefill: { name: customerName, contact: customerMobile },
        theme: { color: '#1d4ed8' },
        handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          const res = verifyRazorpayPayment({
            booking_id: bookingId,
            razorpay_order_id: response.razorpay_order_id || targetOrderId,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            payment_method: 'razorpay_checkout',
            actor_role: actorRole,
            actor_id: actorId,
          });
          setProcessing(false);
          if (res.error) {
            setError(res.error);
            setCanRetry(true);
            return;
          }
          onSuccess();
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            markPaymentFailed(bookingId, targetOrderId, 'Customer dismissed Razorpay Checkout.');
            setError('Payment was not completed. Status recorded as Failed.');
            setCanRetry(true);
          },
        },
      });

      rzp.on('payment.failed', (resp) => {
        setProcessing(false);
        const msg = resp?.error?.description || 'Razorpay payment failed.';
        markPaymentFailed(bookingId, targetOrderId, msg);
        setError(msg);
        setCanRetry(true);
      });

      rzp.open();
    } catch {
      setProcessing(false);
      markPaymentFailed(bookingId, targetOrderId, 'Unable to initialize Razorpay Checkout window.');
      setError('Unable to open Razorpay Checkout. Please check your network and retry.');
      setCanRetry(true);
    }
  };

  const handleRetry = () => {
    const retryRes = createRetryPaymentOrder(bookingId);
    if (retryRes.error || !retryRes.order_id) {
      setError(retryRes.error || 'Unable to create retry order.');
      return;
    }
    setActiveOrderId(retryRes.order_id);
    launchCheckout(retryRes.order_id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-300 font-mono-tabular">Razorpay Secure Checkout</p>
            <h3 className="text-lg font-semibold mt-0.5">Volt & Valve Services</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1.5 rounded-lg focus-visible:outline-2 focus-visible:outline-white"
            aria-label="Close payment window"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-baseline justify-between border-b border-slate-200 pb-4">
            <div>
              <p className="text-xs text-slate-500">Booking Reference</p>
              <p className="text-sm font-mono-tabular font-medium text-slate-900">{bookingCode}</p>
              {serviceName && <p className="text-xs font-medium text-slate-700 mt-0.5">{serviceName}</p>}
              <p className="text-xs text-slate-500 mt-1">{customerName} · {customerMobile}</p>
              <p className="text-[11px] font-mono-tabular text-slate-400 mt-0.5">Order: {activeOrderId}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Payable Amount</p>
              <p className="text-2xl font-bold font-mono-tabular text-slate-900">₹{amount.toFixed(2)}</p>
            </div>
          </div>

          {!hasKeyId ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <Lock className="w-4 h-4 shrink-0 text-amber-700" />
                <span>Razorpay Credentials Required</span>
              </div>
              <p className="leading-relaxed">
                Configure <code className="px-1 py-0.5 bg-amber-100 rounded">RAZORPAY_TEST_KEY_ID</code> /{' '}
                <code className="px-1 py-0.5 bg-amber-100 rounded">RAZORPAY_TEST_KEY_SECRET</code> (or Live keys) in{' '}
                <code className="px-1 py-0.5 bg-amber-100 rounded">php-backend/config/config.php</code> and set{' '}
                <code className="px-1 py-0.5 bg-amber-100 rounded">VITE_RAZORPAY_KEY_ID</code> for frontend Checkout.
              </p>
              <p className="text-amber-800">
                Your booking is saved with status <strong>Payment Pending</strong>. You can retry payment anytime from Booking History.
              </p>
            </div>
          ) : !isScriptLoaded ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-700" />
                <span>Razorpay Checkout Script Unavailable</span>
              </div>
              <p>Unable to load <code className="px-1 py-0.5 bg-amber-100 rounded">checkout.razorpay.com/v1/checkout.js</code>. Please verify your internet connection.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-2">
              <div className="flex items-center gap-2 font-medium text-slate-900">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Verified Razorpay Gateway Ready ({activeKeyId.startsWith('rzp_live_') ? 'Live Mode' : 'Test Mode'})</span>
              </div>
              <p>
                Supports UPI, Credit/Debit Cards, Netbanking, and Wallets via official Razorpay Checkout with server-side HMAC-SHA256 verification.
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            {isRazorpayConfigured && !canRetry && (
              <button
                type="button"
                onClick={() => launchCheckout(activeOrderId)}
                disabled={processing}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4" />
                <span>{processing ? 'Opening Razorpay...' : `Pay Now – ₹${amount.toFixed(2)}`}</span>
              </button>
            )}
            {canRetry && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={processing}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Payment – ₹{amount.toFixed(2)}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={processing}
              className={`${isRazorpayConfigured || canRetry ? '' : 'w-full'} py-2.5 px-4 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors whitespace-nowrap`}
            >
              {isRazorpayConfigured || canRetry ? 'Close' : 'Close & Pay Later'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
