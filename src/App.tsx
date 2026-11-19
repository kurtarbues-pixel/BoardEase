import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './context/AuthContext';
import { AppLayout, NAV_ITEMS } from './components/Layout/AppLayout';
import { NoticeData } from './components/Common/Notice';
import { AuthPage } from './pages/auth/AuthPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { RoomsPage } from './pages/rooms/RoomsPage';
import { LeasesPage } from './pages/leases/LeasesPage';
import { InquiriesPage } from './pages/inquiries/InquiriesPage';
import { BillingPage } from './pages/billing/BillingPage';
import { AccountsPage } from './pages/accounts/AccountsPage';
import { ActivityPage } from './pages/activity/ActivityPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { MaintenancePage } from './pages/maintenance/MaintenancePage';
import { MessagesPage } from './pages/messages/MessagesPage';
import { ReviewsPage } from './pages/reviews/ReviewsPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { Role } from './types';

const VALID_PAGES = [
  'dashboard',
  'accounts',
  'rooms',
  'leases',
  'inquiries',
  'billing',
  'reports',
  'maintenance',
  'messages',
  'reviews',
  'activity',
  'profile',
  'notifications',
] as const;

type PageId = typeof VALID_PAGES[number];

function resolvePageFromPath(pathname: string): PageId | null {
  const clean = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  if ((VALID_PAGES as readonly string[]).includes(clean)) {
    return clean as PageId;
  }
  return null;
}

function getValidPageForUser(pageId: string, role?: Role): PageId {
  if (!role) return 'dashboard';
  if (role === 'tenant' && pageId === 'inquiries') return 'leases';
  if (role === 'admin' && ['leases', 'billing'].includes(pageId)) return 'reports';
  if (role === 'admin' && pageId === 'inquiries') return 'dashboard';
  if (pageId === 'profile' || pageId === 'notifications') return pageId as PageId;
  const isAllowed = NAV_ITEMS.some((item) => item.id === pageId && item.roles.includes(role));
  return isAllowed ? (pageId as PageId) : 'dashboard';
}

