import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, fetchAll } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Notice, NoticeData } from '../Common/Notice';
import { ThemeToggle } from '../Common/ThemeToggle';
import { BootstrapIcon } from '../Common/BootstrapIcon';
import { Role } from '../../types';
import { formatBusinessDateTime } from '../../utils/date';
import { notificationDestination } from '../../utils/notifications';

export interface NavItem {
  id: string;
  label: string;
  roles: Role[];
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', roles: ['admin', 'landlord', 'staff', 'tenant'], icon: 'bar-chart' },
  { id: 'accounts', label: 'User Accounts', roles: ['admin'], icon: 'person-gear' },
  { id: 'rooms', label: 'Room Listings', roles: ['admin'], icon: 'building' },
  { id: 'rooms', label: 'My Rooms', roles: ['landlord'], icon: 'building' },
  { id: 'rooms', label: 'Browse Rooms', roles: ['tenant'], icon: 'building' },
  { id: 'rooms', label: 'Rooms & Units', roles: ['staff'], icon: 'building' },
  { id: 'leases', label: 'Tenants & Leases', roles: ['landlord', 'staff'], icon: 'people' },
  { id: 'leases', label: 'My Rental', roles: ['tenant'], icon: 'people' },
  { id: 'inquiries', label: 'Room Requests', roles: ['landlord', 'staff'], icon: 'envelope' },
  { id: 'billing', label: 'Billing & Payments', roles: ['landlord', 'staff'], icon: 'credit-card' },
  { id: 'billing', label: 'My Payments', roles: ['tenant'], icon: 'credit-card' },
  { id: 'reports', label: 'Reports & Analytics', roles: ['admin', 'landlord', 'staff'], icon: 'graph-up' },
  { id: 'maintenance', label: 'Maintenance', roles: ['landlord', 'tenant'], icon: 'wrench' },
  { id: 'messages', label: 'Messages', roles: ['landlord', 'tenant'], icon: 'chat' },
  { id: 'reviews', label: 'Review Moderation', roles: ['admin'], icon: 'stars' },
  { id: 'reviews', label: 'Reviews', roles: ['tenant'], icon: 'stars' },
  { id: 'activity', label: 'Activity Log', roles: ['admin'], icon: 'activity' },
];

