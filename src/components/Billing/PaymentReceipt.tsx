import React from 'react';
import { downloadProtectedPdf, formatMoney } from '../../api/client';
import { Invoice, PaymentRecord } from '../../types';
import { Modal } from '../Common/Modal';
import { formatBusinessDateTime } from '../../utils/date';

interface PaymentReceiptProps {
  payment: PaymentRecord | null;
  invoice?: Invoice;
  onClose: () => void;
  announce: (message: string, kind?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const PaymentReceipt: React.FC<PaymentReceiptProps> = ({ payment, invoice, onClose, announce }) => {
  const succeeded = payment?.transaction_status !== 'failed';
  const methodLabels: Record<string, string> = {
    gcash_simulated: 'GCash (Simulated)',
    maya_simulated: 'Maya (Simulated)',
    bank_transfer_simulated: 'Bank Transfer (Simulated)',
  };
  const downloadReceipt = async () => {
    if (!payment) return;
    try { await downloadProtectedPdf(`/payments/${payment.id}/receipt.pdf`, `BoardEase-Receipt-${payment.reference_number || payment.id}.pdf`); }
    catch (err: any) { announce(err.message || 'Could not download receipt.', 'error'); }
  };

  return <Modal isOpen={Boolean(payment)} onClose={onClose} title={succeeded ? 'Digital payment receipt' : 'Failed payment record'} maxWidth="520px">
    {payment && <div className="payment-receipt-print">
      <div className="payment-receipt-brand"><img src="/bhms-logo.svg" alt="" /><div><strong>BoardEase</strong><small>Boarding House Rental &amp; Management Platform</small></div></div>
      <div className={`payment-receipt-result ${succeeded ? 'success' : 'failed'}`}>{succeeded ? 'PAYMENT SUCCESSFUL · SIMULATED' : 'PAYMENT FAILED · SIMULATED'}</div>
      <h3>{succeeded ? 'Payment receipt' : 'Payment attempt record'}</h3>
      <dl>
        <div><dt>Reference number</dt><dd>{payment.reference_number || 'Recorded manually'}</dd></div>
        <div><dt>Invoice</dt><dd>{invoice?.invoice_number || (invoice ? `INV-${String(invoice.id).padStart(6, '0')}` : '—')} · {invoice?.billing_period || '—'}</dd></div>
        <div><dt>Room</dt><dd>{invoice?.lease?.room?.room_number ? `Room ${invoice.lease.room.room_number}` : '—'}</dd></div>
        <div><dt>Payment method</dt><dd>{methodLabels[payment.method] || payment.method}</dd></div>
        <div><dt>Amount</dt><dd>{formatMoney(payment.amount)}</dd></div>
        <div><dt>Monthly rent</dt><dd>{formatMoney(invoice?.base_rent)}</dd></div>
        <div><dt>Additional charges</dt><dd>{formatMoney(invoice?.additional_charges_total)}</dd></div>
        <div><dt>Invoice total</dt><dd>{formatMoney(invoice?.total_amount_due)}</dd></div>
        {invoice?.charges?.map((charge) => <div key={charge.id}><dt>{charge.description || charge.category}</dt><dd>{formatMoney(charge.amount)}</dd></div>)}
        <div><dt>Transaction status</dt><dd>{succeeded ? 'Succeeded' : 'Failed'}</dd></div>
        <div><dt>Date</dt><dd>{payment.paid_at || payment.created_at ? formatBusinessDateTime(payment.paid_at || payment.created_at) : '—'}</dd></div>
        {!succeeded && payment.failure_reason && <div><dt>Failure reason</dt><dd>{payment.failure_reason}</dd></div>}
      </dl>
      <p className="payment-receipt-disclaimer">{payment.method.endsWith('_simulated') ? 'This is a simulated payment record. No real money was processed.' : 'This receipt documents a payment recorded in BoardEase.'}</p>
      <div className="payment-receipt-actions">{succeeded && payment.paid_at && <button type="button" className="button primary" onClick={() => void downloadReceipt()}>Download PDF</button>}<button type="button" className="button secondary" onClick={() => window.print()}>Print receipt</button><button type="button" className="button secondary" onClick={onClose}>Close</button></div>
    </div>}
  </Modal>;
};