export const App: React.FC = () => {
  const { user, isLoading, logout } = useAuth();
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  const [currentPage, setCurrentPage] = useState<PageId>(() => {
    const fromUrl = resolvePageFromPath(window.location.pathname);
    return fromUrl || 'dashboard';
  });
  const [tenantRentalSection, setTenantRentalSection] = useState<'rental' | 'applications'>('rental');
  const [messageLeaseId, setMessageLeaseId] = useState<number | null>(null);
  const [isResetRoute, setIsResetRoute] = useState(window.location.pathname.replace(/\/+$/, '') === '/reset-password');
  const [notice, setNotice] = useState<NoticeData | null>(null);
  const noticeTimer = useRef<number | null>(null);

  // Sync route and page state when authenticated user is loaded or changes role
  useEffect(() => {
    if (!user) return;

    const fromUrl = resolvePageFromPath(window.location.pathname);
    const validPage = getValidPageForUser(fromUrl || 'dashboard', user.role);

    setCurrentPage(validPage);
    setMessageLeaseId(null);

    const canonicalPath = `/${validPage}`;
    if (window.location.pathname !== canonicalPath) {
      window.history.replaceState({}, '', canonicalPath);
    }
  }, [user?.id, user?.role]);

  // Handle browser Back / Forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const isReset = window.location.pathname.replace(/\/+$/, '') === '/reset-password';
      setIsResetRoute(isReset);
      if (isReset) return;

      if (!user) return;

      const fromUrl = resolvePageFromPath(window.location.pathname);
      const validPage = getValidPageForUser(fromUrl || 'dashboard', user.role);
      setCurrentPage(validPage);

      const targetPath = `/${validPage}`;
      if (window.location.pathname !== targetPath) {
        window.history.replaceState({}, '', targetPath);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user]);

  const announce = useCallback(
    (message: string, kind: 'success' | 'error' | 'warning' | 'info' = 'success') => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
      setNotice({ message, kind });
      noticeTimer.current = window.setTimeout(() => {
        setNotice(null);
        noticeTimer.current = null;
      }, 5000);
    },
    []
  );

  useEffect(() => () => {
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
  }, []);

  useEffect(() => {
    if (!user) return;
    let timeoutId = 0;
    const resetIdleTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => { void logoutRef.current(); }, 30 * 60 * 1000);
    };
    const activityEvents: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'mousemove', 'touchstart'];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer, { passive: true }));
    resetIdleTimer();
    return () => {
      window.clearTimeout(timeoutId);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer));
    };
  }, [user]);

  if (isLoading) {
    return (
      <div className="loading-state" style={{ minHeight: '100vh' }}>
        <div className="spinner" aria-hidden="true"></div>
        <p>Connecting to BoardEase…</p>
      </div>
    );
  }

  if (isResetRoute) {
    return (
      <ResetPasswordPage
        onComplete={() => {
          window.history.replaceState({}, '', '/login?password_reset=1');
          setIsResetRoute(false);
        }}
      />
    );
  }

  if (!user) {
    return <AuthPage onSuccessNotice={(msg) => announce(msg, 'success')} />;
  }

  const navigateToPage = (pageId: string, replace = false) => {
    const validPage = getValidPageForUser(pageId, user.role);

    if (user.role === 'tenant') {
      if (pageId === 'inquiries') {
        setTenantRentalSection('applications');
      } else if (pageId === 'leases') {
        setTenantRentalSection('rental');
      }
    }

    setCurrentPage(validPage);

    const targetPath = `/${validPage}`;
    if (window.location.pathname !== targetPath) {
      if (replace) {
        window.history.replaceState({}, '', targetPath);
      } else {
        window.history.pushState({}, '', targetPath);
      }
    }
  };

  const contactLandlord = (leaseId: number) => {
    setMessageLeaseId(leaseId);
    navigateToPage('messages');
  };

  const allowedNav = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const activePageId = currentPage === 'profile' || currentPage === 'notifications' || allowedNav.some((item) => item.id === currentPage)
    ? currentPage
    : 'dashboard';

  return (
    <AppLayout
      currentPage={activePageId}
      onNavigate={navigateToPage}
      notice={notice}
      onDismissNotice={() => setNotice(null)}
      onNewNotification={announce}
    >
      {activePageId === 'dashboard' && <DashboardPage onNavigate={navigateToPage} onContactLandlord={contactLandlord} announce={announce} />}
      {activePageId === 'rooms' && <RoomsPage announce={announce} onNavigate={navigateToPage} />}
      {activePageId === 'leases' && user.role === 'tenant' ? (
        <div className="tenant-rental-page">
          <nav className="tenant-rental-tabs" aria-label="My rental sections">
            <button type="button" aria-current={tenantRentalSection === 'rental' ? 'page' : undefined} className={tenantRentalSection === 'rental' ? 'active' : ''} onClick={() => setTenantRentalSection('rental')}>
              Current Rental &amp; Lease
            </button>
            <button type="button" aria-current={tenantRentalSection === 'applications' ? 'page' : undefined} className={tenantRentalSection === 'applications' ? 'active' : ''} onClick={() => setTenantRentalSection('applications')}>
              My Applications
            </button>
          </nav>
          {tenantRentalSection === 'applications' ? <InquiriesPage announce={announce} /> : <LeasesPage announce={announce} />}
        </div>
      ) : activePageId === 'leases' ? <LeasesPage announce={announce} /> : null}
      {activePageId === 'inquiries' && user.role !== 'tenant' && <InquiriesPage announce={announce} />}
      {activePageId === 'billing' && <BillingPage announce={announce} />}
      {activePageId === 'maintenance' && <MaintenancePage announce={announce} />}
      {activePageId === 'messages' && <MessagesPage announce={announce} initialLeaseId={messageLeaseId} onInitialConversationHandled={() => setMessageLeaseId(null)} />}
      {activePageId === 'reviews' && <ReviewsPage announce={announce} />}
      {activePageId === 'notifications' && <NotificationsPage announce={announce} onNavigate={navigateToPage} />}
      {activePageId === 'reports' && <ReportsPage onNavigate={navigateToPage} />}
      {activePageId === 'accounts' && <AccountsPage announce={announce} />}
      {activePageId === 'activity' && <ActivityPage />}
      {activePageId === 'profile' && <ProfilePage announce={announce} />}
    </AppLayout>
  );
};