interface AppLayoutProps {
  currentPage: string;
  onNavigate: (pageId: string) => void;
  notice: NoticeData | null;
  onDismissNotice: () => void;
  onNewNotification: (message: string, kind?: 'success' | 'error' | 'warning' | 'info') => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentPage,
  onNavigate,
  notice,
  onDismissNotice,
  onNewNotification,
  children,
}) => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: number; title: string; body: string; read_at: string | null; created_at: string; type?: string | null; data?: Record<string, unknown> | null }>>([]);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const notificationPanelRef = useRef<HTMLDivElement>(null);
  const [notificationPanelPosition, setNotificationPanelPosition] = useState({ top: 0, left: 0 });
  const unreadCount = notifications.filter((item) => !item.read_at).length;
  const knownNotificationIds = useRef<Set<number> | null>(null);
  useEffect(() => {
    let active = true;
    knownNotificationIds.current = null;
    const load = async () => {
      try {
        const result = await fetchAll<{ id: number; title: string; body: string; read_at: string | null; created_at: string; type?: string | null; data?: Record<string, unknown> | null }>('/notifications');
        if (!active) return;
        setNotifications(result);
        if (knownNotificationIds.current === null) {
          knownNotificationIds.current = new Set(result.map((item) => item.id));
          return;
        }
        const newItems = result.filter((item) => !knownNotificationIds.current?.has(item.id));
        newItems.forEach((item) => knownNotificationIds.current?.add(item.id));
        if (newItems.length) onNewNotification(newItems.map((item) => `${item.title}: ${item.body}`).join('\n'), 'info');
      } catch { /* Notifications are supplementary. */ }
    };
    void load(); const timer = window.setInterval(load, 15000);
    window.addEventListener('bhms:notifications-refresh', load);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('bhms:notifications-refresh', load); };
  }, [user?.id, onNewNotification]);
  const openProfile = () => { onNavigate('profile'); setAccountMenuOpen(false); setMobileMenuOpen(false); };
  const updateNotificationPanelPosition = useCallback(() => {
    const button = notificationButtonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    const width = Math.min(mobile ? 420 : 360, window.innerWidth - 20);
    const left = mobile
      ? Math.max(10, Math.min((window.innerWidth - width) / 2, window.innerWidth - width - 10))
      : Math.max(10, Math.min(rect.right - width, window.innerWidth - width - 10));
    const estimatedHeight = Math.min(500, window.innerHeight * 0.72);
    const top = Math.max(10, Math.min(rect.bottom + 8, window.innerHeight - estimatedHeight - 10));
    setNotificationPanelPosition({ top, left });
  }, []);
  useEffect(() => {
    if (!notificationsOpen) return;
    updateNotificationPanelPosition();
    const reposition = () => updateNotificationPanelPosition();
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!notificationButtonRef.current?.contains(target) && !notificationPanelRef.current?.contains(target)) setNotificationsOpen(false);
    };
    const dismissEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setNotificationsOpen(false); };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissEscape);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissEscape);
    };
  }, [notificationsOpen, updateNotificationPanelPosition]);
  const markRead = async (id: number) => {
    try {
      await api(`/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((items) => items.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
      window.dispatchEvent(new Event('bhms:notifications-refresh'));
    } catch (error: any) { onNewNotification(error.message || 'Could not mark notification as read.', 'error'); }
  };
  const markAllRead = async () => {
    if (!unreadCount) return;
    try {
      await api('/notifications/read-all', { method: 'POST' });
      const readAt = new Date().toISOString();
      setNotifications((items) => items.map((item) => item.read_at ? item : { ...item, read_at: readAt }));
      window.dispatchEvent(new Event('bhms:notifications-refresh'));
    } catch (error: any) { onNewNotification(error.message || 'Could not mark notifications as read.', 'error'); }
  };
  const openNotification = async (item: (typeof notifications)[number]) => {
    if (!item.read_at) await markRead(item.id);
    setNotificationsOpen(false);
    onNavigate(notificationDestination(item));
  };

  if (!user) return null;

  const allowedNavItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const navigationItems = allowedNavItems;
  const mobileNavItems = navigationItems.filter((item) => ['dashboard', 'rooms', 'billing'].includes(item.id));
  const currentItem = currentPage === 'profile'
    ? { label: 'Account Settings' }
    : currentPage === 'notifications'
      ? { label: 'Notifications' }
    : navigationItems.find((item) => item.id === currentPage) || navigationItems[0];
  const userInitials = user.name
    ? user.name.split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
    : user.email.substring(0, 2).toUpperCase();

  const handleNavClick = (id: string) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    if (!mobileMenuOpen || !window.matchMedia('(max-width: 1023px)').matches) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    const closeOnDesktopResize = () => {
      if (window.innerWidth > 1023) setMobileMenuOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnDesktopResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnDesktopResize);
    };
  }, [mobileMenuOpen]);

  return (
    <div className={`app-shell ${mobileMenuOpen ? 'mobile-open' : ''}`}>
      <aside className={`sidebar ${mobileMenuOpen ? 'show' : ''}`}>
        <a
          className="brand"
          href="/dashboard"
          onClick={(e) => {
            e.preventDefault();
            handleNavClick('dashboard');
          }}
        >
          <img className="brand-mark" src="/bhms-logo.svg" alt="BoardEase" />
          <div className="brand-text">
            <strong>BoardEase</strong>
            <small>Boarding House Rentals</small>
          </div>
        </a>

        <button type="button" className="mobile-drawer-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation menu">×</button>

        <nav className="nav-list" aria-label="Main navigation">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-link ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              <BootstrapIcon name={item.icon} className="nav-icon" />
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button type="button" className="mobile-sidebar-action" onClick={openProfile}>Account settings</button>
          <button type="button" className="mobile-sidebar-action" onClick={logout}>Sign out</button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-toggle"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              <BootstrapIcon name="list" />
            </button>
            <img className="mobile-header-logo" src="/bhms-logo.svg" alt="BoardEase" />
            <div>
              <p className="eyebrow">PORTAL &bull; {user.role.toUpperCase()}</p>
              <h1>{currentItem ? currentItem.label : 'Management'}</h1>
            </div>
          </div>

          <div className="top-actions">
            <ThemeToggle showLabel={false} />

            <div className="header-menu-wrap">
              <button ref={notificationButtonRef} type="button" className="icon-button notification-button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={notificationsOpen} aria-controls="notification-dropdown-panel" onClick={() => { setNotificationsOpen((open) => !open); setAccountMenuOpen(false); }}><BootstrapIcon name="bell" />{unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}</button>
              {notificationsOpen && createPortal(<div ref={notificationPanelRef} id="notification-dropdown-panel" role="dialog" aria-label="Notifications" className="header-dropdown notification-dropdown notification-dropdown-portal" style={{ top: notificationPanelPosition.top, left: notificationPanelPosition.left }}><div className="notification-dropdown-heading"><strong>Notifications</strong><button type="button" onClick={() => void markAllRead()} disabled={!unreadCount}>Mark all as read</button></div>{notifications.length ? notifications.slice(0, 8).map((item) => <button type="button" key={item.id} className={`notification-item ${item.read_at ? '' : 'unread'}`} onClick={() => void openNotification(item)}><b>{item.title}</b><span>{item.body}</span><small>{formatBusinessDateTime(item.created_at)}{!item.read_at && ' · Unread'}</small></button>) : <p className="muted">No notifications yet.</p>}<button type="button" className="notification-see-all" onClick={() => { onNavigate('notifications'); setNotificationsOpen(false); }}>See All Notifications</button></div>, document.body)}
            </div>
            <div className="header-menu-wrap"><button type="button" className="account-pill" title={user.email} aria-label={`Account menu for ${user.name}`} aria-expanded={accountMenuOpen} onClick={() => { setAccountMenuOpen((open) => !open); setNotificationsOpen(false); }}><div className="avatar-circle" aria-hidden="true">{userInitials}</div><div className="account-info"><strong>{user.name}</strong><span>{user.email}</span></div><BootstrapIcon name="person" className="account-menu-icon" /></button>{accountMenuOpen && <div className="header-dropdown account-dropdown"><button type="button" onClick={openProfile}><BootstrapIcon name="person-gear" /> Account settings</button></div>}</div>
            <button
              type="button"
              className="button secondary signout-btn"
              onClick={logout}
              title="Sign out of your account"
            >
              Sign out
            </button>
          </div>
        </header>

        <Notice notice={notice} onDismiss={onDismissNotice} />

        <div className="page-content">{children}</div>
      </main>
      <nav className="mobile-bottom-nav" aria-label="Quick navigation">
        {mobileNavItems.map((item) => <button key={item.id} type="button" className={`mobile-bottom-nav-item ${currentPage === item.id ? 'active' : ''}`} onClick={() => handleNavClick(item.id)} aria-current={currentPage === item.id ? 'page' : undefined}>
          <BootstrapIcon name={item.icon} /><small>{item.id === 'rooms' && user.role === 'tenant' ? 'Rooms' : item.label}</small>
        </button>)}
        <button type="button" className={`mobile-bottom-nav-item ${mobileMenuOpen ? 'active' : ''}`} onClick={() => setMobileMenuOpen((prev) => !prev)} aria-expanded={mobileMenuOpen}>
          <BootstrapIcon name="list" /><small>More</small>
        </button>
      </nav>
    </div>
  );
};

