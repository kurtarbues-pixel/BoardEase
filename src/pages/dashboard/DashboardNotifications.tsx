import React, { useCallback, useEffect, useState } from 'react';
import { api, fetchAll } from '../../api/client';
import { AppNotification } from '../../types/notification';
import { Panel } from '../../components/Common/Panel';
import { EmptyState } from '../../components/Common/States';
import { formatBusinessDateTime } from '../../utils/date';

interface Props { onNavigate: (pageId: string) => void; }

export const DashboardNotifications: React.FC<Props> = ({ onNavigate }) => {
  const [items, setItems] = useState<AppNotification[]>([]);
  const load = useCallback(async () => {
    try { setItems(await fetchAll<AppNotification>('/notifications')); } catch { /* The dashboard still works when notifications are unavailable. */ }
  }, []);
  useEffect(() => { void load(); const timer = window.setInterval(load, 30000); return () => window.clearInterval(timer); }, [load]);
  const markRead = async (item: AppNotification) => {
    if (item.read_at) return;
    try {
      const updated = await api<AppNotification>(`/notifications/${item.id}/read`, { method: 'PATCH' });
      setItems((current) => current.map((row) => row.id === item.id ? updated : row));
      window.dispatchEvent(new Event('bhms:notifications-refresh'));
    } catch { /* Leave the notification unread if saving it fails. */ }
  };
  const recent = items.slice(0, 4);
  return <Panel className="dashboard-notification-panel" title="Recent notifications" description="Updates for your account." action={<button type="button" className="action-link-btn" onClick={() => onNavigate('notifications')}>View all</button>}>
    {recent.length ? <div className="dashboard-notification-list">{recent.map((item) => <button type="button" className={`dashboard-notification-item ${item.read_at ? '' : 'unread'}`} key={item.id} onClick={() => void markRead(item)}><span className="dashboard-notification-dot" aria-hidden="true"/><span className="dashboard-notification-content"><strong>{item.title}</strong><span>{item.body}</span><small>{formatBusinessDateTime(item.created_at)}</small></span><span className="dashboard-notification-state">{item.read_at ? 'Read' : 'Unread'}</span></button>)}</div> : <EmptyState message="New updates will appear here." />}
  </Panel>;
};
