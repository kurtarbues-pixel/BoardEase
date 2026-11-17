import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, fetchAll, formatMoney } from '../../api/client';
import { AdminDashboardData, Invoice, Lease, Room } from '../../types';
import { Panel } from '../../components/Common/Panel';
import { LoadingState, EmptyState, ErrorState } from '../../components/Common/States';
import { formatBusinessDateTime, getCurrentMonthString } from '../../utils/date';

interface LandlordSummary { tenant_count: number; monthly_revenue: string | number; overdue_invoices_count: number; overdue_amount: string | number; }
interface ReportPayment { id: number; invoice: Invoice; amount: number | string; method: string; reference_number?: string | null; paid_at?: string | null; created_at?: string; }
interface Props { onNavigate: (pageId: string) => void; }

export const ReportsPage: React.FC<Props> = ({ onNavigate }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [rooms, setRooms] = useState<Room[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [adminSummary, setAdminSummary] = useState<AdminDashboardData | null>(null);
  const [landlordSummary, setLandlordSummary] = useState<LandlordSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [roomRows, leaseRows, invoiceRows, summary] = await Promise.all([
        fetchAll<Room>('/rooms?per_page=50'), fetchAll<Lease>('/leases'), fetchAll<Invoice>('/invoices'),
        isAdmin ? api<AdminDashboardData>('/admin/dashboard') : api<LandlordSummary>('/landlord/dashboard'),
      ]);
      setRooms(roomRows); setLeases(leaseRows); setInvoices(invoiceRows);
      if (isAdmin) setAdminSummary(summary as AdminDashboardData); else setLandlordSummary(summary as LandlordSummary);
    } catch (err: any) { setError(err.message || 'Could not load reports.'); }
    finally { setLoading(false); }
  }, [isAdmin]);
  useEffect(() => { void load(); }, [load]);

  const currentPeriod = getCurrentMonthString();
  const currentInvoices = invoices.filter((invoice) => invoice.billing_period === currentPeriod);
  const activeLeases = leases.filter((lease) => lease.status === 'active');
  const currentPayments = currentInvoices.reduce((sum, invoice) => sum + Number(invoice.amount_paid || 0), 0);
  const openBalance = invoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.balance || 0)), 0);
  const roomStatus = useMemo(() => [
    { label: 'Occupied', count: rooms.filter((room) => room.status === 'occupied').length },
    { label: 'Available', count: rooms.filter((room) => room.status === 'available').length },
    { label: 'Reserved', count: rooms.filter((room) => room.status === 'reserved').length },
    { label: 'Maintenance', count: rooms.filter((room) => room.status === 'maintenance').length },
  ], [rooms]);
  const paymentRows: ReportPayment[] = invoices.flatMap((invoice) => (invoice.payments || [])
    .filter((payment) => payment.transaction_status !== 'failed' && payment.paid_at)
    .map((payment) => ({ ...payment, invoice })))
    .sort((a, b) => new Date(b.paid_at || b.created_at || 0).getTime() - new Date(a.paid_at || a.created_at || 0).getTime())
    .slice(0, 10);
  const occupancy = rooms.length ? Math.round((roomStatus[0].count / rooms.length) * 100) : 0;
  const tenantCount = isAdmin ? adminSummary?.users.tenants || 0 : landlordSummary?.tenant_count || 0;
  const userCount = isAdmin ? adminSummary?.users.total || 0 : tenantCount;

  return <div className="reports-page">
    <div className="welcome-block"><div><h2>{isAdmin ? 'System reports' : 'Property reports'}</h2><p className="muted">{isAdmin ? 'Platform-wide summaries from existing accounts, room, lease, and invoice records.' : 'Summaries are limited to your rooms, leases, tenants, and payment records.'}</p></div></div>
    {loading ? <LoadingState message="Preparing reports from your records…" /> : error ? <ErrorState error={error} retry={() => void load()} /> : <>
      <div className="report-stat-grid">
        {isAdmin && <article className="report-stat-card"><span>Registered users</span><strong>{userCount.toLocaleString()}</strong><small>{adminSummary?.users.landlords || 0} landlords · {tenantCount} tenants</small></article>}
        {!isAdmin && <article className="report-stat-card"><span>Tenants with leases</span><strong>{tenantCount.toLocaleString()}</strong><small>Based on your rental records</small></article>}
        <article className="report-stat-card"><span>Total rooms</span><strong>{rooms.length.toLocaleString()}</strong><small>{roomStatus[0].count} occupied · {roomStatus[1].count} available</small></article>
        <article className="report-stat-card"><span>Occupancy</span><strong>{occupancy}%</strong><small>{roomStatus[0].count} of {rooms.length} rooms</small></article>
        <article className="report-stat-card"><span>Active leases</span><strong>{activeLeases.length.toLocaleString()}</strong><small>{leases.length} total lease records</small></article>
        <article className="report-stat-card"><span>Collected this month</span><strong>{formatMoney(isAdmin ? adminSummary?.finance.monthly_collected : landlordSummary?.monthly_revenue)}</strong><small>{currentInvoices.length} invoices in {currentPeriod}</small></article>
        <article className="report-stat-card"><span>Outstanding balances</span><strong>{formatMoney(openBalance)}</strong><small>{isAdmin ? adminSummary?.finance.overdue_count || 0 : landlordSummary?.overdue_invoices_count || 0} overdue invoices</small></article>
      </div>
      <div className="reports-grid">
        <Panel title="Room availability" description={`${occupancy}% of recorded rooms are currently occupied.`}>
          <div className="report-status-list">{roomStatus.map((row) => <div className="report-status-row" key={row.label}><span>{row.label}</span><strong>{row.count}</strong><span className="report-status-track"><i style={{ width: `${rooms.length ? (row.count / rooms.length) * 100 : 0}%` }} /></span></div>)}</div>
        </Panel>
        <Panel title="Lease summary" description="Current records by lease status.">
          <div className="report-lease-list">{(['active', 'ended', 'terminated'] as const).map((status) => <div key={status}><span>{status[0].toUpperCase() + status.slice(1)}</span><strong>{leases.filter((lease) => lease.status === status).length}</strong></div>)}</div>
          {!isAdmin && <button type="button" className="button secondary sm" onClick={() => onNavigate('leases')}>Open leases</button>}
        </Panel>
      </div>
      <Panel title="Recent successful payments" description={`Latest recorded payments from ${isAdmin ? 'all platform invoices' : 'your leases'}.`}>
        {paymentRows.length ? <><div className="table-scroll report-payment-table"><table><thead><tr>{isAdmin && <th>Tenant</th>}<th>Room</th><th>Invoice period</th><th>Reference</th><th>Method</th><th>Amount</th><th>Date</th></tr></thead><tbody>{paymentRows.map(({ id, invoice, amount, method, reference_number, paid_at, created_at }) => <tr key={id}>{isAdmin && <td>{invoice.lease?.tenant?.name || 'Tenant'}</td>}<td>{invoice.lease?.room?.room_number ? `Room ${invoice.lease.room.room_number}` : '—'}</td><td>{invoice.billing_period}</td><td>{reference_number || 'Recorded payment'}</td><td>{method.replace(/_simulated/g, ' (Simulated)')}</td><td><strong>{formatMoney(amount)}</strong></td><td>{formatBusinessDateTime(paid_at || created_at)}</td></tr>)}</tbody></table></div><div className="report-payment-cards">{paymentRows.map(({ id, invoice, amount, method, reference_number, paid_at, created_at }) => <article key={id}><strong>{formatMoney(amount)}</strong><span>Room {invoice.lease?.room?.room_number || '—'} · {invoice.billing_period}</span><small>{method.replace(/_simulated/g, ' (Simulated)')} · {reference_number || 'Recorded payment'}</small><small>{formatBusinessDateTime(paid_at || created_at)}</small></article>)}</div></> : <EmptyState message="No successful payments have been recorded yet." />}
      </Panel>
      <Panel title="Invoice status" description="Current balances from existing invoice records."><div className="report-invoice-summary"><div><span>Invoiced this month</span><strong>{formatMoney(currentInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount_due || 0), 0))}</strong></div><div><span>Paid this month</span><strong>{formatMoney(currentPayments)}</strong></div><div><span>Open invoices</span><strong>{invoices.filter((invoice) => Number(invoice.balance) > 0).length}</strong></div></div>{!isAdmin && <button type="button" className="button secondary sm" onClick={() => onNavigate('billing')}>Open billing records</button>}</Panel>
    </>}</div>;
};
