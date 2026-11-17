import React, { useEffect, useState } from 'react';
import { api, formatMoney } from '../../api/client';
import { Invoice, PaymentRecord } from '../../types';
import { Field } from '../Common/Field';
import { Modal } from '../Common/Modal';
import { createUuid } from '../../utils/uuid';

interface SimulatedPaymentResult {
  payment: PaymentRecord;
  invoice: Invoice;
  idempotent: boolean;
}

interface SimulatedPaymentModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  onComplete: (result: SimulatedPaymentResult) => void;
}

const getAttemptId = createUuid;

export const SimulatedPaymentModal: React.FC<SimulatedPaymentModalProps> = ({ invoice, onClose, onComplete }) => {
  const [method, setMethod] = useState('gcash_simulated');
  const [amount, setAmount] = useState(invoice?.balance ? String(invoice.balance) : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [attemptId, setAttemptId] = useState(getAttemptId);

  useEffect(() => {
    if (invoice) {
      setAmount(String(invoice.balance));
      setMethod('gcash_simulated');
      setError('');
      setAttemptId(getAttemptId());
    }
  }, [invoice?.id]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!invoice) return;
    const methodLabel = method === 'gcash_simulated' ? 'GCash' : method === 'maya_simulated' ? 'Maya' : 'Bank Transfer';
    const confirmed = window.confirm(
      `Confirm ${methodLabel} simulated payment of ${formatMoney(amount)} for ${invoice.invoice_number || `INV-${String(invoice.id).padStart(6, '0')}`}?\n\nThis is a simulation only. No real money will be transferred.`,
    );
    if (!confirmed) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await api<SimulatedPaymentResult>(`/invoices/${invoice.id}/simulated-payments`, {
        method: 'POST',
        body: { amount: Number(amount), method, client_uuid: attemptId },
      });
      onComplete(result);
      setAttemptId(getAttemptId());
    } catch (err: any) {
      setError(err.message || 'The simulated payment could not be completed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return <Modal isOpen={Boolean(invoice)} onClose={() => { if (!submitting) onClose(); }} title="Simulated online payment" maxWidth="560px">
    {invoice && <form className="form-stack simulated-payment-form" onSubmit={submit}>
      <div className="simulated-payment-notice"><strong>Simulation only</strong><span>No real money will be charged or transferred.</span></div>
      <div className="payment-invoice-breakdown">
        <div><span>Invoice number</span><strong>{invoice.invoice_number || `INV-${String(invoice.id).padStart(6, '0')}`}</strong></div>
        <div><span>Rental</span><strong>{invoice.lease?.room?.title || (invoice.lease?.room?.room_number ? `Room ${invoice.lease.room.room_number}` : 'Rental invoice')}</strong></div>
        <div><span>Room / billing period</span><strong>{invoice.lease?.room?.room_number ? `Room ${invoice.lease.room.room_number} · ` : ''}{invoice.billing_period}</strong></div>
        <div><span>Rent</span><strong>{formatMoney(invoice.base_rent)}</strong></div>
        <div><span>Additional charges</span><strong>{formatMoney(invoice.additional_charges_total)}</strong></div>
        <div><span>Total invoice</span><strong>{formatMoney(invoice.total_amount_due)}</strong></div>
        <div><span>Already paid</span><strong>{formatMoney(invoice.amount_paid)}</strong></div>
        <div className="payment-balance-row"><span>Outstanding balance</span><strong>{formatMoney(invoice.balance)}</strong></div>
      </div>
      {invoice.charges?.length ? <div className="payment-charge-breakdown">
        <strong>Additional charge details</strong>
        {invoice.charges.map((charge) => <div key={charge.id}><span>{charge.description || charge.category}</span><strong>{formatMoney(charge.amount)}</strong></div>)}
      </div> : null}
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      <fieldset className="payment-method-fieldset">
        <legend>Payment method <span aria-hidden="true">*</span></legend>
        <div className="payment-method-options">
          {[
            ['gcash_simulated', 'Simulated GCash', 'No real money will be transferred'],
            ['maya_simulated', 'Maya', 'Simulated e-wallet'],
            ['bank_transfer_simulated', 'Bank transfer', 'Simulated bank payment'],
          ].map(([value, label, detail]) => <label key={value} className={`payment-method-option ${method === value ? 'selected' : ''}`}>
            <input type="radio" name="simulated-payment-method" value={value} checked={method === value} onChange={() => setMethod(value)} />
            <span className="payment-method-radio" aria-hidden="true" />
            <span><strong>{label}</strong><small>{detail}</small></span>
          </label>)}
        </div>
      </fieldset>
      <Field label="Amount to pay (PHP)" required>
        <input type="number" min="0.01" max={Number(invoice.balance)} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
      </Field>
      <div className="form-actions">
        <button type="submit" className="button primary" disabled={submitting || Number(amount) > Number(invoice.balance) || Number(amount) <= 0}>
          {submitting ? <><span className="payment-loading-spinner" aria-hidden="true" /> Processing simulation…</> : 'Confirm Payment'}
        </button>
        <button type="button" className="button secondary" onClick={onClose} disabled={submitting}>Cancel</button>
      </div>
    </form>}
  </Modal>;
};
