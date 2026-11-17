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

export const App: React.FC = () => {
  const { user, isLoading, logout } = useAuth();
  const logoutRef = useRef(logout);
  logoutRef.current = logout;
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [tenantRentalSection, setTenantRentalSection] = useState<'rental' | 'applications'>('rental');
  const [messageLeaseId, setMessageLeaseId] = useState<number | null>(null);
  const [isResetRoute, setIsResetRoute] = useState(window.location.pathname === '/reset-password');
  const [notice, setNotice] = useState<NoticeData | null>(null);
  const noticeTimer = useRef<number | null>(null);

  useEffect(() => {
    // Do not carry a previous user's page selection into a new session.
    setCurrentPage('dashboard');
    setTenantRentalSection('rental');
    setMessageLeaseId(null);
  }, [user?.id, user?.role]);

  useEffect(() => {
    const syncResetRoute = () => setIsResetRoute(window.location.pathname.replace(/\/+$/, '') === '/reset-password');
    window.addEventListener('popstate', syncResetRoute);
    return () => window.removeEventListener('popstate', syncResetRoute);
  }, []);

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

  if (isResetRoute) return <ResetPasswordPage onComplete={() => { window.history.replaceState({}, '', '/login?password_reset=1'); setIsResetRoute(false); }} />;

  if (!user) {
    return <AuthPage onSuccessNotice={(msg) => announce(msg, 'success')} />;
  }

  const navigateToPage = (pageId: string) => {
    if (user.role === 'tenant' && pageId === 'inquiries') {
      setTenantRentalSection('applications');
      setCurrentPage('leases');
      return;
    }
    if (user.role === 'admin' && ['leases', 'billing'].includes(pageId)) {
      setCurrentPage('reports');
      return;
    }
    if (user.role === 'admin' && pageId === 'inquiries') {
      setCurrentPage('dashboard');
      return;
    }
    if (user.role === 'tenant' && pageId === 'leases') setTenantRentalSection('rental');
    const isCommonPage = pageId === 'profile' || pageId === 'notifications';
    const isAllowedPage = NAV_ITEMS.some((item) => item.id === pageId && item.roles.includes(user.role));
    setCurrentPage(isCommonPage || isAllowedPage ? pageId : 'dashboard');
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

