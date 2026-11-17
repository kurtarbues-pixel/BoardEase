import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { formatMoney, api } from '../../api/client';
import { Room, Lease, Invoice, Inquiry } from '../../types';
import { StatusBadge } from '../../components/Common/StatusBadge';
import { formatBusinessDate, formatBusinessDateTime } from '../../utils/date';
import { Modal } from '../../components/Common/Modal';
import { Field } from '../../components/Common/Field';
import { BootstrapIcon } from '../../components/Common/BootstrapIcon';

interface TenantDashboardProps {
  rooms: Room[];
  leases: Lease[];
  invoices: Invoice[];
  inquiries: Inquiry[];
  onNavigate: (pageId: string) => void;
  onContactLandlord: (leaseId: number) => void;
  onRefresh: () => void;
  announce?: (message: string, kind?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const TenantDashboard: React.FC<TenantDashboardProps> = ({
  rooms,
  leases,
  invoices,
  inquiries,
  onNavigate,
  onContactLandlord,
  onRefresh,
  announce,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'resident' | 'favorites'>(() => leases.some((lease) => lease.status === 'active') ? 'resident' : 'overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [priceSort, setPriceSort] = useState<'asc' | 'desc' | 'default'>('default');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [favorites, setFavorites] = useState<Room[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [activeLeasePhotoIndex, setActiveLeasePhotoIndex] = useState(0);
  const [showLeaseGallery, setShowLeaseGallery] = useState(false);

  // Inquiry modal state
  const [selectedRoomForInquiry, setSelectedRoomForInquiry] = useState<Room | null>(null);
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [submittingInquiry, setSubmittingInquiry] = useState(false);
  const [inquiryError, setInquiryError] = useState('');

  // 24-hour offer processing
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Active Lease if already renting
  const activeLease = leases.find((l) => l.status === 'active');
  const hasActiveLease = Boolean(activeLease);
  useEffect(() => { setActiveTab(activeLease ? 'resident' : 'overview'); }, [activeLease?.id]);

  useEffect(() => {
    const photos = activeLease?.room?.images || [];
    if (!showLeaseGallery || photos.length < 2) return;
    const handleGalleryKeys = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setActiveLeasePhotoIndex((index) => (index - 1 + photos.length) % photos.length);
      if (event.key === 'ArrowRight') setActiveLeasePhotoIndex((index) => (index + 1) % photos.length);
      if (event.key === 'Escape') setShowLeaseGallery(false);
    };
    window.addEventListener('keydown', handleGalleryKeys);
    return () => window.removeEventListener('keydown', handleGalleryKeys);
  }, [activeLease, showLeaseGallery]);

  // Check if tenant has an approved 24-hour room offer
  const activeOffer = inquiries.find(
    (inq) => inq.status === 'approved' && inq.offer_expires_at && new Date(inq.offer_expires_at) > new Date()
  );

  // Filter available rooms for PropertyPro browsing
  const availableRooms = rooms.filter((r) => r.status === 'available');

  const loadFavorites = async () => {
    setFavoritesLoading(true);
    try {
      const response = await api<{ data: Room[] }>('/favorites');
      setFavorites(response.data || []);
    } catch (err: any) {
      announce?.(err.message || 'Could not load favorites.', 'error');
    } finally {
      setFavoritesLoading(false);
    }
  };

  useEffect(() => { void loadFavorites(); }, []);

  const toggleFavorite = async (room: Room) => {
    const saved = favorites.some((favorite) => favorite.id === room.id);
    try {
      await api(`/rooms/${room.id}/favorite`, { method: saved ? 'DELETE' : 'POST' });
      setFavorites((current) => saved ? current.filter((favorite) => favorite.id !== room.id) : [...current, room]);
      announce?.(saved ? 'Room removed from favorites.' : 'Room saved to favorites.');
    } catch (err: any) {
      announce?.(err.message || 'Could not update favorites.', 'error');
    }
  };

  const favoriteFilteredRooms = favorites.filter((room) => {
    const term = searchTerm.toLowerCase();
    const matchesText = room.title.toLowerCase().includes(term) || room.room_number.toLowerCase().includes(term) || room.location.toLowerCase().includes(term);
    return matchesText && (selectedType === 'all' || room.type === selectedType);
  }).sort((a, b) => priceSort === 'asc' ? Number(a.price) - Number(b.price) : priceSort === 'desc' ? Number(b.price) - Number(a.price) : 0);

  // Calculate pricing metrics for Rumaya stat cards
  const prices = availableRooms.map((r) => Number(r.price)).filter((p) => !isNaN(p) && p > 0);
  const avgRent = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const minRent = prices.length > 0 ? Math.min(...prices) : 0;

  // Most common room type
  const typeCounts: Record<string, number> = {};
  availableRooms.forEach((r) => {
    if (r.type) typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
  });
  const mostCommonType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Room';

  // Invoices & Balance calculations
  const unpaidInvoices = invoices.filter((inv) => inv.status.toLowerCase() !== 'paid');
  const totalBalance = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.balance || 0), 0);
  const nextInvoice = unpaidInvoices[0];

  // Room types for filter dropdown
  const uniqueTypes = Array.from(new Set(availableRooms.map((room) => room.type).filter((type): type is string => Boolean(type))));

  // Handle Accept 24-Hour Offer
  const handleAcceptOffer = async (inquiry: Inquiry) => {
    if (!window.confirm(`Accept room offer for Room ${inquiry.room?.room_number}? This will confirm your lease and place you as tenant.`)) {
      return;
    }
    setActionLoadingId(inquiry.id);
    try {
      await api(`/inquiries/${inquiry.id}/accept`, { method: 'POST' });
      announce?.('Room offer accepted. Please review and accept your digital lease agreement in My Lease.', 'success');
      onRefresh();
    } catch (err: any) {
      announce?.(err.message || 'Could not accept room offer.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Decline Offer
  const handleDeclineOffer = async (inquiry: Inquiry) => {
    if (!window.confirm(`Are you sure you want to decline this offer for Room ${inquiry.room?.room_number}? The room hold will be released.`)) {
      return;
    }
    setActionLoadingId(inquiry.id);
    try {
      await api(`/inquiries/${inquiry.id}/decline`, { method: 'POST' });
      announce?.('Offer declined. The room has been released for the next applicant.', 'info');
      onRefresh();
    } catch (err: any) {
      announce?.(err.message || 'Could not decline offer.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Submitting Inquiry for a room
  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomForInquiry) return;

    setSubmittingInquiry(true);
    setInquiryError('');
    try {
      await api(`/rooms/${selectedRoomForInquiry.id}/inquiries`, {
        method: 'POST',
        body: { message: inquiryMessage },
      });
      announce?.(`Inquiry for Room ${selectedRoomForInquiry.room_number} submitted successfully!`, 'success');
      setSelectedRoomForInquiry(null);
      setInquiryMessage('');
      onRefresh();
    } catch (err: any) {
      setInquiryError(err.message || 'Failed to submit inquiry.');
    } finally {
      setSubmittingInquiry(false);
    }
  };

  return (
    <div className="dashboard-content tenant-dashboard-theme">
      {/* 24-Hour Room Offer Hero Banner (Requirement 3 Safeguard) */}
      {activeOffer && (
        <div className="offer-alert-banner">
          <div className="offer-alert-icon"><BootstrapIcon name="stars" /></div>
          <div className="offer-alert-content">
            <div className="offer-alert-header">
              <h3>24-Hour Room Offer Received!</h3>
              <span className="offer-time-pill">
                Hold expires: {activeOffer.offer_expires_at ? formatBusinessDateTime(activeOffer.offer_expires_at) : 'in 24 hours'}
              </span>
            </div>
            <p className="offer-desc">
              The landlord has approved your request for <strong>Room {activeOffer.room?.room_number}</strong> ({activeOffer.room?.title}) at <strong>{formatMoney(activeOffer.room?.price)}/month</strong>.
              The room is temporarily held exclusively for you. Please accept or decline before the hold expires.
            </p>
            <div className="offer-actions-row">
              <button
                type="button"
                className="button primary"
                disabled={actionLoadingId === activeOffer.id}
                onClick={() => handleAcceptOffer(activeOffer)}
              >
                {actionLoadingId === activeOffer.id ? 'Confirming…' : <><BootstrapIcon name="check" /> Accept & Confirm Tenancy</>}
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={actionLoadingId === activeOffer.id}
                onClick={() => handleDeclineOffer(activeOffer)}
              >
                Decline Offer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Header */}
      <div className="landlord-header-row">
        <div>
          <h2 className="landlord-title">Tenant Dashboard</h2>
          <p className="landlord-subtitle">
            {hasActiveLease
              ? `Welcome back, ${user?.name}! Manage your room tenancy, monthly bills, or browse rooms.`
              : `Welcome, ${user?.name}! Browse boarding house rooms and track your rental applications.`}
          </p>
        </div>

        <div className="landlord-header-actions">
          {hasActiveLease && (
            <button
              type="button"
              className={`button ${activeTab === 'resident' ? 'primary' : 'secondary'}`}
              onClick={() => setActiveTab('resident')}
            >
              <BootstrapIcon name="house" /> My Tenancy Hub
            </button>
          )}
          <button
            type="button"
            className={`button ${activeTab === 'favorites' ? 'primary' : 'secondary'}`}
            onClick={() => { setActiveTab('favorites'); void loadFavorites(); }}
          >
            <BootstrapIcon name="heart" /> Favorites ({favorites.length})
          </button>
        </div>
      </div>

      {/* =========================================================================
          VIEW A: Resident Tenant Hub (When Tenant has an Active Lease)
          ========================================================================= */}
      {hasActiveLease && activeTab === 'resident' && activeLease && (
        <div className="resident-hub-container">
          {/* Top 4 Financial / Tenancy Stat Cards */}
          <div className="propertypro-stats-grid">
            <div className="propertypro-stat-card">
              <div className="pp-stat-header">
                <span className="pp-stat-label">Assigned Unit</span>
                <BootstrapIcon name="house" className="pp-stat-icon" />
              </div>
              <h3 className="pp-stat-val">Room {activeLease.room?.room_number}</h3>
              <span className="pp-stat-sub">{activeLease.room?.type || 'Standard Room'}</span>
            </div>

            <div className="propertypro-stat-card">
              <div className="pp-stat-header">
                <span className="pp-stat-label">Monthly Rent</span>
                <BootstrapIcon name="cash" className="pp-stat-icon" />
              </div>
              <h3 className="pp-stat-val">{formatMoney(activeLease.monthly_rent)}</h3>
              <span className="pp-stat-sub">Fixed Monthly Rate</span>
            </div>

            <div className="propertypro-stat-card">
              <div className="pp-stat-header">
                <span className="pp-stat-label">Total Balance Due</span>
                <BootstrapIcon name="credit-card" className="pp-stat-icon" />
              </div>
              <h3 className={`pp-stat-val ${totalBalance > 0 ? 'text-danger' : 'text-success'}`}>
                {formatMoney(totalBalance)}
              </h3>
              <span className="pp-stat-sub">
                {totalBalance > 0 ? `${unpaidInvoices.length} unpaid bill(s)` : 'All paid up!'}
              </span>
              {totalBalance > 0 && <button type="button" className="button primary tenant-dashboard-pay" onClick={() => onNavigate('billing')}>Pay now</button>}
            </div>

            <div className="propertypro-stat-card">
              <div className="pp-stat-header">
                <span className="pp-stat-label">Next Rent Due</span>
                <BootstrapIcon name="calendar" className="pp-stat-icon" />
              </div>
              <h3 className="pp-stat-val">
                {nextInvoice ? nextInvoice.due_date : 'No pending dues'}
              </h3>
              <span className="pp-stat-sub">
                {nextInvoice ? `Period: ${nextInvoice.billing_period}` : 'Current for this period'}
              </span>
            </div>
          </div>

          {/* Hero Unit Card: My Leased Room (Image 1 style) */}
          <div className="resident-hero-card">
            <div className="hero-img-box">
              {(() => {
                const photos = activeLease.room?.images || [];
                const photoIndex = photos.length ? activeLeasePhotoIndex % photos.length : 0;
                const photoUrl = photos[photoIndex]?.url || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=700&q=80';
                return <>
                  <img src={photoUrl} alt={`${activeLease.room?.title || 'Room'} photo ${photoIndex + 1}`} className="hero-room-img" />
                  {photos.length > 1 && <>
                    <button type="button" className="room-gallery-arrow previous" onClick={() => setActiveLeasePhotoIndex((index) => (index - 1 + photos.length) % photos.length)} aria-label="Previous room photo">‹</button>
                    <button type="button" className="room-gallery-arrow next" onClick={() => setActiveLeasePhotoIndex((index) => (index + 1) % photos.length)} aria-label="Next room photo">›</button>
                    <button type="button" className="room-gallery-count" onClick={() => setShowLeaseGallery(true)}>▧ View gallery ({photos.length})</button>
                  </>}
                  {showLeaseGallery && <div className="room-gallery-lightbox" role="dialog" aria-modal="true" aria-label="Room photo gallery" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowLeaseGallery(false); }}>
                    <button type="button" className="room-gallery-lightbox-close" onClick={() => setShowLeaseGallery(false)} aria-label="Close gallery">×</button>
                    <button type="button" className="room-gallery-arrow previous" onClick={() => setActiveLeasePhotoIndex((index) => (index - 1 + photos.length) % photos.length)} aria-label="Previous room photo">‹</button>
                    <img src={photoUrl} alt={`${activeLease.room?.title || 'Room'} photo ${photoIndex + 1}`} />
                    <button type="button" className="room-gallery-arrow next" onClick={() => setActiveLeasePhotoIndex((index) => (index + 1) % photos.length)} aria-label="Next room photo">›</button>
                    <span className="room-gallery-lightbox-count">{photoIndex + 1} / {photos.length}</span>
                  </div>}
                </>;
              })()}
              <span className="hero-status-pill occupied">My Current Room</span>
            </div>
            <div className="hero-room-details">
              <div className="hero-badge-row">
                <span className="room-type-tag">{activeLease.room?.type || 'Standard Room'}</span>
                <span className="lease-date-badge">
                  Lease: {activeLease.start_date} {activeLease.end_date ? `to ${activeLease.end_date}` : '(Ongoing)'}
                </span>
              </div>

              <h3 className="hero-room-title">
                Room {activeLease.room?.room_number} — {activeLease.room?.title}
              </h3>

              <p className="hero-location-text">
                <BootstrapIcon name="geo" /> {activeLease.room?.location || 'Main Boarding House Campus'}
              </p>

              <p className="hero-desc-text">
                {activeLease.room?.description || 'Comfortable and private room with study table, secure lock, and reliable utilities.'}
              </p>

              <div className="hero-amenities-group">
                <span className="amenities-title">Included Amenities:</span>
                <div className="amenities-chips-wrap">
                  {activeLease.room?.amenities && activeLease.room.amenities.length > 0 ? (
                    activeLease.room.amenities.map((am, i) => (
                      <span key={i} className="amenity-chip">{am}</span>
                    ))
                  ) : (
                    <span className="muted">Standard utilities included</span>
                  )}
                </div>
              </div>

              {/* Landlord Contact Info */}
              <div className="landlord-contact-ribbon">
                <div className="landlord-avatar-sm">
                  {(activeLease.landlord?.name || activeLease.room?.landlord?.name)?.charAt(0) || 'L'}
                </div>
                <div>
                  <strong>Landlord: {activeLease.landlord?.name || activeLease.room?.landlord?.name || 'Property Manager'}</strong>
                  <span className="landlord-sub">
                    {activeLease.landlord?.email || activeLease.room?.landlord?.email || 'Contact manager via office'}
                    {(activeLease.landlord?.phone || activeLease.room?.landlord?.phone) && ` · Tel: ${activeLease.landlord?.phone || activeLease.room?.landlord?.phone}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Two-Column Resident Data: Billing Statements & House Rules */}
          <div className="resident-two-cols">
            {/* Column 1: Billing & Invoices */}
            <div className="resident-panel">
              <div className="panel-header-flex">
                <div>
                  <h4 className="panel-title">My Invoices & Rent Statements</h4>
                  <p className="panel-subtitle">Itemized rent and separate utility charges</p>
                </div>
                <button
                  type="button"
                  className="action-link-btn"
                  onClick={() => onNavigate('billing')}
                >
                  Full Billing Hub →
                </button>
              </div>

              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Billing Period</th>
                      <th>Due Date</th>
                      <th>Amount Due</th>
                      <th>Balance</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.length > 0 ? (
                      invoices.slice(0, 5).map((inv) => (
                        <tr key={inv.id}>
                          <td><strong>{inv.billing_period}</strong></td>
                          <td>{inv.due_date}</td>
                          <td>{formatMoney(inv.total_amount_due)}</td>
                          <td>
                            <strong className={Number(inv.balance) > 0 ? 'text-danger' : 'text-success'}>
                              {formatMoney(inv.balance)}
                            </strong>
                          </td>
                          <td><StatusBadge status={inv.status} /></td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: '24px' }}>
                          No invoices generated yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Column 2: Boarding House Rules & Guidelines */}
            <div className="resident-panel">
              <div className="panel-header-flex">
                <div>
                  <h4 className="panel-title">Boarding House Guidelines</h4>
                  <p className="panel-subtitle">Community rules and resident assistance</p>
                </div>
              </div>

              <div className="rules-list">
                <div className="rule-item">
                  <span className="rule-number">1</span>
                  <div>
                    <strong>Rent Due Date:</strong>
                    <p>Rent is due on the 1st week of each month. Late dues may incur nominal fees.</p>
                  </div>
                </div>

                <div className="rule-item">
                  <span className="rule-number">2</span>
                  <div>
                    <strong>Quiet Hours & Curfew:</strong>
                    <p>Quiet hours observed from 10:00 PM to 6:00 AM daily for conducive studying and rest.</p>
                  </div>
                </div>

                <div className="rule-item">
                  <span className="rule-number">3</span>
                  <div>
                    <strong>Utilities & Common Spaces:</strong>
                    <p>Please conserve electricity and water. Keep kitchen and laundry facilities clean after use.</p>
                  </div>
                </div>

                <div className="rule-item">
                  <span className="rule-number">4</span>
                  <div>
                    <strong>Visitors & Security:</strong>
                    <p>Visitors must sign in at the front lobby and depart by 9:00 PM. Lock unit doors at all times.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          Tenant Dashboard Overview and Favorites
          ========================================================================= */}
      {(!hasActiveLease || activeTab === 'favorites') && (
        <div className="rumaya-dashboard-container">
          {/* Top 4 Stat Cards in Rumaya Style (Image 2) */}
          <div className="rumaya-stats-grid">
            {/* Card 1: Total Properties / Available Rooms */}
            <div className="rumaya-stat-card">
              <div className="rumaya-stat-header">
                <div className="rumaya-icon-wrapper green-icon">
                  <BootstrapIcon name="building" />
                </div>
                <div className="rumaya-stat-text">
                  <span className="rumaya-stat-label">Available Rooms</span>
                  <h3 className="rumaya-stat-val">{availableRooms.length}</h3>
                  <span className="rumaya-sub-label">Ready for move-in</span>
                </div>
              </div>
              <button
                type="button"
                className="rumaya-card-link"
                onClick={() => onNavigate('rooms')}
              >
                Browse Units →
              </button>
            </div>

            {/* Card 2: Average Rent */}
            <div className="rumaya-stat-card">
              <div className="rumaya-stat-header">
                <div className="rumaya-icon-wrapper blue-icon">
                  <BootstrapIcon name="cash" />
                </div>
                <div className="rumaya-stat-text">
                  <span className="rumaya-stat-label">Average Rent</span>
                  <h3 className="rumaya-stat-val">{formatMoney(avgRent)}</h3>
                  <span className="rumaya-sub-label">
                    From {formatMoney(minRent)}/mo
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="rumaya-card-link"
                onClick={() => setPriceSort('asc')}
              >
                Lowest First →
              </button>
            </div>

            {/* Card 3: My Room Inquiries */}
            <div className="rumaya-stat-card">
              <div className="rumaya-stat-header">
                <div className="rumaya-icon-wrapper orange-icon">
                  <BootstrapIcon name="chat" />
                </div>
                <div className="rumaya-stat-text">
                  <span className="rumaya-stat-label">My Inquiries</span>
                  <h3 className="rumaya-stat-val">{inquiries.length}</h3>
                  <span className="rumaya-sub-label">
                    {inquiries.filter((i) => i.status === 'pending').length} Under Review
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="rumaya-card-link"
                onClick={() => onNavigate('inquiries')}
              >
                View Status →
              </button>
            </div>

            {/* Card 4: Most Common Type */}
            <div className="rumaya-stat-card">
              <div className="rumaya-stat-header">
                <div className="rumaya-icon-wrapper purple-icon">
                  <BootstrapIcon name="house" />
                </div>
                <div className="rumaya-stat-text">
                  <span className="rumaya-stat-label">Popular Type</span>
                  <h3 className="rumaya-stat-val">{mostCommonType}</h3>
                  <span className="rumaya-sub-label">
                    {typeCounts[mostCommonType] || 0} Rooms Listed
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="rumaya-card-link"
                onClick={() => setSelectedType(mostCommonType)}
              >
                Filter {mostCommonType} →
              </button>
            </div>
          </div>

          {/* Main Two-Column Layout (2/3 Main Column + 1/3 Side Column) matching Image 2 */}
          <div className={`rumaya-layout-grid ${activeTab === 'favorites' ? '' : 'tenant-dashboard-overview-grid'}`}>
            {/* Left Column (2/3): Daftar Properti Kos (Clean Row Listings) */}
            {activeTab === 'favorites' && <div className="rumaya-main-col">
              <div className="rumaya-panel">
                <div className="rumaya-panel-header">
                  <div>
                    <h3 className="rumaya-panel-title">
                      Saved Favorite Rooms
                    </h3>
                    <p className="rumaya-panel-subtitle">
                      Your rooms saved for later.
                    </p>
                  </div>
                  <span className="unit-count-pill">
                    {favoriteFilteredRooms.length} rooms found
                  </span>
                </div>

                {/* Search & Filters Bar (Rumaya style) */}
                <div className="rumaya-filters-bar">
                  <div className="search-input-wrapper">
                    <BootstrapIcon name="search" className="search-icon" />
                    <input
                      type="text"
                      placeholder="Search by room title, room #, or location…"
                      value={searchTerm}
                      onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                      className="rumaya-search-input"
                    />
                  </div>

                  <select
                    value={selectedType}
                    onChange={(e) => { setSelectedType(e.target.value); setCurrentPage(1); }}
                    className="rumaya-select"
                  >
                    <option value="all">All Room Types</option>
                    {uniqueTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>

                  <select
                    value={priceSort}
                    onChange={(e) => setPriceSort(e.target.value as any)}
                    className="rumaya-select"
                  >
                    <option value="default">Default Order</option>
                    <option value="asc">Price: Low to High</option>
                    <option value="desc">Price: High to Low</option>
                  </select>
                </div>

                {/* List of Units in Clean Rumaya Row Format */}
                <div className="rumaya-rooms-list">
                  {activeTab === 'favorites' && favoritesLoading ? (
                    <p className="muted" style={{ padding: '24px', textAlign: 'center' }}>Loading saved rooms…</p>
                  ) : (() => {
                    const currentList = favoriteFilteredRooms;
                    const totalPages = Math.ceil(currentList.length / itemsPerPage) || 1;
                    const paginatedRooms = currentList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                    if (paginatedRooms.length === 0) {
                      return (
                        <div className="empty-rooms-box">
                          <p>No boarding rooms matched your search or filter.</p>
                          <button
                            type="button"
                            className="button secondary sm"
                            onClick={() => { setSearchTerm(''); setSelectedType('all'); setPriceSort('default'); }}
                          >
                            Reset Filters
                          </button>
                        </div>
                      );
                    }

                    return (
                      <>
                        {paginatedRooms.map((room) => {
                          const imageUrl = room.images && room.images.length > 0
                            ? room.images[0].url
                            : 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=360&q=80';

                          const hasPendingInquiry = inquiries.some(
                            (inq) => inq.room_id === room.id && inq.status === 'pending'
                          );
                          const isFavorited = favorites.some((f) => f.id === room.id);

                          return (
                            <div key={room.id} className="rumaya-room-row">
                              {/* Left Thumbnail with Badge */}
                              <div className="room-img-container">
                                <img src={imageUrl} alt={room.title} className="room-thumb-img" />
                              </div>

                              {/* Main Room Info */}
                              <div className="room-main-info">
                                <div className="room-badge-row">
                                  <span className="room-type-tag">{room.type || 'Standard Room'}</span>
                                  <span className={`status-pill ${room.status === 'available' ? 'success' : 'warning'}`}>
                                    {room.status === 'available' ? 'Available' : 'Reserved (Hold)'}
                                  </span>
                                </div>
                                <h4 className="room-title-heading">
                                  Room {room.room_number} — {room.title}
                                </h4>
                                <p className="room-loc-text">
                                  <BootstrapIcon name="geo" /> {room.location || 'Main Boarding Campus'}
                                </p>
                                <div className="room-amenities-pills">
                                  {room.amenities && room.amenities.length > 0 ? (
                                    room.amenities.slice(0, 3).map((a, i) => (
                                      <span key={i} className="amenity-chip">{a}</span>
                                    ))
                                  ) : (
                                    <span className="amenity-chip">Standard Utilities</span>
                                  )}
                                  {room.landlord && (
                                    <span className="cell-sub" style={{ alignSelf: 'center', marginLeft: '6px' }}>
                                      Landlord: {room.landlord.name}
                                    </span>
                )}
              </div>
            </div>

                              {/* Room Metrics (Rate, Inquiry Status, Saved) */}
                              <div className="room-metrics-col">
                                <div className="metric-box">
                                  <span className="metric-label">Monthly Rate</span>
                                  <strong className="metric-val">{formatMoney(room.price)}/mo</strong>
                                </div>
                                <div className="metric-box">
                                  <span className="metric-label">Availability</span>
                                  <span className="metric-sub text-success">
                                    {room.status === 'available' ? 'Ready to Move' : 'Hold Pending'}
                                  </span>
                                </div>
                                <div className="metric-box">
                                  <span className="metric-label">My Request</span>
                                  <span className="metric-sub">
                                    {hasPendingInquiry ? 'Pending Review' : 'Not Applied'}
                                  </span>
                                </div>
                              </div>

                              {/* Action Buttons Column (Rumaya style) */}
                              <div className="room-actions-col">
                                <button
                                  type="button"
                                  className="button secondary sm"
                                  title={isFavorited ? 'Remove from saved' : 'Save for later'}
                                  onClick={() => void toggleFavorite(room)}
                                >
                                  {isFavorited ? <><BootstrapIcon name="heart" /> Saved</> : <><BootstrapIcon name="heart" /> Save</>}
                                </button>

                                {hasPendingInquiry ? (
                                  <span className="pp-inquiry-pending-tag">Request Sent</span>
                                ) : room.status === 'reserved' ? (
                                  <span className="pp-inquiry-reserved-tag">Offer Hold</span>
                                ) : room.status !== 'available' ? (
                                  <span className="muted">This room is not currently available.</span>
                                ) : hasActiveLease ? (
                                  <span className="muted">Apply after your current rental ends.</span>
                                ) : (
                                  <button
                                    type="button"
                                    className="button primary sm"
                                    onClick={() => {
                                      setSelectedRoomForInquiry(room);
                                      setInquiryMessage('');
                                      setInquiryError('');
                                    }}
                                  >
                                    Inquire Now
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Pagination Bar (Image 2 style) */}
                        {totalPages > 1 && (
                          <div className="rumaya-pagination-bar">
                            <button
                              type="button"
                              className="rumaya-page-btn nav-btn"
                              disabled={currentPage === 1}
                              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            >
                              ‹
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                              <button
                                key={pg}
                                type="button"
                                className={`rumaya-page-btn ${currentPage === pg ? 'active' : ''}`}
                                onClick={() => setCurrentPage(pg)}
                              >
                                {pg}
                              </button>
                            ))}
                            <button
                              type="button"
                              className="rumaya-page-btn nav-btn"
                              disabled={currentPage === totalPages}
                              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            >
                              ›
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>}

            {/* Right Column (1/3): Need Assistance, Account Info, Renting Tips (English) */}
            <div className="rumaya-side-col">
              {/* Card 1: Need Help / Support Mascot Card */}
              <div className="rumaya-panel side-panel tenant-help-card">
                <div className="tenant-help-header">
                  <div>
                    <h4 className="rumaya-side-title">Need Help?</h4>
                    <p className="rumaya-side-subtitle">
                      Our boarding house management team is ready to assist you anytime.
                    </p>
                  </div>
                  <div className="tenant-help-mascot">
                    <BootstrapIcon name="house" className="tenant-help-icon" />
                  </div>
                </div>
                <button
                  type="button"
                  className="button secondary full-width tenant-contact-landlord"
                  onClick={() => {
                    const landlordLease = activeLease || leases.find((lease) => lease.status === 'ended' && lease.landlord?.id);
                    if (!landlordLease?.landlord?.id) {
                      announce?.('A landlord conversation is available after a rental offer has been accepted and a lease has been created.', 'info');
                      return;
                    }
                    onContactLandlord(landlordLease.id);
                  }}
                >
                  <BootstrapIcon name="chat" /> Contact Landlord
                </button>
              </div>

              {/* Card 2: Account & Tenancy Status */}
              <div className="rumaya-panel side-panel">
                <h4 className="rumaya-side-title">Account Information</h4>
                <div className="landlord-info-box">
                  <div className="landlord-avatar-circle" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                    {user?.name?.charAt(0).toUpperCase() || 'T'}
                  </div>
                  <div className="landlord-meta">
                    <strong>{user?.name}</strong>
                    <span className="muted">{user?.email}</span>
                    <span className="verified-badge">
                      {hasActiveLease ? <><BootstrapIcon name="check" /> Verified Resident</> : <><BootstrapIcon name="search" /> Registered Applicant</>}
                    </span>
                  </div>
                </div>

                <div className="landlord-summary-specs">
                  <div className="spec-row">
                    <span>Account Status:</span>
                    <strong>{hasActiveLease ? 'Active Resident' : 'Applicant'}</strong>
                  </div>
                  <div className="spec-row">
                    <span>Assigned Room:</span>
                    <strong>{hasActiveLease && activeLease ? `Room ${activeLease.room?.room_number}` : 'None'}</strong>
                  </div>
                  <div className="spec-row">
                    <span>My Inquiries:</span>
                    <strong>{inquiries.length} Inquiries</strong>
                  </div>
                  <div className="spec-row">
                    <span>Saved Favorites:</span>
                    <strong>{favorites.length} Rooms</strong>
                  </div>
                </div>

                {hasActiveLease ? (
                  <button
                    type="button"
                    className="button primary full-width"
                    onClick={() => { setActiveTab('resident'); }}
                  >
                    View My Tenancy Hub
                  </button>
                ) : (
                  <button
                    type="button"
                    className="button secondary full-width"
                    onClick={() => { setActiveTab('favorites'); void loadFavorites(); }}
                  >
                    View Saved Favorites ({favorites.length})
                  </button>
                )}
              </div>

              {/* Card 3: Room Selection & Rental Tips */}
              <div className="rumaya-panel side-panel">
                <h4 className="rumaya-side-title">Renting Tips & Guidelines</h4>

                <div className="tip-item">
                  <div className="tip-icon"><BootstrapIcon name="lightning" /></div>
                  <div className="tip-text">
                    <strong>24-Hour Room Offer Window</strong>
                    <p>Once a landlord approves your inquiry, the room is placed on hold exclusively for you for 24 hours.</p>
                  </div>
                </div>

                <div className="tip-item">
                  <div className="tip-icon"><BootstrapIcon name="image" /></div>
                  <div className="tip-text">
                    <strong>Check Photos & Amenities</strong>
                    <p>Confirm included room furniture, Wi-Fi, air conditioning, and bath amenities before finalizing.</p>
                  </div>
                </div>

                <div className="tip-item">
                  <div className="tip-icon"><BootstrapIcon name="shield" /></div>
                  <div className="tip-text">
                    <strong>Official In-App Invoices</strong>
                    <p>Always review itemized rent statements and track payment receipts securely in your billing tab.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* My Room Applications Status Section */}
          <div className="tenant-applications-section">
            <div className="panel-header-flex">
              <div>
                <h4 className="panel-title">My Room Applications</h4>
                <p className="panel-subtitle">Track the review status of your submitted requests</p>
              </div>
              <button
                type="button"
                className="action-link-btn"
                onClick={() => onNavigate('inquiries')}
              >
                View Inquiries Page →
              </button>
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Date Submitted</th>
                    <th>My Note</th>
                    <th>Status</th>
                    <th>Landlord Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {inquiries.length > 0 ? (
                    inquiries.map((inq) => (
                      <tr key={inq.id}>
                        <td>
                          <strong>Room {inq.room?.room_number}</strong>
                          <span className="cell-sub">{inq.room?.title} ({formatMoney(inq.room?.price)}/mo)</span>
                        </td>
                        <td>{inq.created_at ? formatBusinessDate(inq.created_at) : '—'}</td>
                        <td>{inq.message || '—'}</td>
                        <td><StatusBadge status={inq.status} /></td>
                        <td>
                          {inq.status === 'approved' && inq.offer_expires_at && new Date(inq.offer_expires_at) > new Date() ? (
                            <div className="table-offer-actions">
                              <span className="offer-pulse-text">24h Offer Active!</span>
                              <button
                                type="button"
                                className="button primary sm"
                                disabled={actionLoadingId === inq.id}
                                onClick={() => handleAcceptOffer(inq)}
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                className="button secondary sm"
                                disabled={actionLoadingId === inq.id}
                                onClick={() => handleDeclineOffer(inq)}
                              >
                                Decline
                              </button>
                            </div>
                          ) : inq.status === 'pending' ? (
                            <span className="muted">Waiting for landlord review</span>
                          ) : inq.status === 'converted' ? (
                            <strong className="text-success">Confirmed Lease</strong>
                          ) : (
                            <span className="muted">Closed / Declined</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: '24px' }}>
                        No room applications submitted yet. Use Browse Rooms in the sidebar to explore listings and apply.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Inquiry Submission Modal */}
      {selectedRoomForInquiry && (
        <Modal
          isOpen={Boolean(selectedRoomForInquiry)}
          title={`Inquire about Room ${selectedRoomForInquiry.room_number}`}
          onClose={() => setSelectedRoomForInquiry(null)}
        >
          <form onSubmit={handleSubmitInquiry} className="inquiry-modal-form">
            <div className="inquiry-room-summary">
              <strong>{selectedRoomForInquiry.title}</strong>
              <span>Rate: {formatMoney(selectedRoomForInquiry.price)}/month · {selectedRoomForInquiry.type || 'Standard'}</span>
              <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.85rem' }}>
                Note: Inquiries are evaluated on a first-qualified, first-approved basis. If approved, you will have 24 hours to confirm your reservation.
              </p>
            </div>

            {inquiryError && (
              <div className="notice-banner alert-critical" style={{ marginBottom: '14px' }}>
                {inquiryError}
              </div>
            )}

            <Field
              label="Application Message / Move-in Request"
              hint="Mention your preferred move-in date, occupancy requirements, or any questions for the landlord."
            >
              <textarea
                rows={4}
                value={inquiryMessage}
                onChange={(e) => setInquiryMessage(e.target.value)}
                placeholder="Hello! I am interested in renting this room starting next month..."
                required
              />
            </Field>

            <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => setSelectedRoomForInquiry(null)}
                disabled={submittingInquiry}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="button primary"
                disabled={submittingInquiry}
              >
                {submittingInquiry ? 'Submitting Application…' : 'Submit Rental Application'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
