import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, fetchAll } from '../../api/client';
import { AppNotification } from '../../types/notification';
import { Panel } from '../../components/Common/Panel';
import { LoadingState, EmptyState, ErrorState } from '../../components/Common/States';
import { formatBusinessDateTime } from '../../utils/date';
import { notificationDestination } from '../../utils/notifications';

type Filter = 'all' | 'unread' | 'read';
interface Props { announce: (message: string, kind?: 'success' | 'error' | 'warning' | 'info') => void; onNavigate: (pageId: string) => void; }

export const NotificationsPage: React.FC<Props> = ({ announce, onNavigate }) => {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const load = useCallback(async () => {
    setError('');
    try { setItems(await fetchAll<AppNotification>('/notifications')); }
    catch (err: any) { setError(err.message || 'Could not load notifications.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); const timer = window.setInterval(() => { void load(); }, 30000); return () => window.clearInterval(timer); }, [load]);
  const unreadCount = useMemo(() => items.filter((item) => !item.read_at).length, [items]);
  const visibleItems = useMemo(() => items.filter((item) => filter === 'all' || (filter === 'read' ? Boolean(item.read_at) : !item.read_at)), [items, filter]);
  const markRead = async (item: AppNotification) => {
    if (item.read_at) return;
    try { const updated = await api<AppNotification>(`/notifications/${item.id}/read`, { method: 'PATCH' }); setItems((rows) => rows.map((row) => row.id === item.id ? updated : row)); window.dispatchEvent(new Event('bhms:notifications-refresh')); }
    catch (err: any) { announce(err.message || 'Could not mark this notification as read.', 'error'); }
  };
  const markAllRead = async () => {
    if (!unreadCount) return;
    setUpdating(true);
    try { await api('/notifications/read-all', { method: 'POST' }); const readAt = new Date().toISOString(); setItems((rows) => rows.map((row) => row.read_at ? row : { ...row, read_at: readAt })); window.dispatchEvent(new Event('bhms:notifications-refresh')); announce('All notifications marked as read.'); }
    catch (err: any) { announce(err.message || 'Could not update notifications.', 'error'); }
    finally { setUpdating(false); }
  };
  const openNotification = async (item: AppNotification) => { await markRead(item); onNavigate(notificationDestination(item)); };
  return <div className="feature-page"><div className="welcome-block"><div><h2>Notifications</h2><p className="muted">Bookings, invoices, payments, maintenance, messages, and lease updates.</p></div><button type="button" className="button secondary" onClick={() => void markAllRead()} disabled={!unreadCount || updating}>{updating ? 'Updating…' : `Mark all read${unreadCount ? ` (${unreadCount})` : ''}`}</button></div>
    <Panel title="Your updates" description="Notifications are private to your account and refresh automatically.">
      <div className="notification-filters" role="group" aria-label="Filter notifications">{(['all', 'unread', 'read'] as Filter[]).map((value) => <button key={value} type="button" className={`filter-chip ${filter === value ? 'active' : ''}`} onClick={() => setFilter(value)}>{value[0].toUpperCase() + value.slice(1)}{value === 'unread' ? ` (${unreadCount})` : ''}</button>)}</div>
      {loading ? <LoadingState message="Loading notifications…" /> : error ? <ErrorState error={error} retry={() => void load()} /> : visibleItems.length ? <div className="notification-page-list">{visibleItems.map((item) => <article className={`notification-page-item ${item.read_at ? 'is-read' : 'is-unread'}`} key={item.id}><button type="button" className="notification-page-open" onClick={() => void openNotification(item)}><span className="notification-page-copy"><span className="notification-page-title"><strong>{item.title}</strong>{!item.read_at && <span className="notification-unread-label">New</span>}</span><span className="notification-page-body">{item.body}</span><small>{formatBusinessDateTime(item.created_at)}</small></span></button>{!item.read_at && <button type="button" className="button secondary sm" onClick={() => void markRead(item)}>Mark read</button>}</article>)}</div> : <EmptyState title={`No ${filter === 'all' ? '' : `${filter} `}notifications`} message={filter === 'unread' ? 'You are all caught up.' : 'Updates will appear here when there is activity on your account.'} />}
    </Panel>
  </div>;
};
