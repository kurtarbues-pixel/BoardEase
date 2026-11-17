import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { formatMoney } from '../../api/client';
import { LandlordDashboardData, Room, Inquiry, Lease, Invoice } from '../../types';
import { StatusBadge } from '../../components/Common/StatusBadge';
import { Modal } from '../../components/Common/Modal';
import { BootstrapIcon } from '../../components/Common/BootstrapIcon';
import { formatBusinessDate, getTodayDateString } from '../../utils/date';

interface LandlordDashboardProps {
  data: LandlordDashboardData;
  rooms: Room[];
  inquiries: Inquiry[];
  leases: Lease[];
  invoices: Invoice[];
  onNavigate: (pageId: string) => void;
  onRefresh?: () => void;
  onApproveInquiry: (inquiry: Inquiry) => Promise<void>;
  onRejectInquiry: (inquiry: Inquiry) => Promise<void>;
  onToggleRoomAvailability?: (room: Room) => Promise<void>;
  processingInquiryId: number | null;
}

export const LandlordDashboard: React.FC<LandlordDashboardProps> = ({
  data,
  rooms,
  inquiries,
  leases,
  invoices,
  onNavigate,
  onApproveInquiry,
  onRejectInquiry,
  processingInquiryId,
}) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Room details modal state
  const [detailRoom, setDetailRoom] = useState<Room | null>(null);
  const [detailPhotoIndex, setDetailPhotoIndex] = useState(0);
  const [showRoomGallery, setShowRoomGallery] = useState(false);

  useEffect(() => {
    if (!showRoomGallery || !detailRoom?.images?.length) return;
    const handleGalleryKeys = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setDetailPhotoIndex((index) => (index - 1 + detailRoom.images!.length) % detailRoom.images!.length);
      if (event.key === 'ArrowRight') setDetailPhotoIndex((index) => (index + 1) % detailRoom.images!.length);
      if (event.key === 'Escape') setShowRoomGallery(false);
    };
    window.addEventListener('keydown', handleGalleryKeys);
    return () => window.removeEventListener('keydown', handleGalleryKeys);
  }, [showRoomGallery, detailRoom]);

  const occPercent = Math.min(100, Math.max(0, data.occupancy.percent));

  // Extract unique room types for filtering
  const roomTypes = Array.from(new Set(rooms.map((r) => r.type).filter((t): t is string => Boolean(t))));

  // Filtered rooms for the Rumaya-style list
  const filteredRooms = rooms.filter((room) => {
    const matchesSearch =
      room.room_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (room.location && room.location.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = typeFilter === 'all' || room.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || room.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  // Pending inquiries awaiting decision
  const pendingInquiries = inquiries.filter((inq) => inq.status === 'pending');
  const activeOffers = inquiries.filter((inq) => inq.status === 'approved');

  // Overdue invoices for landlord's tenants
  const overdueInvoices = invoices.filter(
    (inv) =>
      inv.status.toLowerCase() === 'overdue' ||
      (inv.status.toLowerCase() === 'unpaid' && inv.due_date < getTodayDateString())
  );
  const unpaidInvoices = invoices.filter((invoice) => Number(invoice.balance) > 0 && invoice.status.toLowerCase() !== 'paid');
  const unpaidBalance = unpaidInvoices.reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0);

  return (
    <div className="dashboard-content landlord-dashboard-theme">
      {/* Top Header matching Image 2 (Rumaya style) */}
      <div className="landlord-header-row">
        <div>
          <h2 className="landlord-title">Landlord Operational Hub</h2>
          <p className="landlord-subtitle">
            Overview of your boarding house rooms, tenant occupancies, and pending rental requests.
          </p>
        </div>

        <div className="landlord-header-actions">
          <button
            type="button"
            className="button primary btn-add-property"
            onClick={() => onNavigate('rooms')}
          >
            <BootstrapIcon name="door" /> Add New Room
          </button>
        </div>
      </div>

      {/* 4 Stat Cards in Rumaya style */}
      <div className="rumaya-stats-grid">
        {/* Card 1: Total Units */}
        <div className="rumaya-stat-card">
          <div className="rumaya-stat-header">
            <div className="rumaya-icon-wrapper green-icon">
              <BootstrapIcon name="building" />
            </div>
            <div className="rumaya-stat-text">
              <span className="rumaya-stat-label">Total Rooms</span>
              <h3 className="rumaya-stat-val">{data.occupancy.total}</h3>
              <span className="rumaya-sub-label">{data.available_rooms} Units Available</span>
            </div>
          </div>
          <button
            type="button"
            className="rumaya-card-link"
            onClick={() => onNavigate('rooms')}
          >
            Manage Units →
          </button>
        </div>

        {/* Card 2: Total Inquiries */}
        <div className="rumaya-stat-card">
          <div className="rumaya-stat-header">
            <div className="rumaya-icon-wrapper blue-icon">
              <BootstrapIcon name="envelope" />
            </div>
            <div className="rumaya-stat-text">
              <span className="rumaya-stat-label">Total Inquiries</span>
              <h3 className="rumaya-stat-val">{inquiries.length}</h3>
              <span className="rumaya-sub-label">
                {pendingInquiries.length} Pending Review
              </span>
            </div>
          </div>
          <button
            type="button"
            className="rumaya-card-link"
            onClick={() => onNavigate('inquiries')}
          >
            View Inquiries →
          </button>
        </div>

        {/* Card 3: Occupancy Rate */}
        <div className="rumaya-stat-card">
          <div className="rumaya-stat-header">
            <div className="rumaya-icon-wrapper purple-icon">
              <BootstrapIcon name="graph-up" />
            </div>
            <div className="rumaya-stat-text">
              <span className="rumaya-stat-label">Occupancy Rate</span>
              <h3 className="rumaya-stat-val">{occPercent}%</h3>
              <span className="rumaya-sub-label">
                {data.occupancy.occupied} of {data.occupancy.total} Occupied
              </span>
            </div>
          </div>
          <button
            type="button"
            className="rumaya-card-link"
            onClick={() => onNavigate('leases')}
          >
            View Leases →
          </button>
        </div>

        {/* Card 4: Monthly Revenue */}
        <div className="rumaya-stat-card">
          <div className="rumaya-stat-header">
            <div className="rumaya-icon-wrapper orange-icon">
              <BootstrapIcon name="cash" />
            </div>
            <div className="rumaya-stat-text">
              <span className="rumaya-stat-label">Revenue Collected</span>
              <h3 className="rumaya-stat-val">{formatMoney(data.monthly_revenue)}</h3>
              <span className="rumaya-sub-label">This Billing Cycle</span>
            </div>
          </div>
          <button
            type="button"
            className="rumaya-card-link"
            onClick={() => onNavigate('billing')}
          >
            Billing Statements →
          </button>
        </div>
      </div>

      <button type="button" className="landlord-collections-summary" onClick={() => onNavigate('billing')}>
        <span className="landlord-collections-icon" aria-hidden="true">₱</span>
        <span className="landlord-collections-copy"><strong>Invoice collections</strong><small>{unpaidInvoices.length} unpaid invoice{unpaidInvoices.length === 1 ? '' : 's'} across your tenants</small></span>
        <strong className="landlord-collections-total">{formatMoney(unpaidBalance)}</strong>
        <span className="landlord-collections-link">Review billing&nbsp; →</span>
      </button>

      {/* Main Two-Column Layout (2/3 Main Column + 1/3 Right Column) matching Image 2 */}
      <div className="rumaya-layout-grid">
        {/* Left Column (2/3): My Boarding House Rooms & Units */}
        <div className="rumaya-main-col">
          <div className="rumaya-panel">
            <div className="rumaya-panel-header">
              <div>
                <h3 className="rumaya-panel-title">My Boarding House Units</h3>
                <p className="rumaya-panel-subtitle">
                  Manage, track vacancies, and monitor occupancy status for your properties.
                </p>
              </div>
              <span className="unit-count-pill">{filteredRooms.length} units listed</span>
            </div>

            {/* Search and Filters Bar */}
            <div className="rumaya-filters-bar">
              <div className="search-input-wrapper">
                <BootstrapIcon name="search" className="search-icon" />
                <input
                  type="text"
                  placeholder="Search room number, title, or address…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="rumaya-search-input"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rumaya-select"
              >
                <option value="all">All Room Types</option>
                {roomTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rumaya-select"
              >
                <option value="all">All Statuses</option>
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="reserved">Reserved (24h Hold)</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>

            {/* List of Rooms (Image 2 style) */}
            <div className="rumaya-rooms-list">
              {filteredRooms.length > 0 ? (
                filteredRooms.map((room) => {
                  const activeLease = leases.find((l) => l.room_id === room.id && l.status === 'active');
                  const roomInquiries = inquiries.filter((inq) => inq.room_id === room.id && inq.status === 'pending');
                  const imageUrl = room.images && room.images.length > 0
                    ? room.images[0].url
                    : 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=360&q=80';

                  return (
                    <div key={room.id} className="rumaya-room-row">
                      <div className="room-img-container">
                        <img src={imageUrl} alt={room.title} className="room-thumb-img" />
                      </div>

                      <div className="room-main-info">
                        <div className="room-badge-row">
                          <span className="room-type-tag">{room.type || 'Standard'}</span>
                          <StatusBadge status={room.status} />
                        </div>
                        <h4 className="room-title-heading">
                          Room {room.room_number} — {room.title}
                        </h4>
                        <p className="room-loc-text">
                          <BootstrapIcon name="geo" /> {room.location || 'Main Boarding House'}
                        </p>
                        <div className="room-amenities-pills">
                          {room.amenities && room.amenities.slice(0, 3).map((a, i) => (
                            <span key={i} className="amenity-chip">{a}</span>
                          ))}
                        </div>
                      </div>

                      <div className="room-metrics-col">
                        <div className="metric-box">
                          <span className="metric-label">Rate</span>
                          <strong className="metric-val">{formatMoney(room.price)}/mo</strong>
                        </div>
                        <div className="metric-box">
                          <span className="metric-label">Tenant</span>
                          <span className="metric-sub">
                            {activeLease ? activeLease.tenant?.name || 'Occupied' : 'Vacant'}
                          </span>
                        </div>
                        <div className="metric-box">
                          <span className="metric-label">Pending</span>
                          <span className="metric-sub">
                            {roomInquiries.length > 0 ? `${roomInquiries.length} Inquiries` : '0 requests'}
                          </span>
                        </div>
                      </div>

                      <div className="room-actions-col">
                        <button
                          type="button"
                          className="button secondary sm"
                          onClick={() => onNavigate('rooms')}
                        >
                          Manage Unit
                        </button>
                        <button
                          type="button"
                          className="button ghost sm"
                          onClick={() => {
                            setDetailPhotoIndex(0);
                            setDetailRoom(room);
                          }}
                          title="View Room Details"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty-rooms-box">
                  <p>No rooms match your search or filter criteria.</p>
                  <button
                    type="button"
                    className="button secondary sm"
                    onClick={() => { setSearchTerm(''); setTypeFilter('all'); setStatusFilter('all'); }}
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (1/3): Quick Actions, Pending Inquiries & Performance Tips */}
        <div className="rumaya-side-col">
          {/* Pending Inquiries Desk (First-qualified, first-approved, 24h offer) */}
          <div className="rumaya-panel side-panel">
            <div className="rumaya-panel-header">
              <div>
                <h4 className="rumaya-side-title">Pending Room Requests</h4>
                <p className="rumaya-side-subtitle">Applications waiting for review</p>
              </div>
              <span className="pending-badge-count">{pendingInquiries.length}</span>
            </div>

            <div className="pending-inquiries-list">
              {pendingInquiries.length > 0 ? (
                pendingInquiries.slice(0, 4).map((inq) => (
                  <div key={inq.id} className="pending-inq-card">
                    <div className="pending-inq-top">
                      <div>
                        <strong>{inq.tenant?.name || 'Applicant'}</strong>
                        <span className="inq-room-tag">Room {inq.room?.room_number}</span>
                      </div>
                      <span className="inq-time">
                        {inq.created_at ? formatBusinessDate(inq.created_at) : 'New'}
                      </span>
                    </div>
                    {inq.message && (
                      <p className="inq-message-text">"{inq.message}"</p>
                    )}
                    <div className="inq-actions-row">
                      <button
                        type="button"
                        className="button primary sm inq-offer-btn"
                        disabled={processingInquiryId === inq.id}
                        onClick={() => onApproveInquiry(inq)}
                        title="Sends 24-hour room offer and places 24h temporary hold"
                      >
                        {processingInquiryId === inq.id ? 'Sending…' : 'Offer Room (24h)'}
                      </button>
                      <button
                        type="button"
                        className="button secondary sm"
                        onClick={() => onRejectInquiry(inq)}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="clean-state-box">
                  <span className="clean-state-icon">✓</span>
                  <p>All inquiries reviewed! No pending requests.</p>
                </div>
              )}
            </div>

            {activeOffers.length > 0 && (
              <div className="active-offers-summary">
                <span className="offers-icon"><BootstrapIcon name="hourglass" /></span>
                <span>{activeOffers.length} offer(s) pending tenant acceptance.</span>
              </div>
            )}
          </div>

          {/* Account & Property Summary (Image 2 style) */}
          <div className="rumaya-panel side-panel">
            <h4 className="rumaya-side-title">Landlord Profile</h4>
            <div className="landlord-info-box">
              <div className="landlord-avatar-circle">
                {user?.name?.charAt(0).toUpperCase() || 'L'}
              </div>
              <div className="landlord-meta">
                <strong>{user?.name}</strong>
                <span className="muted">{user?.email}</span>
                <span className="verified-badge"><BootstrapIcon name="check" /> Verified Landlord</span>
              </div>
            </div>

            <div className="landlord-summary-specs">
              <div className="spec-row">
                <span>Managed Units:</span>
                <strong>{rooms.length} Rooms</strong>
              </div>
              <div className="spec-row">
                <span>Active Leases:</span>
                <strong>{leases.filter((l) => l.status === 'active').length} Tenants</strong>
              </div>
              <div className="spec-row">
                <span>Active Revenue:</span>
                <strong>{formatMoney(data.monthly_revenue)}/mo</strong>
              </div>
            </div>

            <button
              type="button"
              className="button secondary full-width"
              onClick={() => onNavigate('billing')}
            >
              Generate Monthly Invoices
            </button>
          </div>

          {/* Tips Meningkatkan Performa / Operational Alerts (Image 2 style) */}
          <div className="rumaya-panel side-panel">
            <h4 className="rumaya-side-title">Operational Tips & Alerts</h4>

            {overdueInvoices.length > 0 ? (
              <div className="tip-item tip-warning">
                <div className="tip-icon"><BootstrapIcon name="warning" /></div>
                <div className="tip-text">
                  <strong>{overdueInvoices.length} Overdue Invoices</strong>
                  <p>Ensure to review balances and send reminders via the billing hub.</p>
                </div>
              </div>
            ) : (
              <div className="tip-item">
                <div className="tip-icon"><BootstrapIcon name="lightbulb" /></div>
                <div className="tip-text">
                  <strong>First-Qualified, First-Approved</strong>
                  <p>Review inquiries promptly to hold the room and give qualified tenants 24 hours to confirm.</p>
                </div>
              </div>
            )}

            <div className="tip-item">
              <div className="tip-icon"><BootstrapIcon name="image" /></div>
              <div className="tip-text">
                <strong>High Quality Photos</strong>
                <p>Units with photos and detailed amenities receive up to 3x more inquiry conversions.</p>
              </div>
            </div>

            <div className="tip-item">
              <div className="tip-icon"><BootstrapIcon name="lightning" /></div>
              <div className="tip-text">
                <strong>Separate Utility Charges</strong>
                <p>Record additional charges (water, electric, internet) separately from regular rent.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Room Details Modal */}
      <Modal
        isOpen={Boolean(detailRoom)}
        onClose={() => setDetailRoom(null)}
        title={detailRoom?.title || 'Room Details'}
        maxWidth="1040px"
      >
        {detailRoom && (() => {
          const photos = detailRoom.images || [];
          const selectedPhoto = photos[detailPhotoIndex] || photos[0];
          const movePhoto = (direction: number) =>
            setDetailPhotoIndex((index) => (index + direction + photos.length) % photos.length);
          const activeLease = leases.find((l) => l.room_id === detailRoom.id && l.status === 'active');
          const roomInquiries = inquiries.filter((inq) => inq.room_id === detailRoom.id);

          return (
            <div className="room-detail">
              <div className="room-detail-gallery">
                {selectedPhoto ? (
                  <div className="room-gallery-stage">
                    <img
                      src={selectedPhoto.url}
                      alt={`${detailRoom.title} photo ${detailPhotoIndex + 1}`}
                    />
                    {photos.length > 1 && (
                      <>
                        <button
                          type="button"
                          className="room-gallery-arrow previous"
                          onClick={() => movePhoto(-1)}
                          aria-label="Previous room photo"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          className="room-gallery-arrow next"
                          onClick={() => movePhoto(1)}
                          aria-label="Next room photo"
                        >
                          ›
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="room-gallery-count"
                      onClick={() => setShowRoomGallery(true)}
                    >
                      ▧ View gallery ({photos.length})
                    </button>
                  </div>
                ) : (
                  <div className="room-image-placeholder">No room photos uploaded</div>
                )}
              </div>

              <div className="room-detail-copy">
                <StatusBadge status={detailRoom.status} />
                <h3>Room {detailRoom.room_number} · {detailRoom.location}</h3>
                <strong className="room-price">
                  {formatMoney(detailRoom.price)} <small>per month</small>
                </strong>

                {detailRoom.type && (
                  <span className="room-type-tag" style={{ display: 'inline-block', marginBottom: '8px' }}>
                    Type: {detailRoom.type}
                  </span>
                )}

                {detailRoom.description && <p>{detailRoom.description}</p>}

                {detailRoom.amenities && detailRoom.amenities.length > 0 && (
                  <div>
                    <h5 style={{ margin: '8px 0 4px', fontSize: '0.85rem', color: 'var(--muted)' }}>Amenities</h5>
                    <div className="amenities-tags">
                      {detailRoom.amenities.map((item) => (
                        <span className="amenity-tag" key={item}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lease & Tenant Summary */}
                <div className="room-detail-landlord" style={{ marginTop: '16px' }}>
                  <strong>Occupancy & Tenant Information</strong>
                  {activeLease ? (
                    <>
                      <span>Active Tenant: <strong>{activeLease.tenant?.name || 'Assigned'}</strong></span>
                      {activeLease.tenant?.email && <span>Email: {activeLease.tenant.email}</span>}
                      {activeLease.tenant?.phone && <span>Phone: {activeLease.tenant.phone}</span>}
                      <span>Lease Period: {activeLease.start_date} {activeLease.end_date ? `to ${activeLease.end_date}` : '(Ongoing)'}</span>
                      <span>Agreed Rent: {formatMoney(activeLease.monthly_rent)}/mo</span>
                    </>
                  ) : (
                    <span className="muted">Currently vacant. No active tenant lease.</span>
                  )}
                  {roomInquiries.length > 0 && (
                    <span style={{ marginTop: '6px', fontSize: '0.85rem' }}>
                      Pending/Active Inquiries: {roomInquiries.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Lightbox */}
              {showRoomGallery && (
                <div
                  className="room-gallery-lightbox"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Room photo gallery"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setShowRoomGallery(false);
                  }}
                >
                  <button
                    type="button"
                    className="room-gallery-lightbox-close"
                    onClick={() => setShowRoomGallery(false)}
                    aria-label="Close gallery"
                  >
                    ×
                  </button>
                  {photos.length > 1 && (
                    <button
                      type="button"
                      className="room-gallery-arrow previous"
                      onClick={() => movePhoto(-1)}
                      aria-label="Previous room photo"
                    >
                      ‹
                    </button>
                  )}
                  {selectedPhoto && (
                    <img
                      src={selectedPhoto.url}
                      alt={`${detailRoom.title} photo ${detailPhotoIndex + 1}`}
                    />
                  )}
                  {photos.length > 1 && (
                    <button
                      type="button"
                      className="room-gallery-arrow next"
                      onClick={() => movePhoto(1)}
                      aria-label="Next room photo"
                    >
                      ›
                    </button>
                  )}
                  <span className="room-gallery-lightbox-count">
                    {detailPhotoIndex + 1} / {photos.length}
                  </span>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};
