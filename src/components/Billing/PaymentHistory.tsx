import React, { useMemo, useState } from 'react';
import { downloadProtectedPdf, formatMoney } from '../../api/client';
import { Invoice, PaymentRecord } from '../../types';
import { EmptyState } from '../Common/States';
import { StatusBadge } from '../Common/StatusBadge';
import { PaymentReceipt } from './PaymentReceipt';
import { formatBusinessDateTime } from '../../utils/date';

interface PaymentHistoryProps {
  invoices: Invoice[];
  landlordOrAdmin: boolean;
  announce: (message: string, kind?: 'success' | 'error' | 'warning' | 'info') => void;
}

interface PaymentRow {
  payment: PaymentRecord;
  invoice: Invoice;
}

export const PaymentHistory: React.FC<PaymentHistoryProps> = ({ invoices, landlordOrAdmin, announce }) => {
  const [receiptRow, setReceiptRow] = useState<PaymentRow | null>(null);
  const rows = useMemo(() => invoices.flatMap((invoice) => (invoice.payments || []).map((payment) => ({ payment, invoice })))
    .sort((a, b) => new Date(b.payment.paid_at || b.payment.created_at || 0).getTime() - new Date(a.payment.paid_at || a.payment.created_at || 0).getTime()), [invoices]);
  const methodLabels: Record<string, string> = {
    gcash_simulated: 'GCash (Simulated)',
    maya_simulated: 'Maya (Simulated)',
    bank_transfer_simulated: 'Bank Transfer (Simulated)',
  };
  const downloadReceipt = async (payment: PaymentRecord) => {
    try { await downloadProtectedPdf(`/payments/${payment.id}/receipt.pdf`, `BoardEase-Receipt-${payment.reference_number || payment.id}.pdf`); }
    catch (err: any) { announce(err.message || 'Could not download receipt.', 'error'); }
  };

  return <>
    <section className="panel spaced-panel">
      <div className="panel-heading"><div><h2>{landlordOrAdmin ? 'Payment Monitoring' : 'Payment History'} ({rows.length})</h2><p className="panel-desc">Successful and failed payment records. Simulated methods never move real money.</p></div></div>
      <div className="panel-body">
        {rows.length === 0 ? <EmptyState message="No payment activity has been recorded yet." /> : <div className="table-scroll">
          <table>
            <thead><tr>{landlordOrAdmin && <th>Tenant</th>}<th>Room</th><th>Invoice</th><th>Reference</th><th>Method</th><th>Amount</th><th>Status</th><th>Date</th><th>Receipt</th></tr></thead>
            <tbody>{rows.map(({ payment, invoice }) => <tr key={payment.id}>
              {landlordOrAdmin && <td>{invoice.lease?.tenant?.name || 'Tenant'}</td>}
              <td>{invoice.lease?.room?.room_number ? `Room ${invoice.lease.room.room_number}` : '—'}</td>
              <td>{invoice.invoice_number || `INV-${String(invoice.id).padStart(6, '0')}`} · {invoice.billing_period}</td>
              <td>{payment.reference_number || '—'}</td>
              <td>{methodLabels[payment.method] || payment.method}</td>
              <td><strong>{formatMoney(payment.amount)}</strong></td>
              <td><StatusBadge status={payment.transaction_status || 'succeeded'} /></td>
              <td>{payment.paid_at || payment.created_at ? formatBusinessDateTime(payment.paid_at || payment.created_at) : '—'}</td>
              <td><div className="payment-history-actions"><button type="button" className="button secondary sm" onClick={() => setReceiptRow({ payment, invoice })}>View</button>{payment.transaction_status === 'succeeded' && payment.paid_at && <button type="button" className="button primary sm" onClick={() => void downloadReceipt(payment)}>Download PDF</button>}</div></td>
            </tr>)}</tbody>
          </table>
        </div>}
      </div>
    </section>
    <PaymentReceipt payment={receiptRow?.payment || null} invoice={receiptRow?.invoice} onClose={() => setReceiptRow(null)} announce={announce} />
  </>;
};
