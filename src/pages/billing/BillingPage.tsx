import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, fetchAll, formatMoney, getCurrentMonthString, downloadProtectedPdf } from '../../api/client';
import { Charge, ChargeCategory, Invoice, Lease, PaymentRecord, SimulatedPaymentResponse } from '../../types';
import { Panel } from '../../components/Common/Panel';
import { Field } from '../../components/Common/Field';
import { Modal } from '../../components/Common/Modal';
import { StatusBadge } from '../../components/Common/StatusBadge';
import { formatBusinessDate } from '../../utils/date';
import { LoadingState, EmptyState, ErrorState } from '../../components/Common/States';
import { SimulatedPaymentModal } from '../../components/Billing/SimulatedPaymentModal';
import { PaymentHistory } from '../../components/Billing/PaymentHistory';
import { PaymentReceipt } from '../../components/Billing/PaymentReceipt';
import { createUuid } from '../../utils/uuid';

interface BillingPageProps {
  announce: (message: string, kind?: 'success' | 'error' | 'warning' | 'info') => void;
}

const chargeCategoryLabel = (charge: Charge) => charge.utility_type
  ? `${charge.utility_type.charAt(0).toUpperCase()}${charge.utility_type.slice(1)} utility`
  : charge.category;

export const BillingPage: React.FC<BillingPageProps> = ({ announce }) => {
  const { user } = useAuth();
  const isTenant = user?.role === 'tenant';
  const canManage = user?.role === 'admin' || user?.role === 'landlord' || user?.role === 'staff';

  const [leases, setLeases] = useState<Lease[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Generate invoices state
  const [invoiceDate, setInvoiceDate] = useState<string>(`${getCurrentMonthString()}-01`);
  const [generating, setGenerating] = useState(false);

  // Add charge form state
  const [chargeLeaseId, setChargeLeaseId] = useState<string>('');
  const [chargeCategory, setChargeCategory] = useState<ChargeCategory>('CANTEEN');
  const [chargeDescription, setChargeDescription] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeBillingPeriod, setChargeBillingPeriod] = useState(getCurrentMonthString());
  const [chargeUtilityType, setChargeUtilityType] = useState<'electricity' | 'water' | 'wifi'>('electricity');
  const [chargeClientUuid, setChargeClientUuid] = useState(createUuid);
  const [isAddingCharge, setIsAddingCharge] = useState(false);

  // Record payment modal state
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [simulatedInvoice, setSimulatedInvoice] = useState<Invoice | null>(null);
  const [preparingPaymentId, setPreparingPaymentId] = useState<number | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<PaymentRecord | null>(null);
  const [receiptInvoice, setReceiptInvoice] = useState<Invoice | undefined>();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Invoices are the primary data for tenant payment access. Load and
      // retain them independently so an unrelated lease-list failure cannot
      // hide the tenant's Pay Now actions.
      const invoicesData = await fetchAll<Invoice>('/invoices');
      setInvoices(invoicesData);

      try {
        setLeases(await fetchAll<Lease>('/leases'));
      } catch (leaseError) {
        if (!isTenant) throw leaseError;
        setLeases([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load billing records.');
    } finally {
      setLoading(false);
    }
  }, [isTenant]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerateInvoices = async () => {
    if (!invoiceDate) {
      announce('Please choose a valid invoice date.', 'warning');
      return;
    }
    const billingPeriod = invoiceDate.slice(0, 7);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) {
      announce('Please choose a valid invoice date.', 'warning');
      return;
    }
    if (!window.confirm(`Generate or update invoices for ${billingPeriod}?`)) return;

    setGenerating(true);
    try {
      const result = await api<{ period: string; created: number; updated: number }>(
        '/invoices/generate',
        {
          method: 'POST',
          body: { period: invoiceDate },
        }
      );
      announce(
        `Invoices generated for ${result.period}: ${result.created} created, ${result.updated} updated.`
      );
      await loadData();
    } catch (err: any) {
      announce(err.message || 'Invoice generation failed.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const downloadInvoice = async (invoice: Invoice) => {
    try { await downloadProtectedPdf(`/invoices/${invoice.id}/pdf`, `BoardEase-Invoice-${invoice.id}.pdf`); }
    catch (err: any) { announce(err.message || 'Could not download invoice.', 'error'); }
  };

  // Re-fetch immediately before opening payment so stale portal data cannot
  // present an already-paid invoice or an outdated balance as payable.
  const startSimulatedPayment = async (invoice: Invoice) => {
    if (user?.role !== 'tenant' || preparingPaymentId !== null) return;
    setPreparingPaymentId(invoice.id);
    try {
      const response = await api<{ data: Invoice }>(`/invoices/${invoice.id}`);
      const currentInvoice = response.data;
      if (!currentInvoice || Number(currentInvoice.balance) <= 0 || currentInvoice.status.toLowerCase() === 'paid') {
        announce('This invoice has no remaining balance. Your invoice list has been refreshed.', 'info');
        await loadData();
        return;
      }
      setSimulatedInvoice(currentInvoice);
    } catch (err: any) {
      announce(err.message || 'Could not retrieve this invoice for payment.', 'error');
    } finally {
      setPreparingPaymentId(null);
    }
  };

  const handleAddCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chargeLeaseId) {
      announce('Please select an active lease.', 'warning');
      return;
    }

    setIsAddingCharge(true);
    try {
      await api(`/leases/${chargeLeaseId}/charges`, {
        method: 'POST',
        body: {
          category: chargeCategory,
          description: chargeDescription.trim() || undefined,
          amount: Number(chargeAmount),
          billing_period: chargeBillingPeriod,
          utility_type: chargeCategory === 'APPLIANCE' ? chargeUtilityType : null,
          client_uuid: chargeClientUuid,
        },
      });
      announce('Additional charge added to pending ledger.');
      setChargeDescription('');
      setChargeAmount('');
      setChargeClientUuid(createUuid());
      await loadData();
    } catch (err: any) {
      announce(err.message || 'Failed to record charge.', 'error');
    } finally {
      setIsAddingCharge(false);
    }
  };

  const handleVoidCharge = async (charge: Charge) => {
    if (!window.confirm(`Are you sure you want to remove this pending charge of ${formatMoney(charge.amount)}?`)) {
      return;
    }

    try {
      await api(`/charges/${charge.id}/void`, { method: 'POST' });
      announce('Pending charge removed.');
      await loadData();
    } catch (err: any) {
      announce(err.message || 'Could not void charge.', 'error');
    }
  };

  const openPaymentModal = (invoice: Invoice) => {
    setPaymentInvoice(invoice);
    setPaymentAmount(String(invoice.balance));
    setPaymentMethod('cash');
    setPaymentNotes('');
  };

  const handleSimulationComplete = async (result: SimulatedPaymentResponse) => {
    setSimulatedInvoice(null);
    setReceiptInvoice(result.invoice);
    setReceiptPayment(result.payment);
    setInvoices((current) => current.map((item) => item.id === result.invoice.id ? result.invoice : item));
    if (result.payment.transaction_status === 'succeeded') {
      announce(`Simulated payment succeeded. Reference ${result.payment.reference_number}. No real money was processed.`, 'success');
    } else {
      announce(`Simulated payment failed. Reference ${result.payment.reference_number}. Your invoice balance was not changed.`, 'warning');
    }
    await loadData();
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentInvoice) return;
    if (!window.confirm(`Record a payment of ${formatMoney(paymentAmount)} for this invoice?`)) return;

    setIsRecordingPayment(true);
    try {
      await api(`/invoices/${paymentInvoice.id}/payments`, {
        method: 'POST',
        body: {
          amount: Number(paymentAmount),
          method: paymentMethod,
          notes: paymentNotes.trim() || undefined,
        },
      });
      announce('Payment recorded successfully!');
      setPaymentInvoice(null);
      await loadData();
    } catch (err: any) {
      announce(err.message || 'Failed to record payment.', 'error');
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const activeLeases = leases.filter((l) => l.status === 'active');
  const outstandingInvoices = invoices.filter((invoice) => Number(invoice.balance) > 0 && invoice.status.toLowerCase() !== 'paid');
  const paidInvoices = invoices.filter((invoice) => Number(invoice.balance) <= 0 || invoice.status.toLowerCase() === 'paid');
  const totalOutstanding = outstandingInvoices.reduce((total, invoice) => total + Number(invoice.balance || 0), 0);

  const pendingCharges = leases.flatMap((lease) =>
    (lease.charges || [])
      .filter((charge) => charge.status?.toLowerCase() === 'pending')
      .map((charge) => ({ ...charge, lease }))
  );
  const tenantCharges = leases.flatMap((lease) =>
    (lease.charges || [])
      .filter((charge) => !['void', 'voided'].includes(charge.status?.toLowerCase()))
      .map((charge) => ({ ...charge, lease }))
  );

  return (
    <div className="billing-page">
      <div className="welcome-block">
        <div>
          <h2>{isTenant ? 'My Payments' : 'Billing & Payments'}</h2>
          <p className="muted">
            {isTenant
              ? 'Review your rent invoices, make simulated payments, and access payment receipts.'
              : 'Record incidentals, generate monthly rent invoices, and track payments.'}
          </p>
        </div>
      </div>

      {canManage && (
        <div className="billing-tools-grid">
          {/* Add Pending Charge Panel */}
          <Panel
            title="Record Pending Charge"
            description="Record a one-time charge for a specific billing period. Re-running invoice generation will not bill it twice."
          >
            <form className="form-grid" onSubmit={handleAddCharge}>
              <Field label="Active Lease" required>
                <select
                  value={chargeLeaseId}
                  onChange={(e) => setChargeLeaseId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    -- Select Lease / Tenant --
                  </option>
                  {activeLeases.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.tenant?.name} · Room {l.room?.room_number}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Charge Category" required>
                <select
                  value={chargeCategory}
                  onChange={(e) => setChargeCategory(e.target.value as ChargeCategory)}
                >
                  <option value="CANTEEN">Canteen / Food</option>
                  <option value="APPLIANCE">Utility / Appliance</option>
                  <option value="OTHER">Other Miscellaneous</option>
                </select>
              </Field>

              {chargeCategory === 'APPLIANCE' && <Field label="Utility type" required><select value={chargeUtilityType} onChange={(e) => setChargeUtilityType(e.target.value as typeof chargeUtilityType)}><option value="electricity">Electricity</option><option value="water">Water</option><option value="wifi">Wi-Fi</option></select></Field>}

              <Field label="Charge billing period" required><input type="month" value={chargeBillingPeriod} onChange={(e) => setChargeBillingPeriod(e.target.value)} required /></Field>

              <Field label="Description (optional)">
                <input
                  type="text"
                  value={chargeDescription}
                  onChange={(e) => setChargeDescription(e.target.value)}
                  placeholder="e.g. Rice meal or Rice cooker usage"
                  maxLength={255}
                />
              </Field>

              <Field label="Amount (₱)" required>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </Field>

              <div className="form-actions span-2">
                <button
                  type="submit"
                  className="button primary"
                  disabled={isAddingCharge || !activeLeases.length}
                >
                  {isAddingCharge ? 'Saving…' : 'Record Charge'}
                </button>
              </div>
            </form>
          </Panel>

          {/* Generate Invoices Tool */}
          <Panel
            title="Generate Monthly Invoices"
            description="Create or update billing statements for all active leases for a given month."
          >
            <div className="generate-tool-box">
              <Field label="Invoice date" required><input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required aria-describedby="invoice-date-hint" /></Field>
              <button
                type="button"
                className="button primary"
              disabled={generating || !invoiceDate}
                onClick={handleGenerateInvoices}
              >
                {generating ? 'Processing…' : 'Generate Statements'}
              </button>
            </div>
            <p className="hint-text" id="invoice-date-hint">
              Any pending canteen or appliance charges for active leases will be attached into this month's invoice.
            </p>
          </Panel>
        </div>
      )}

      {loading ? (
        <LoadingState message="Loading invoices and billing statements…" />
      ) : error ? (
        <ErrorState error={error} retry={loadData} />
      ) : (
        <>
          {isTenant && <>
            <div className="tenant-payment-summary">
              <article><span>Outstanding invoices</span><strong>{outstandingInvoices.length}</strong></article>
              <article><span>Total outstanding</span><strong>{formatMoney(totalOutstanding)}</strong></article>
              <article><span>Payment records</span><strong>{invoices.reduce((count, invoice) => count + (invoice.payments?.length || 0), 0)}</strong></article>
            </div>
            <Panel title="Outstanding invoices" description="Review rent and additional charges before starting a simulated payment." className="spaced-panel">
              {outstandingInvoices.length === 0 ? <EmptyState
                title={invoices.length ? 'No payment due' : 'No invoices yet'}
                message={invoices.length ? 'Your invoices are settled. Paid statements and receipts are listed below.' : 'No invoices are currently linked to your account. New invoices will appear here when issued.'}
              /> : <div className="tenant-outstanding-list">
                {outstandingInvoices.map((invoice) => <article className="tenant-outstanding-card" key={invoice.id}>
                  <div className="tenant-outstanding-heading"><div><strong>{invoice.invoice_number || `INV-${String(invoice.id).padStart(6, '0')}`}</strong><span>{invoice.lease?.room?.room_number ? `Room ${invoice.lease.room.room_number}` : 'Lease invoice'} · {invoice.billing_period} · Due {formatBusinessDate(invoice.due_date)}</span></div><StatusBadge status={invoice.status} /></div>
                  <div className="tenant-invoice-breakdown">
                    <div><span>Rent</span><strong>{formatMoney(invoice.base_rent)}</strong></div>
                    <div><span>Additional charges</span><strong>{formatMoney(invoice.additional_charges_total)}</strong></div>
                    {invoice.charges?.map((charge) => <div className="tenant-invoice-charge" key={charge.id}><span>{charge.description || charge.category}</span><strong>{formatMoney(charge.amount)}</strong></div>)}
                    <div><span>Total invoice</span><strong>{formatMoney(invoice.total_amount_due)}</strong></div>
                    <div><span>Paid</span><strong>{formatMoney(invoice.amount_paid)}</strong></div>
                    <div className="tenant-invoice-balance"><span>Balance due</span><strong>{formatMoney(invoice.balance)}</strong></div>
                  </div>
                  <button
                    type="button"
                    className="button primary tenant-pay-now"
                    aria-label={`Pay ${formatMoney(invoice.balance)} for invoice ${invoice.invoice_number || invoice.id} with simulated GCash`}
                    disabled={preparingPaymentId !== null}
                    onClick={() => void startSimulatedPayment(invoice)}
                  >
                    {preparingPaymentId === invoice.id ? 'Loading invoice…' : `Pay Now · ${formatMoney(invoice.balance)}`}
                  </button>
                  <button type="button" className="button secondary" onClick={() => void downloadInvoice(invoice)}>Download invoice PDF</button>
                </article>)}
              </div>}
            </Panel>
            {paidInvoices.length > 0 && <Panel title="Paid invoices" description="Download statements for invoices that have been settled." className="spaced-panel"><div className="table-scroll"><table><thead><tr><th>Invoice</th><th>Billing period</th><th>Room</th><th>Total</th><th>Paid</th><th>Balance</th><th>Due date</th><th>Document</th></tr></thead><tbody>{paidInvoices.map((invoice) => <tr key={invoice.id}><td>{invoice.invoice_number || `INV-${String(invoice.id).padStart(6, '0')}`}</td><td>{invoice.billing_period}</td><td>{invoice.lease?.room?.room_number ? `Room ${invoice.lease.room.room_number}` : '—'}</td><td>{formatMoney(invoice.total_amount_due)}</td><td>{formatMoney(invoice.amount_paid)}</td><td>{formatMoney(invoice.balance)}</td><td>{formatBusinessDate(invoice.due_date)}</td><td><button type="button" className="button secondary sm" onClick={() => void downloadInvoice(invoice)}>Download PDF</button></td></tr>)}</tbody></table></div></Panel>}
          </>}

          {isTenant && (
            <Panel
              title={`Additional Charges (${tenantCharges.length})`}
              description="Charges recorded for your active or previous leases, including charges not yet added to an invoice."
              className="spaced-panel"
            >
              {tenantCharges.length === 0 ? (
                <EmptyState message="No additional charges have been recorded for your leases." />
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Room</th>
                        <th>Category</th>
                        <th>Billing Period</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Date Added</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenantCharges.map((charge) => (
                        <tr key={charge.id}>
                          <td>Room {charge.lease?.room?.room_number || '—'}</td>
                          <td><span className="category-tag">{chargeCategoryLabel(charge)}</span></td>
                          <td>{charge.billing_period || 'Unassigned'}</td>
                          <td>{charge.description || 'Additional charge'}</td>
                          <td><strong>{formatMoney(charge.amount)}</strong></td>
                          <td><StatusBadge status={charge.status} /></td>
                          <td>{charge.created_at ? formatBusinessDate(charge.created_at) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}

          {canManage && (
            <Panel
              title={`Pending Unbilled Charges (${pendingCharges.length})`}
              description="One-time charges waiting for their selected billing period to be generated."
            >
              {pendingCharges.length === 0 ? (
                <EmptyState message="No pending unbilled charges." />
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Tenant</th>
                        <th>Room</th>
                        <th>Category</th>
                        <th>Billing Period</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingCharges.map((charge) => (
                        <tr key={charge.id}>
                          <td>
                            <strong>{charge.lease?.tenant?.name}</strong>
                          </td>
                          <td>Room {charge.lease?.room?.room_number}</td>
                          <td>
                            <span className="category-tag">{chargeCategoryLabel(charge)}</span>
                          </td>
                          <td>{charge.billing_period || 'Unassigned'}</td>
                          <td>{charge.description || 'Additional charge'}</td>
                          <td>
                            <strong>{formatMoney(charge.amount)}</strong>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="button danger-outline sm"
                              onClick={() => handleVoidCharge(charge)}
                            >
                              Void
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}

          {canManage && <Panel
            title={`Billing Statements & Invoices (${invoices.length})`}
            description="Invoices issued to tenants with tracking of balances and payment statuses."
            className="spaced-panel"
          >
            {invoices.length === 0 ? (
              <EmptyState message="No invoices generated yet." />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Tenant</th>
                      <th>Room</th>
                      <th>Billing Period</th>
                      <th>Base Rent</th>
                      <th>Other Charges</th>
                      <th>Total Due</th>
                      <th>Paid</th>
                      <th>Balance</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => {
                      const isPaid = invoice.status.toLowerCase() === 'paid';
                      return (
                        <tr key={invoice.id}>
                          <td>{invoice.invoice_number || `INV-${String(invoice.id).padStart(6, '0')}`}</td>
                          <td>
                            <strong>{invoice.lease?.tenant?.name || 'Tenant'}</strong>
                          </td>
                          <td>Room {invoice.lease?.room?.room_number}</td>
                          <td>
                            <span className="period-badge">{invoice.billing_period}</span>
                          </td>
                          <td>{formatMoney(invoice.base_rent)}</td>
                          <td>{formatMoney(invoice.additional_charges_total)}</td>
                          <td>
                            <strong>{formatMoney(invoice.total_amount_due)}</strong>
                          </td>
                          <td className="text-success">{formatMoney(invoice.amount_paid)}</td>
                          <td>
                            <strong className={Number(invoice.balance) > 0 ? 'text-danger' : 'text-success'}>
                              {formatMoney(invoice.balance)}
                            </strong>
                          </td>
                          <td>{formatBusinessDate(invoice.due_date)}</td>
                          <td>
                            <StatusBadge status={invoice.status} />
                          </td>
                          <td>
                            <div className="billing-row-actions">
                              <button type="button" className="button secondary sm" onClick={() => void downloadInvoice(invoice)}>Invoice PDF</button>
                              {!isPaid && Number(invoice.balance) > 0 ? (
                                <button
                                  type="button"
                                  className={`button ${canManage ? 'secondary' : 'primary'} sm`}
                                  disabled={!canManage && preparingPaymentId !== null}
                                  onClick={() => canManage ? openPaymentModal(invoice) : void startSimulatedPayment(invoice)}
                                >
                                  {canManage ? 'Record Payment' : preparingPaymentId === invoice.id ? 'Loading…' : 'Pay Now (Simulated)'}
                                </button>
                              ) : (
                                <span className="paid-check">✓ Settled</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>}
          <PaymentHistory invoices={invoices} landlordOrAdmin={canManage} announce={announce} />
        </>
      )}

      <SimulatedPaymentModal invoice={simulatedInvoice} onClose={() => setSimulatedInvoice(null)} onComplete={handleSimulationComplete} />
      <PaymentReceipt payment={receiptPayment} invoice={receiptInvoice} onClose={() => { setReceiptPayment(null); setReceiptInvoice(undefined); }} announce={announce} />

      {/* Record Payment Modal */}
      <Modal
        isOpen={Boolean(paymentInvoice)}
        onClose={() => setPaymentInvoice(null)}
        title="Record Payment"
        maxWidth="500px"
      >
        {paymentInvoice && (
          <form className="form-stack" onSubmit={handleRecordPayment}>
            <div className="payment-summary-box">
              <p>
                <strong>Tenant:</strong> {paymentInvoice.lease?.tenant?.name}
              </p>
              <p>
                <strong>Room:</strong> Room {paymentInvoice.lease?.room?.room_number}
              </p>
              <p>
                <strong>Period:</strong> {paymentInvoice.billing_period}
              </p>
              <p>
                <strong>Outstanding Balance:</strong>{' '}
                <span className="balance-highlight">{formatMoney(paymentInvoice.balance)}</span>
              </p>
            </div>

            <Field label="Payment Amount (₱)" required>
              <input
                type="number"
                min="0.01"
                max={Number(paymentInvoice.balance)}
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                required
              />
            </Field>

            <Field label="Payment Method" required>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="cash">Cash</option>
                <option value="bank transfer">Bank Transfer</option>
                <option value="e-wallet">GCash / Maya / E-Wallet</option>
                <option value="other">Other</option>
              </select>
            </Field>

            <Field label="Reference / Notes">
              <input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Receipt #, transaction ref, or notes"
                maxLength={255}
              />
            </Field>

            <div className="form-actions">
              <button
                type="submit"
                className="button primary"
                disabled={isRecordingPayment}
              >
                {isRecordingPayment ? 'Saving…' : 'Confirm & Save Payment'}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => setPaymentInvoice(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

