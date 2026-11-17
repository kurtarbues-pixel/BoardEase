import { AppNotification } from '../types/notification';

export function notificationDestination(notification: AppNotification): string {
  const data = notification.data || {};
  if (notification.type?.startsWith('inquiry.') || data.inquiry_id) return 'inquiries';
  if (notification.type?.startsWith('system.payment') || notification.type?.startsWith('system.invoice') || notification.type?.startsWith('invoice.') || notification.type?.startsWith('payment.') || notification.type?.startsWith('charge.') || data.invoice_id) return 'billing';
  if (notification.type === 'message' || data.conversation_id) return 'messages';
  if (notification.type === 'maintenance' || data.maintenance_request_id) return 'maintenance';
  if (notification.type?.startsWith('lease.') || data.lease_id) return 'leases';
  return 'notifications';
}
