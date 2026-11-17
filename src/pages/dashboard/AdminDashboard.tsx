import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { formatMoney } from '../../api/client';
import { AdminDashboardData, User } from '../../types';
import { BootstrapIcon } from '../../components/Common/BootstrapIcon';
import { formatBusinessDate, formatBusinessDateTime, getTodayDateString } from '../../utils/date';

interface AdminDashboardProps {
  data: AdminDashboardData;
  onNavigate: (pageId: string) => void;
  onRefresh?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ data, onNavigate }) => {
  const { user } = useAuth();

  const currentDateStr = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric', timeZone: 'Asia/Manila' }).format(new Date(`${getTodayDateString()}T12:00:00+08:00`));

  // Calculate highest weekly activity for bar chart scaling
  const maxBarValue = Math.max(
    ...data.weekly_activity.map((w) => Math.max(w.inquiries, w.payments, w.users, 1)),
    5
  );

  // Room type category calculation
  const roomTypeEntries = Object.entries(data.rooms.by_type || {});
  const totalTypedRooms = roomTypeEntries.reduce((acc, [, count]) => acc + count, 0) || data.rooms.total || 1;

  const typeColors = ['#576238', '#FFD95E', '#75804b', '#F0EADC', '#46502d', '#a69a6a'];

  const totalFlags = (data.finance.overdue_count || 0) + (data.operations.pending_inquiries || 0);

  return (
    <div className="dashboard-content admin-dashboard-theme">
      {/* Top Header matching Image 3 (Sunny Admin) */}
      <div className="admin-header-row">
        <div>
          <h2 className="admin-title">Admin Dashboard</h2>
          <p className="admin-subtitle">
            Welcome back, {user?.name} — here's real-time platform overview and system metrics today.
          </p>
        </div>

        <div className="admin-header-actions">
          <div className="admin-date-badge">
            <BootstrapIcon name="calendar" className="calendar-icon" />
            <span>{currentDateStr}</span>
          </div>
          <button
            type="button"
            className="button primary"
            onClick={() => onNavigate('accounts')}
          >
            <BootstrapIcon name="person-gear" /> Manage Accounts
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="admin-tabs-bar">
        <button
          type="button"
          className="admin-tab-btn active"
          onClick={() => onNavigate('dashboard')}
        >
          Overview
        </button>
        <button
          type="button"
          className="admin-tab-btn"
          onClick={() => onNavigate('reports')}
        >
          System Analytics
        </button>
        <button
          type="button"
          className="admin-tab-btn"
          onClick={() => onNavigate('activity')}
        >
          Audit Reports
        </button>
      </div>

      {/* 4 Stat Cards with Top Color Bands (Image 3 style) */}
      <div className="admin-stats-grid">
        {/* Card 1: Registered Users */}
        <div className="admin-stat-card border-top-orange">
          <div className="stat-card-header">
            <div className="stat-icon-wrapper bg-orange-subtle">
              <BootstrapIcon name="people" />
            </div>
            <span className="stat-tag tag-neutral">{data.users.tenants} Tenants</span>
          </div>
          <div className="stat-body">
            <h3 className="stat-large-val">{data.users.total.toLocaleString()}</h3>
            <span className="stat-label">Registered Accounts</span>
          </div>
          <div className="stat-card-footer">
            <div className="sparkline-bar-group">
              <span className="sparkline-bar" style={{ height: '40%' }} title="Tenants" />
              <span className="sparkline-bar" style={{ height: '70%' }} title="Landlords" />
              <span className="sparkline-bar" style={{ height: '55%' }} title="Staff" />
              <span className="sparkline-bar" style={{ height: '85%' }} title="Admins" />
              <span className="sparkline-bar" style={{ height: '65%' }} title="Active" />
              <span className="sparkline-bar" style={{ height: '95%' }} title="Total" />
            </div>
            <span className="stat-trend-text muted">
              {data.users.landlords} Landlords · {data.users.staff} Staff
            </span>
          </div>
        </div>

        {/* Card 2: Total Units & Occupancy */}
        <div className="admin-stat-card border-top-blue">
          <div className="stat-card-header">
            <div className="stat-icon-wrapper bg-blue-subtle">
              <BootstrapIcon name="building" />
            </div>
            <span className="stat-tag tag-success">▲ {data.rooms.occupancy_percent}% Occupied</span>
          </div>
          <div className="stat-body">
            <h3 className="stat-large-val">{data.rooms.total}</h3>
            <span className="stat-label">Total Boarding Units</span>
          </div>
          <div className="stat-card-footer">
            <div className="sub-stat-pills">
              <span className="pill-dot green">{data.rooms.available} Available</span>
              <span className="pill-dot purple">{data.rooms.occupied} Occupied</span>
              {data.rooms.reserved > 0 && <span className="pill-dot yellow">{data.rooms.reserved} Hold</span>}
            </div>
          </div>
        </div>

        {/* Card 3: Monthly Revenue & Collections */}
        <div className="admin-stat-card border-top-green">
          <div className="stat-card-header">
            <div className="stat-icon-wrapper bg-green-subtle">
              <BootstrapIcon name="credit-card" />
            </div>
            <span className="stat-tag tag-success">▲ Collections</span>
          </div>
          <div className="stat-body">
            <h3 className="stat-large-val">{formatMoney(data.finance.monthly_collected)}</h3>
            <span className="stat-label">Collected This Month</span>
          </div>
          <div className="stat-card-footer">
            <span className="stat-trend-text muted">
              Billed: <strong>{formatMoney(data.finance.monthly_billed)}</strong> ({data.operations.active_leases} active leases)
            </span>
          </div>
        </div>

        {/* Card 4: Moderation Flags & Alerts */}
        <div className="admin-stat-card border-top-red">
          <div className="stat-card-header">
            <div className="stat-icon-wrapper bg-red-subtle">
              <BootstrapIcon name="warning" />
            </div>
            <span className={`stat-tag ${totalFlags > 0 ? 'tag-warning' : 'tag-neutral'}`}>
              {totalFlags > 0 ? '▼ Needs Review' : '✓ All Clear'}
            </span>
          </div>
          <div className="stat-body">
            <h3 className="stat-large-val">{totalFlags}</h3>
            <span className="stat-label">System Attention Flags</span>
          </div>
          <div className="stat-card-footer">
            <span className="stat-trend-text danger-text">
              {data.finance.overdue_count} overdue invoice(s) · {data.operations.pending_inquiries} pending request(s)
            </span>
          </div>
        </div>
      </div>

      {/* Middle Row: Visual Charts (Image 3 - Sunny Admin style) */}
      <div className="admin-charts-grid">
        {/* Left Chart: Weekly Platform Activity */}
        <div className="admin-panel chart-panel">
          <div className="panel-header-flex">
            <div>
              <h4 className="panel-title">Weekly Operational Activity</h4>
              <p className="panel-subtitle">Daily inquiries submitted and payments verified</p>
            </div>
            <div className="chart-legend-box">
              <span className="legend-item"><span className="legend-color inquiries-bar" /> Inquiries</span>
              <span className="legend-item"><span className="legend-color payments-bar" /> Payments</span>
            </div>
          </div>

          <div className="bar-chart-container">
            {data.weekly_activity.map((item) => {
              const inqHeight = Math.max(12, Math.round((item.inquiries / maxBarValue) * 100));
              const payHeight = Math.max(12, Math.round((item.payments / maxBarValue) * 100));

              return (
                <div key={item.date} className="bar-column">
                  <div className="bars-pair">
                    <div
                      className="bar-fill inq-fill"
                      style={{ height: `${inqHeight}%` }}
                      title={`${item.inquiries} inquiries on ${item.day}`}
                    >
                      {item.inquiries > 0 && <span className="bar-tooltip-val">{item.inquiries}</span>}
                    </div>
                    <div
                      className="bar-fill pay-fill"
                      style={{ height: `${payHeight}%` }}
                      title={`${item.payments} payments on ${item.day}`}
                    >
                      {item.payments > 0 && <span className="bar-tooltip-val">{item.payments}</span>}
                    </div>
                  </div>
                  <span className="bar-day-label">{item.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Chart: Content & Room Distribution */}
        <div className="admin-panel chart-panel">
          <div className="panel-header-flex">
            <div>
              <h4 className="panel-title">Units by Room Category</h4>
              <p className="panel-subtitle">Inventory breakdown by accommodation type</p>
            </div>
          </div>

          <div className="donut-and-legend-layout">
            <div className="category-progress-stack">
              {roomTypeEntries.length > 0 ? (
                roomTypeEntries.map(([type, count], idx) => {
                  const pct = Math.round((count / totalTypedRooms) * 100);
                  const color = typeColors[idx % typeColors.length];
                  return (
                    <div key={type} className="category-stack-row">
                      <div className="category-meta">
                        <span className="category-name-badge">
                          <span className="category-swatch" style={{ background: color }} />
                          <strong>{type || 'Standard Room'}</strong>
                        </span>
                        <span className="category-counts">
                          {count} units ({pct}%)
                        </span>
                      </div>
                      <div className="category-bar-bg">
                        <div
                          className="category-bar-fill"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="muted" style={{ padding: '24px 0' }}>No room categories registered yet.</p>
              )}
            </div>

            <div className="pricing-summary-box">
              <div className="price-item">
                <span className="price-label">Average Rate</span>
                <strong>{formatMoney(data.rooms.avg_price)}/mo</strong>
              </div>
              <div className="price-item">
                <span className="price-label">Lowest Unit</span>
                <strong>{formatMoney(data.rooms.min_price)}/mo</strong>
              </div>
              <div className="price-item">
                <span className="price-label">Premium Unit</span>
                <strong>{formatMoney(data.rooms.max_price)}/mo</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Section: System Moderation & Activity Stream */}
      <div className="admin-two-col-grid">
        {/* Left Column: Recent Audit Trail / System Activity */}
        <div className="admin-panel">
          <div className="panel-header-flex">
            <div>
              <h4 className="panel-title">System Activity & Audit Log</h4>
              <p className="panel-subtitle">Real-time actions across the BoardEase platform</p>
            </div>
            <button
              type="button"
              className="action-link-btn"
              onClick={() => onNavigate('activity')}
            >
              View Full Log →
            </button>
          </div>

          <div className="activity-stream-list">
            {data.recent_activities && data.recent_activities.length > 0 ? (
              data.recent_activities.map((log) => (
                <div key={log.id} className="stream-item">
                  <div className="stream-icon-badge">
                    <BootstrapIcon name={log.action.includes('user') ? 'person' : log.action.includes('room') ? 'building' : log.action.includes('invoice') || log.action.includes('payment') ? 'credit-card' : 'activity'} />
                  </div>
                  <div className="stream-content">
                    <div className="stream-heading">
                      <strong>{log.action}</strong>
                      <span className="stream-user">by {log.user?.name || 'System Admin'}</span>
                    </div>
                    <span className="stream-time">
                      {log.created_at ? formatBusinessDateTime(log.created_at) : 'Recent'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>
                No recent activity records found.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Moderation & Operational Notices */}
        <div className="admin-panel">
          <div className="panel-header-flex">
            <div>
              <h4 className="panel-title">System Health & Notices</h4>
              <p className="panel-subtitle">Immediate actions and platform operational health</p>
            </div>
          </div>

          <div className="notices-card-list">
            {/* Overdue alert */}
            {data.finance.overdue_count > 0 ? (
              <div className="notice-banner alert-critical">
                <div className="notice-icon"><BootstrapIcon name="warning" /></div>
                <div className="notice-body">
                  <strong>{data.finance.overdue_count} Overdue Invoices Requiring Review</strong>
                  <p>
                    Total overdue balance is <strong>{formatMoney(data.finance.overdue_amount)}</strong>. Reminders or lease audits recommended.
                  </p>
                  <button
                    type="button"
                    className="button danger sm"
                    onClick={() => onNavigate('reports')}
                  >
                    View Payment Report →
                  </button>
                </div>
              </div>
            ) : (
              <div className="notice-banner alert-info">
                <div className="notice-icon"><BootstrapIcon name="check" /></div>
                <div className="notice-body">
                  <strong>Billing Accounts in Good Standing</strong>
                  <p>All tenant invoices are current or settled for this billing period.</p>
                </div>
              </div>
            )}

            {/* Pending Inquiries alert */}
            {data.operations.pending_inquiries > 0 ? (
              <div className="notice-banner alert-warning">
                <div className="notice-icon"><BootstrapIcon name="envelope" /></div>
                <div className="notice-body">
                  <strong>{data.operations.pending_inquiries} Pending Tenant Inquiries</strong>
                  <p>Tenants waiting for landlord room approval and 24-hour booking reservation offers.</p>
                  <button
                    type="button"
                    className="button secondary sm"
                    onClick={() => onNavigate('reports')}
                  >
                    View Platform Reports →
                  </button>
                </div>
              </div>
            ) : null}

            {/* System Status Banner */}
            <div className="notice-banner alert-system">
              <div className="notice-icon"><BootstrapIcon name="shield" /></div>
              <div className="notice-body">
                <strong>Platform Security & Sanctum Active</strong>
                <p>Role-based isolation is active for administrators, landlords, and tenants. Existing legacy accounts remain preserved.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent User Accounts Table (Image 3 - Sunny Admin style) */}
      <div className="admin-panel">
        <div className="panel-header-flex">
          <div>
            <h4 className="panel-title">Platform User Accounts</h4>
            <p className="panel-subtitle">Recently registered or active users across all roles</p>
          </div>
          <button
            type="button"
            className="action-link-btn"
            onClick={() => onNavigate('accounts')}
          >
            Manage All Users →
          </button>
        </div>

        <div className="table-scroll">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>USER</th>
                <th>ROLE</th>
                <th>CONTACT</th>
                <th>JOINED</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_users && data.recent_users.length > 0 ? (
                data.recent_users.map((u: User) => {
                  const initials = u.name
                    ? u.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                    : u.email.substring(0, 2).toUpperCase();

                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="user-table-cell">
                          <div className={`user-table-avatar avatar-role-${u.role}`}>
                            {initials}
                          </div>
                          <div>
                            <strong>{u.name}</strong>
                            <span className="cell-sub">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`role-chip role-${u.role}`}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className="contact-text">{u.phone || '—'}</span>
                      </td>
                      <td>
                        {u.created_at ? formatBusinessDate(u.created_at) : '—'}
                      </td>
                      <td>
                        <span className={`status-dot-badge ${u.is_active ? 'active' : 'suspended'}`}>
                          <span className="status-dot" />
                          {u.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="button secondary sm"
                          onClick={() => onNavigate('accounts')}
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px' }}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
