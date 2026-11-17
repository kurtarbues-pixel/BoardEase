import React, { useCallback, useEffect, useState } from 'react';
import { api, fetchAll } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Lease } from '../../types';
import { Panel } from '../../components/Common/Panel';
import { Field } from '../../components/Common/Field';
import { LoadingState, EmptyState, ErrorState } from '../../components/Common/States';
import { StatusBadge } from '../../components/Common/StatusBadge';
import { formatBusinessDate } from '../../utils/date';

interface Review { id: number; lease_id: number; rating: number; review: string; status: 'pending' | 'approved' | 'rejected'; created_at: string; room?: { room_number: string; title: string }; tenant?: { name: string }; }
interface Eligibility { lease: Lease; review: Review | null; }
interface Props { announce: (message: string, kind?: 'success' | 'error' | 'warning' | 'info') => void; }

export const ReviewsPage: React.FC<Props> = ({ announce }) => {
  const { user } = useAuth(); const admin = user?.role === 'admin';
  const [eligible, setEligible] = useState<Eligibility[]>([]); const [reviews, setReviews] = useState<Review[]>([]);
  const [drafts, setDrafts] = useState<Record<number, { rating: number; review: string }>>({});
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try {
    if (admin) setReviews(await fetchAll<Review>('/admin/reviews'));
    else setEligible((await fetchAll<Eligibility>('/reviews/mine')));
  } catch (err: any) { setError(err.message || 'Could not load reviews.'); } finally { setLoading(false); } }, [admin]);
  useEffect(() => { void load(); }, [load]);
  const submit = async (event: React.FormEvent, row: Eligibility) => { event.preventDefault(); const draft = drafts[row.lease.id]; if (!draft) return;
    try { await api(`/leases/${row.lease.id}/reviews`, { method: 'POST', body: draft }); announce('Review submitted for moderation.'); await load(); }
    catch (err: any) { announce(err.message || 'Could not submit review.', 'error'); }
  };
  const moderate = async (review: Review, status: 'approved' | 'rejected') => { try { await api(`/admin/reviews/${review.id}`, { method: 'PATCH', body: { status } }); announce(`Review ${status}.`); await load(); } catch (err: any) { announce(err.message || 'Could not moderate review.', 'error'); } };
  return <div className="feature-page"><div className="welcome-block"><div><h2>{admin ? 'Review moderation' : 'Ratings & reviews'}</h2><p className="muted">{admin ? 'Review tenant feedback before it appears on room listings.' : 'Share feedback after your completed rental has been reviewed at move-out.'}</p></div></div>
    <Panel title={admin ? 'Submitted reviews' : 'Your rentals'} description={admin ? 'Approved reviews are displayed publicly on their room listing.' : 'One review is allowed per completed rental.'}>
      {loading ? <LoadingState /> : error ? <ErrorState error={error} retry={() => void load()} /> : admin ? reviews.length ? <div className="review-list">{reviews.map((review) => <article className="review-card" key={review.id}><div className="review-card-head"><div><h3>Room {review.room?.room_number} · {review.room?.title}</h3><p className="muted">{review.tenant?.name} · {formatBusinessDate(review.created_at)}</p></div><StatusBadge status={review.status} /></div><div className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div><p>{review.review}</p>{review.status === 'pending' && <div className="actions-cluster"><button className="button primary sm" onClick={() => void moderate(review, 'approved')}>Approve</button><button className="button danger-outline sm" onClick={() => void moderate(review, 'rejected')}>Reject</button></div>}</article>)}</div> : <EmptyState message="No reviews have been submitted." /> : eligible.length ? <div className="review-list">{eligible.map(({ lease, review }) => <article className="review-card" key={lease.id}><h3>Room {lease.room?.room_number} · {lease.room?.title}</h3><p className="muted">Lease {lease.start_date} to {lease.end_date || 'ongoing'} · {lease.status}</p>{review ? <><div className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div><p>{review.review}</p><StatusBadge status={review.status} /></> : lease.status !== 'ended' ? <p className="muted">A review becomes available after the lease ends.</p> : !lease.inspections?.some((inspection) => inspection.kind === 'move_out' && inspection.status === 'completed') ? <p className="muted">A completed move-out inspection is required before submitting a review.</p> : <form className="review-form" onSubmit={(event) => void submit(event, { lease, review })}><Field label="Rating" required><select value={drafts[lease.id]?.rating || ''} onChange={(event) => setDrafts((old) => ({ ...old, [lease.id]: { rating: Number(event.target.value), review: old[lease.id]?.review || '' } }))} required><option value="">Choose a rating</option>{[5,4,3,2,1].map((rating) => <option key={rating} value={rating}>{rating} star{rating === 1 ? '' : 's'}</option>)}</select></Field><Field label="Your review" hint="At least 10 characters" required><textarea rows={4} minLength={10} maxLength={3000} value={drafts[lease.id]?.review || ''} onChange={(event) => setDrafts((old) => ({ ...old, [lease.id]: { rating: old[lease.id]?.rating || 0, review: event.target.value } }))} required /></Field><button className="button primary">Submit review</button></form>}</article>)}</div> : <EmptyState message="Your rental history will appear here." />}
    </Panel></div>;
};
