import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, fetchAll, formatMoney } from '../../api/client';
import { Inquiry } from '../../types';
import { StatusBadge } from '../../components/Common/StatusBadge';
import { LoadingState, EmptyState, ErrorState } from '../../components/Common/States';
import { formatBusinessDate, formatBusinessDateTime } from '../../utils/date';

interface InquiriesPageProps {
  announce: (message: string, kind?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const InquiriesPage: React.FC<InquiriesPageProps> = ({ announce }) => {
  const { user } = useAuth();
  const canManage = user?.role === 'landlord' || user?.role === 'staff';
  const isAdmin = user?.role === 'admin';

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);

  const loadInquiries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAll<Inquiry>('/inquiries');
      setInquiries(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load room requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInquiries();
  }, [loadInquiries]);

  const handleDecision = async (inquiry: Inquiry, action: 'approve' | 'reject') => {
    const isApprove = action === 'approve';
    const confirmMessage = isApprove
      ? `Offer Room ${inquiry.room?.room_number} to ${inquiry.tenant?.name || 'tenant'}? The room will be held for 24 hours while they respond.`
      : `Decline request from ${inquiry.tenant?.name || 'tenant'}?`;

    if (!window.confirm(confirmMessage)) return;

    setProcessingId(inquiry.id);
    try {
      await api(`/inquiries/${inquiry.id}/${action}`, { method: 'POST' });
      announce(
        isApprove
          ? 'Rental offer sent. The room is held for 24 hours.'
          : 'Request has been declined.'
      );
      await loadInquiries();
    } catch (err: any) {
      announce(err.message || 'Action could not be completed.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="inquiries-page">
      <div className="welcome-block">
        <div>
          <h2>{canManage ? 'Applications for My Rooms' : isAdmin ? 'Application Oversight' : 'My Rental Requests'}</h2>
          <p className="muted">
            {canManage
              ? 'Review applications for your listings. Select an applicant to send a 24-hour rental offer.'
              : isAdmin ? 'Review application status across the platform.' : 'Track your rental applications and respond to any offer within 24 hours.'}
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading requests…" />
      ) : error ? (
        <ErrorState error={error} retry={loadInquiries} />
      ) : inquiries.length === 0 ? (
        <EmptyState
          title="No room requests"
          message={
            canManage
              ? 'There are currently no incoming rental requests from tenants.'
              : "You haven't submitted any room requests yet. Check the Rooms page to find an available room!"
          }
        />
      ) : (
        <div className="request-list">
          {inquiries.map((inquiry) => {
            const isPending = inquiry.status.toLowerCase() === 'pending';
            const offerPending = inquiry.status.toLowerCase() === 'approved' && Boolean(inquiry.offer_expires_at && new Date(inquiry.offer_expires_at) > new Date());
            const isProcessing = processingId === inquiry.id;

            return (
              <article key={inquiry.id} className="request-card">
                <div className="request-card-info">
                  <div className="row-heading">
                    <h3>
                      {inquiry.room?.title || `Room ${inquiry.room?.room_number}`}
                    </h3>
                    <StatusBadge status={inquiry.status} />
                  </div>

                  <p className="muted">
                    Room {inquiry.room?.room_number} · {inquiry.room?.location} ·{' '}
                    <strong>{formatMoney(inquiry.room?.price)}</strong> / month
                  </p>

                  {inquiry.message && (
                    <div className="inquiry-message">
                      <p>"{inquiry.message}"</p>
                    </div>
                  )}

                  <div className="inquiry-meta">
                    {user?.role !== 'tenant' && <small>
                      <strong>Tenant:</strong> {inquiry.tenant?.name} ({inquiry.tenant?.email}
                      {inquiry.tenant?.phone ? ` · ${inquiry.tenant.phone}` : ''})
                    </small>}
                    {inquiry.created_at && (
                      <small className="date-sub">
                        Submitted: {formatBusinessDate(inquiry.created_at)}
                      </small>
                    )}
                    {offerPending && <small className="date-sub">Offer expires: {formatBusinessDateTime(inquiry.offer_expires_at)}</small>}
                    {inquiry.decision_reason && <small className="date-sub">Decision note: {inquiry.decision_reason}</small>}
                  </div>
                </div>

                {canManage && isPending && (
                  <div className="inline-actions">
                    <button
                      type="button"
                      className="button primary"
                      disabled={isProcessing}
                      onClick={() => handleDecision(inquiry, 'approve')}
                    >
                      {isProcessing ? 'Processing…' : 'Send 24-hour Offer'}
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      disabled={isProcessing}
                      onClick={() => handleDecision(inquiry, 'reject')}
                    >
                      Decline
                    </button>
                  </div>
                )}
                {user?.role === 'tenant' && offerPending && (
                  <div className="inline-actions">
                    <button type="button" className="button primary" disabled={isProcessing} onClick={async () => {
                      if (!window.confirm(`Accept the offer for Room ${inquiry.room?.room_number}? This will start your lease.`)) return;
                      setProcessingId(inquiry.id);
                      try { await api(`/inquiries/${inquiry.id}/accept`, { method: 'POST' }); announce('Offer accepted. Please review and accept your digital lease agreement in My Lease.'); await loadInquiries(); }
                      catch (err: any) { announce(err.message || 'Could not accept offer.', 'error'); }
                      finally { setProcessingId(null); }
                    }}>Accept Offer</button>
                    <button type="button" className="button secondary" disabled={isProcessing} onClick={async () => {
                      if (!window.confirm('Decline this room offer? The room will become available to other applicants.')) return;
                      setProcessingId(inquiry.id);
                      try { await api(`/inquiries/${inquiry.id}/decline`, { method: 'POST' }); announce('Offer declined.'); await loadInquiries(); }
                      catch (err: any) { announce(err.message || 'Could not decline offer.', 'error'); }
                      finally { setProcessingId(null); }
                    }}>Decline Offer</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

