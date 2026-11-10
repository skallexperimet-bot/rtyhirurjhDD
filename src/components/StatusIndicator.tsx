import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle, Wrench } from 'lucide-react';
import { BookingStatus } from '../types';

export const StatusIndicator: React.FC<{ status: BookingStatus | string }> = ({ status }) => {
  const getMeta = (s: string) => {
    switch (s) {
      case 'Completed and Reviewed':
      case 'Work Completed':
      case 'Booking Confirmed':
      case 'approved':
      case 'success':
      case 'paid':
      case 'active':
      case 'verified':
        return { color: 'text-emerald-700', Icon: CheckCircle2 };
      case 'In Progress':
      case 'Accepted':
        return { color: 'text-blue-700', Icon: Wrench };
      case 'Payment Pending':
      case 'Waiting for Electrician':
      case 'Customer Review Pending':
      case 'pending':
      case 'created':
        return { color: 'text-amber-700', Icon: Clock };
      case 'Cancelled':
      case 'rejected':
      case 'blocked':
      case 'failed':
      case 'refunded':
        return { color: 'text-red-700', Icon: XCircle };
      default:
        return { color: 'text-slate-700', Icon: AlertTriangle };
    }
  };

  const { color, Icon } = getMeta(status);

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${color} whitespace-nowrap`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{status}</span>
    </span>
  );
};
