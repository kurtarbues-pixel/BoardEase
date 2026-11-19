import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, fetchAll, formatMoney } from '../../api/client';
import { Lease, Room, RoomFormData, RoomImage, RoomStatus, User } from '../../types';
import { StatusBadge } from '../../components/Common/StatusBadge';
import { Field } from '../../components/Common/Field';
import { Modal } from '../../components/Common/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/Common/States';
import { formatBusinessDate, getBusinessDayOfMonth, getBusinessWeekday, getTodayDateString } from '../../utils/date';

interface RoomsPageProps {
  announce: (message: string, kind?: 'success' | 'error' | 'warning' | 'info') => void;
  onNavigate: (pageId: string) => void;
}

type RoomApiResponse = Room | { data: Room };

const unwrapRoom = (response: RoomApiResponse): Room =>
  'data' in response && response.data ? response.data : response as Room;

export const RoomsPage: React.FC<RoomsPageProps> = ({ announce, onNavigate }) => {
  const { user } = useAuth();
  const canManage = user?.role === 'landlord' || user?.role === 'staff';
  const isAdmin = user?.role === 'admin';

  const [rooms, setRooms] = useState<Room[]>([]);
  const [landlords, setLandlords] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [roomSearch, setRoomSearch] = useState('');
  const [landlordSearch, setLandlordSearch] = useState('');
  const [selectedLandlordId, setSelectedLandlordId] = useState<number | null>(null);

  // Modal / form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [inquiryRoom, setInquiryRoom] = useState<Room | null>(null);
  const [detailRoom, setDetailRoom] = useState<Room | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const detailRequestId = React.useRef(0);
  const [roomReviews, setRoomReviews] = useState<Array<{ id: number; rating: number; review: string; tenant?: { name: string }; created_at: string }>>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [detailPhotoIndex, setDetailPhotoIndex] = useState(0);
  const [showRoomGallery, setShowRoomGallery] = useState(false);
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [inquiryStartDate, setInquiryStartDate] = useState('');
  const [inquiryEndDate, setInquiryEndDate] = useState('');
  const [calendarDays, setCalendarDays] = useState<{ date: string; available: boolean; reason: string | null }[]>([]);
  const [calendarBlocks, setCalendarBlocks] = useState<{ id: number; start_date: string; end_date: string; reason?: string | null }[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [blockStartDate, setBlockStartDate] = useState('');
  const [blockEndDate, setBlockEndDate] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [tenantRentalStatus, setTenantRentalStatus] = useState<'checking' | 'active' | 'none' | 'error'>('checking');

  // Form inputs
  const [roomNumber, setRoomNumber] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [capacity, setCapacity] = useState('');
  const [location, setLocation] = useState('');
  const [price, setPrice] = useState<number | string>('');
  const [status, setStatus] = useState<RoomStatus>('available');
  const [amenities, setAmenities] = useState('');
  const [description, setDescription] = useState('');
  const [roomImages, setRoomImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<RoomImage[]>([]);
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null);

  useEffect(() => {
    const urls = roomImages.map((file) => URL.createObjectURL(file));
    setImagePreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [roomImages]);

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

  useEffect(() => {
    if (!detailRoom) { setRoomReviews([]); return; }
    let active = true;
    setReviewsLoading(true);
    api<{ data: Array<{ id: number; rating: number; review: string; tenant?: { name: string }; created_at: string }> }>(`/rooms/${detailRoom.id}/reviews`)
      .then((result) => { if (active) setRoomReviews(result.data || []); })
      .catch(() => { if (active) setRoomReviews([]); })
      .finally(() => { if (active) setReviewsLoading(false); });
    return () => { active = false; };
  }, [detailRoom?.id]);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, accounts] = await Promise.all([
        fetchAll<Room>('/rooms?per_page=50'),
        isAdmin ? fetchAll<User>('/admin/users') : Promise.resolve([]),
      ]);
      setRooms(data);
      setLandlords(accounts.filter((account) => account.role === 'landlord'));
    } catch (err: any) {
      setError(err.message || 'Failed to load rooms.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  const refreshTenantRentalStatus = useCallback(async () => {
    if (user?.role !== 'tenant') {
      setTenantRentalStatus('none');
      return;
    }
    setTenantRentalStatus('checking');
    try {
      // The authenticated Laravel endpoint scopes leases to the current tenant.
      const leases = await fetchAll<Lease>('/leases');
      setTenantRentalStatus(leases.some((lease) => lease.status === 'active') ? 'active' : 'none');
    } catch {
      // Fail closed: do not enable new applications when the rental status is unknown.
      setTenantRentalStatus('error');
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (user?.role !== 'tenant') return;
    void refreshTenantRentalStatus();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshTenantRentalStatus();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refreshTenantRentalStatus, user?.role]);

  const openAddModal = () => {
    setEditingRoom(null);
    setRoomNumber('');
    setTitle('');
    setType('');
    setCapacity('');
    setLocation('');
    setPrice('');
    setStatus('available');
    setAmenities('');
    setDescription('');
    setRoomImages([]);
    setImagePreviews([]);
    setExistingImages([]);
    setIsModalOpen(true);
  };

  const openEditModal = (room: Room) => {
    setEditingRoom(room);
    setRoomNumber(room.room_number);
    setTitle(room.title);
    setType(room.type || '');
    setCapacity(room.capacity?.toString() || '');
    setLocation(room.location);
    setPrice(room.price);
    setStatus(room.status);
    setAmenities((room.amenities || []).join(', '));
    setDescription(room.description || '');
    setRoomImages([]);
    setImagePreviews([]);
    setExistingImages(room.images || []);
    setIsModalOpen(true);
  };

  const handleDeleteExistingImage = async (imageId: number) => {
    if (!editingRoom) return;
    if (!window.confirm('Are you sure you want to remove this photo?')) return;
    setDeletingImageId(imageId);
    try {
      await api(`/rooms/${editingRoom.id}/images/${imageId}`, { method: 'DELETE' });
      setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
      setRooms((prev) => prev.map((r) => r.id === editingRoom.id ? { ...r, images: (r.images || []).filter((img) => img.id !== imageId) } : r));
      setEditingRoom((prev) => prev ? { ...prev, images: (prev.images || []).filter((img) => img.id !== imageId) } : null);
      announce('Photo removed successfully.');
    } catch (err: any) {
      announce(err.message || 'Could not delete photo.', 'error');
    } finally {
      setDeletingImageId(null);
    }
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const payload: RoomFormData = {
      room_number: roomNumber.trim(),
      title: title.trim(),
      type: type.trim() || null,
      capacity: capacity ? Number(capacity) : null,
      description: description.trim() || null,
      location: location.trim(),
      price: Number(price),
      status: status,
      amenities: amenities
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    };

    let newlyCreatedRoom: Room | null = null;
    try {
      if (editingRoom) {
        const updatedResponse = await api<RoomApiResponse>(`/rooms/${editingRoom.id}`, {
          method: 'PUT',
          body: payload,
        });
        const updated = unwrapRoom(updatedResponse);
        if (!updated.id) throw new Error('The room was updated, but the server did not return its ID. Please refresh and retry the photo upload.');
        await uploadRoomImages(updated.id);
        announce('Room edited successfully.');
      } else {
        const createdResponse = await api<RoomApiResponse>('/rooms', {
          method: 'POST',
          body: payload,
        });
        const created = unwrapRoom(createdResponse);
        if (!created.id) throw new Error('The room was created, but the server did not return its ID. Please refresh before uploading photos.');
        newlyCreatedRoom = created;
        await uploadRoomImages(created.id);
        announce('Room created successfully.');
      }
      await loadRooms();
      setIsModalOpen(false);
      setEditingRoom(null);
      setRoomImages([]);
      setExistingImages([]);
    } catch (err: any) {
      if (newlyCreatedRoom) {
        setEditingRoom(newlyCreatedRoom);
        const uploadedCount = Number(err.uploadedImageCount || 0);
        setRoomImages((files) => files.slice(uploadedCount));
        announce(`Room created, but its photos could not be uploaded. The form is ready so you can retry the photo upload. ${err.message || ''}`.trim(), 'error');
      } else {
        announce(err.message || 'Could not save room.', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const uploadRoomImages = async (roomId: number) => {
    if (!roomImages.length) return;
    const batchSize = 3;
    for (let start = 0; start < roomImages.length; start += batchSize) {
      const batch = roomImages.slice(start, start + batchSize);
      const form = new FormData();
      batch.forEach((image) => form.append('images[]', image));
      const endpoint = `/rooms/${roomId}/images`;
      try {
        await api(endpoint, { method: 'POST', body: form });
      } catch (error) {
        if (error && typeof error === 'object') Object.assign(error, { uploadedImageCount: start });
        throw error;
      }
    }
  };

  const toggleAvailability = async (room: Room, newStatus: RoomStatus) => {
    try {
      await api(`/rooms/${room.id}/availability`, {
        method: 'PATCH',
        body: { status: newStatus },
      });
      announce(`Room status set to ${newStatus}.`);
      await loadRooms();
    } catch (err: any) {
      announce(err.message || 'Failed to update status.', 'error');
    }
  };

  const deleteRoom = async (room: Room) => {
    if (!window.confirm(`Are you sure you want to delete Room ${room.room_number} (${room.title})?`)) {
      return;
    }

    try {
      await api(`/rooms/${room.id}`, { method: 'DELETE' });
      announce('Room deleted successfully.');
      await loadRooms();
    } catch (err: any) {
      announce(err.message || 'Could not delete room.', 'error');
    }
  };

  const openInquiryModal = (room: Room) => {
    if (user?.role === 'tenant' && tenantRentalStatus !== 'none') {
      if (tenantRentalStatus === 'active') {
        announce('You already have an active rental. Review your current lease in My Rental before applying for another room.', 'warning');
        onNavigate('leases');
      } else if (tenantRentalStatus === 'error') {
        announce('We could not verify your current rental. Please retry before applying.', 'error');
      } else {
        announce('Checking your current rental status. Please try again in a moment.', 'info');
      }
      return;
    }
    if (room.status !== 'available') {
      announce('This room is no longer available for a new inquiry.', 'warning');
      return;
    }
    setInquiryRoom(room);
    setInquiryMessage(`I am interested in renting Room ${room.room_number}. Please let me know the requirements and move-in details.`);
    setInquiryStartDate('');
    setInquiryEndDate('');
  };

  const openRoomDetails = async (room: Room) => {
    const requestId = ++detailRequestId.current;
    setDetailRoom(room);
    setDetailPhotoIndex(0);
    setDetailError('');
    setDetailLoading(true);
    setCalendarDays([]);
    setCalendarBlocks([]);
    void loadRoomCalendar(room);

    try {
      const response = await api<RoomApiResponse>(`/rooms/${room.id}`);
      const current = unwrapRoom(response);
      if (requestId === detailRequestId.current) setDetailRoom(current);
    } catch (err: any) {
      if (requestId === detailRequestId.current) setDetailError(err.message || 'Could not load room details.');
    } finally {
      if (requestId === detailRequestId.current) setDetailLoading(false);
    }
  };

  const loadRoomCalendar = async (room: Room) => {
    setCalendarLoading(true);
    const start = getTodayDateString();
    const endDate = new Date(`${start}T00:00:00Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 41);
    const end = endDate.toISOString().slice(0, 10);
    try {
      const data = await api<{ days: { date: string; available: boolean; reason: string | null }[]; blocks?: typeof calendarBlocks }>(`/rooms/${room.id}/availability-calendar?start_date=${start}&end_date=${end}`);
      setCalendarDays(data.days || []);
      setCalendarBlocks(data.blocks || []);
    } catch (err: any) {
      setCalendarDays([]);
      setCalendarBlocks([]);
      announce(err.message || 'Could not load room availability.', 'error');
    } finally { setCalendarLoading(false); }
  };

  const removeAvailabilityBlock = async (blockId: number) => {
    if (!detailRoom) return;
    try {
      await api(`/rooms/${detailRoom.id}/availability-blocks/${blockId}`, { method: 'DELETE' });
      announce('Blocked dates reopened.'); await loadRoomCalendar(detailRoom);
    } catch (err: any) { announce(err.message || 'Could not reopen these dates.', 'error'); }
  };

  const addAvailabilityBlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detailRoom || !blockStartDate || !blockEndDate) return;
    try {
      await api(`/rooms/${detailRoom.id}/availability-blocks`, { method: 'POST', body: { start_date: blockStartDate, end_date: blockEndDate, reason: blockReason || null } });
      announce('Room dates marked unavailable.');
      setBlockStartDate(''); setBlockEndDate(''); setBlockReason('');
      await loadRoomCalendar(detailRoom);
    } catch (err: any) { announce(err.message || 'Could not block these dates.', 'error'); }
  };

  const handleSendInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryRoom) return;
    if (tenantRentalStatus !== 'none') {
      setInquiryRoom(null);
      if (tenantRentalStatus === 'active') {
        announce('You already have an active rental. Review your current lease in My Rental before applying for another room.', 'warning');
        onNavigate('leases');
      } else {
        announce('We could not verify your current rental. Please retry before applying.', 'error');
        void refreshTenantRentalStatus();
      }
      return;
    }
    if (inquiryRoom.status !== 'available') {
      setInquiryRoom(null);
      announce('This room is no longer available for a new inquiry.', 'warning');
      await loadRooms();
      return;
    }

    setIsSaving(true);
    try {
      await api(`/rooms/${inquiryRoom.id}/inquiries`, {
        method: 'POST',
        body: { message: inquiryMessage, desired_start_date: inquiryStartDate || null, desired_end_date: inquiryEndDate || null },
      });
      announce('Your application was sent. You will get 24 hours to respond if selected.');
      setInquiryRoom(null);
    } catch (err: any) {
      if (String(err.message || '').toLowerCase().includes('active rental')) {
        setTenantRentalStatus('active');
        setInquiryRoom(null);
      }
      announce(err.message || 'Could not submit inquiry.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredRooms = rooms.filter((r) => {
    const matchesStatus = filter === 'all' || r.status === filter;
    const query = roomSearch.trim().toLocaleLowerCase();
    const matchesSearch = !query || [r.room_number, r.title, r.location, r.type]
      .some((value) => value?.toLocaleLowerCase().includes(query));
    return matchesStatus && matchesSearch;
  });

  const visibleLandlords = landlords
    .filter((landlord) => {
      const query = landlordSearch.trim().toLowerCase();
      return (!query || [landlord.name, landlord.email, landlord.phone].some((value) => value?.toLowerCase().includes(query)))
        && (selectedLandlordId === null || landlord.id === selectedLandlordId);
    })
    .map((landlord) => {
      const landlordRooms = rooms.filter((room) => room.landlord_id === landlord.id);
      return {
        landlord,
        rooms: landlordRooms,
        available: landlordRooms.filter((room) => room.status === 'available').length,
        occupied: landlordRooms.filter((room) => room.status === 'occupied').length,
        reserved: landlordRooms.filter((room) => room.status === 'reserved').length,
        maintenance: landlordRooms.filter((room) => room.status === 'maintenance').length,
      };
    });

  return (
    <div className="rooms-page">
      <div className="welcome-block">
        <div>
          <h2>{isAdmin ? 'Room Listings by Landlord' : canManage ? 'My Room Inventory' : 'Browse Rooms'}</h2>
          <p className="muted">{isAdmin ? 'Monitor platform listings, room counts, and listing status by landlord.' : canManage ? 'Manage listings for your boarding house.' : 'Browse available rooms, prices, amenities, and house rules.'}</p>
        </div>
        <div className="actions-cluster">
          {canManage && (
            <button type="button" className="button primary" onClick={openAddModal}>
              + Add Room
            </button>
          )}
        </div>
      </div>

      {user?.role === 'tenant' && tenantRentalStatus === 'active' && <div className="tenant-rental-restriction" role="status">
        <div><strong>Current Rental Active</strong><p>You already have an active rental. You can continue browsing available rooms, but you must complete or officially end your current rental before applying for another room.</p></div>
        <button type="button" className="button secondary" onClick={() => onNavigate('leases')}>View My Rental</button>
      </div>}
      {user?.role === 'tenant' && tenantRentalStatus === 'checking' && <p className="tenant-rental-status muted" role="status">Checking your current rental before enabling applications…</p>}
      {user?.role === 'tenant' && tenantRentalStatus === 'error' && <div className="tenant-rental-restriction is-error" role="alert">
        <div><strong>Rental status unavailable</strong><p>We could not verify your current rental. Applications are paused until your rental status can be checked.</p></div>
        <button type="button" className="button secondary" onClick={() => void refreshTenantRentalStatus()}>Retry</button>
      </div>}

      <div className="filter-bar">
        <span className="filter-label">Filter:</span>
        {user?.role === 'tenant' && <input type="search" className="room-list-search" aria-label="Search rooms" placeholder="Search by room, title, location, or type" value={roomSearch} onChange={(event) => setRoomSearch(event.target.value)} />}
        {(canManage || isAdmin ? ['all', 'available', 'reserved', 'occupied', 'maintenance'] : ['all', 'available']).map((statusKey) => (
          <button
            key={statusKey}
            type="button"
            className={`filter-chip ${filter === statusKey ? 'active' : ''}`}
            onClick={() => setFilter(statusKey)}
          >
            {statusKey.charAt(0).toUpperCase() + statusKey.slice(1)}
            {statusKey === 'all'
              ? ` (${rooms.length})`
              : ` (${rooms.filter((r) => r.status === statusKey).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState message="Loading room listings…" />
      ) : error ? (
        <ErrorState error={error} retry={loadRooms} />
      ) : isAdmin ? (
        <section className="admin-landlord-room-overview" aria-label="Room listings grouped by landlord">
          <div className="admin-landlord-room-toolbar">
            <label className="admin-landlord-room-search">
              <span>Search landlords</span>
              <input type="search" value={landlordSearch} onChange={(event) => setLandlordSearch(event.target.value)} placeholder="Name, email, or phone" />
            </label>
            <label className="admin-landlord-room-filter">
              <span>Filter landlord</span>
              <select value={selectedLandlordId ?? ''} onChange={(event) => setSelectedLandlordId(event.target.value ? Number(event.target.value) : null)}>
                <option value="">All landlords ({landlords.length})</option>
                {landlords.map((landlord) => <option key={landlord.id} value={landlord.id}>{landlord.name}</option>)}
              </select>
            </label>
          </div>
          {visibleLandlords.length === 0 ? (
            <EmptyState title="No landlords found" message={landlords.length ? 'Try a different search or landlord filter.' : 'No landlord accounts are registered yet.'} />
          ) : (
            <div className="admin-landlord-room-list">
              {visibleLandlords.map(({ landlord, rooms: landlordRooms, available, occupied, reserved, maintenance }) => {
                const expanded = selectedLandlordId === landlord.id;
                return <article className={`admin-landlord-room-card ${expanded ? 'expanded' : ''}`} key={landlord.id}>
                  <button type="button" className="admin-landlord-room-summary" aria-expanded={expanded} onClick={() => setSelectedLandlordId(expanded ? null : landlord.id)}>
                    <span className="admin-landlord-room-identity"><strong>{landlord.name}</strong><span>{landlord.email}{landlord.phone ? ` · ${landlord.phone}` : ''}</span></span>
                    <span className="admin-landlord-room-count"><strong>{landlordRooms.length}</strong><span>{landlordRooms.length === 1 ? 'room' : 'rooms'}</span></span>
                    <span className="admin-landlord-room-statuses">
                      <span>{available} available</span><span>{occupied} occupied</span><span>{maintenance} maintenance</span>{reserved > 0 && <span>{reserved} reserved</span>}
                    </span>
                    <span className="admin-landlord-room-toggle">{expanded ? 'Hide rooms' : 'View rooms'} <span aria-hidden="true">{expanded ? '−' : '+'}</span></span>
                  </button>
                  {expanded && <div className="admin-landlord-room-details">
                    {landlordRooms.length === 0 ? <EmptyState message="This landlord has no room listings yet." /> : (
                      (landlordRooms.filter((room) => filter === 'all' || room.status === filter).length === 0
                        ? <EmptyState title="No rooms match this status" message={`This landlord has no ${filter} rooms.`} />
                        : <div className="admin-landlord-room-table-wrap"><table className="admin-landlord-room-table"><thead><tr><th>Room</th><th>Listing</th><th>Location</th><th>Monthly rent</th><th>Status</th><th>Details</th></tr></thead><tbody>
                        {landlordRooms.filter((room) => filter === 'all' || room.status === filter).map((room) => <tr key={room.id}>
                          <td>{room.room_number}</td><td>{room.title}</td><td>{room.location}</td><td>{formatMoney(room.price)}</td><td><StatusBadge status={room.status} /></td>
                          <td><button type="button" className="button secondary sm" onClick={() => void openRoomDetails(room)}>View details</button></td>
                        </tr>)}
                      </tbody></table></div>)
                    )}
                  </div>}
                </article>;
              })}
            </div>
          )}
        </section>
      ) : filteredRooms.length === 0 ? (
        <EmptyState
          title="No rooms found"
          message={
            roomSearch.trim()
              ? `No rooms match “${roomSearch.trim()}”. Try another search or clear the filters.`
              : filter !== 'all'
              ? `There are no rooms currently matching "${filter}".`
              : 'No rooms have been added to the system yet.'
          }
          action={
            canManage ? (
              <button type="button" className="button primary" onClick={openAddModal}>
                Add First Room
              </button>
            ) : roomSearch.trim() || filter !== 'all' ? (
              <button type="button" className="button secondary" onClick={() => { setRoomSearch(''); setFilter('all'); }}>
                Clear Search and Filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="room-grid">
          {filteredRooms.map((room) => (
              <article className="room-card" key={room.id} onClick={() => void openRoomDetails(room)}>
              <div className="room-card-top">
              <StatusBadge status={room.status === 'reserved' ? 'Reserved (offer pending)' : room.status} />
                <span className="room-number">Room {room.room_number}</span>
              </div>

              <h3>{room.title}</h3>
              {Number(room.review_count || 0) > 0 && <p className="room-rating-summary"><span aria-hidden="true">★</span> {Number(room.average_rating || 0).toFixed(1)} <small>({room.review_count} {room.review_count === 1 ? 'review' : 'reviews'})</small></p>}
              <p className="muted">
                {room.type || 'Room'} · {room.location}
              </p>

              <strong className="room-price">
                {formatMoney(room.price)} <small>per month</small>
              </strong>

              {room.description && (
                <p className="room-desc">{room.description}</p>
              )}

              {room.amenities && room.amenities.length > 0 && (
                <div className="amenities-tags">
                  {room.amenities.map((item, index) => (
                    <span key={index} className="amenity-tag">
                      {item}
                    </span>
                  ))}
                </div>
              )}

              <div className="room-actions">
                <button type="button" className="button secondary sm" onClick={(event) => { event.stopPropagation(); void openRoomDetails(room); }}>
                  View details
                </button>
                {canManage ? (
                  <>
                    <button
                      type="button"
                      className="button secondary sm"
                      onClick={(event) => { event.stopPropagation(); openEditModal(room); }}
                    >
                      Edit
                    </button>
                    {room.status === 'reserved' ? (
                      <div className="inline-actions">
                        <span className="occupied-badge">Offer Pending</span>
                        <button type="button" className="button secondary sm" onClick={(event) => { event.stopPropagation(); if (window.confirm('Cancel this room offer and make the room available?')) void toggleAvailability(room, 'available'); }}>Cancel Offer</button>
                      </div>
                    ) : room.status === 'maintenance' ? (
                      <button
                        type="button"
                        className="button secondary sm"
                        onClick={(event) => { event.stopPropagation(); if (window.confirm('Set this room as available?')) void toggleAvailability(room, 'available'); }}
                      >
                        Set Available
                      </button>
                    ) : room.status === 'available' ? (
                      <button
                        type="button"
                        className="button secondary sm"
                        onClick={(event) => { event.stopPropagation(); if (window.confirm('Set this room to maintenance?')) void toggleAvailability(room, 'maintenance'); }}
                      >
                        Maintenance
                      </button>
                    ) : (
                      <span className="occupied-badge">Active Lease</span>
                    )}
                    <button
                      type="button"
                      className="button danger-outline sm"
                      onClick={(event) => { event.stopPropagation(); void deleteRoom(room); }}
                    >
                      Delete
                    </button>
                  </>
                ) : isAdmin ? (
                  <span className="muted">Listing moderation is available in admin tools.</span>
                ) : user?.role === 'tenant' && room.status === 'available' && tenantRentalStatus === 'active' ? null : user?.role === 'tenant' && room.status === 'available' && tenantRentalStatus !== 'none' ? (
                  <div className="room-request-restricted">
                    <span className="muted">{tenantRentalStatus === 'error' ? 'Rental status could not be checked.' : 'Checking rental status…'}</span>
                    {tenantRentalStatus === 'error' && <button type="button" className="button secondary sm" onClick={(event) => { event.stopPropagation(); void refreshTenantRentalStatus(); }}>Retry</button>}
                  </div>
                ) : room.status === 'available' || room.status === 'reserved' ? (
                  room.status === 'reserved' ? (
                    <span className="muted not-available-text">Another applicant has a 24-hour offer for this room.</span>
                  ) : (
                    <button type="button" className="button primary full" onClick={(event) => { event.stopPropagation(); openInquiryModal(room); }}>
                      Request This Room
                    </button>
                  )
                ) : (
                  <span className="muted not-available-text">
                    {room.status === 'occupied' ? 'Currently Occupied' : 'Under Maintenance'}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Add / Edit Room Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { if (!isSaving) setIsModalOpen(false); }}
          title={editingRoom ? `Edit Room ${editingRoom.room_number}` : 'Add New Room'}
        maxWidth="600px"
      >
        <form className="form-grid" onSubmit={handleSaveRoom}>
          <Field label="Room number" required>
            <input
              type="text"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              placeholder="e.g. 101"
              required
              maxLength={20}
            />
          </Field>

          <Field label="Room name / title" required>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Deluxe Single Room"
              required
            />
          </Field>

          <Field label="Room type">
            <input
              type="text"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="Single, Bedspace, Master, Studio…"
            />
          </Field>

          <Field label="Capacity" hint="Maximum number of occupants, if known.">
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="e.g. 2"
            />
          </Field>

          <Field label="Location / Wing / Floor" required>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. 2nd Floor, East Wing"
              required
            />
          </Field>

          <Field label="Monthly rent (₱)" required>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="5000.00"
              required
            />
          </Field>

          <Field label="Status" required>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as RoomStatus)}
              disabled={editingRoom?.status === 'occupied'}
            >
              <option value="available">Available</option>
              <option value="maintenance">Maintenance</option>
              {editingRoom?.status === 'occupied' && (
                <option value="occupied">Occupied by active lease</option>
              )}
            </select>
          </Field>

          <Field
            label="Amenities (comma separated)"
            hint="Separate each amenity with a comma (e.g. Wi-Fi, Aircon, Own CR, Cabinet)"
          >
            <input
              type="text"
              value={amenities}
              onChange={(e) => setAmenities(e.target.value)}
              placeholder="Wi-Fi, Aircon, Own Bathroom"
            />
          </Field>

          <Field label="Room description">
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide additional details or policies about this room…"
            />
          </Field>

          <Field
            label="Room photos (JPG or PNG, up to 2 MB each)"
            hint={`Maximum 8 photos total per room. Current total: ${existingImages.length + roomImages.length}/8.`}
          >
            <input
              type="file"
              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
              multiple
              disabled={existingImages.length + roomImages.length >= 8}
              onChange={(event) => {
                const selected = Array.from(event.target.files || []);
                const currentTotal = existingImages.length + roomImages.length;
                if (currentTotal + selected.length > 8) {
                  announce(`Cannot add ${selected.length} photos. A maximum of 8 total photos is allowed per room (currently ${currentTotal}/8).`, 'error');
                  event.target.value = '';
                  return;
                }
                const invalidFile = selected.find(
                  (file) => file.size > 2 * 1024 * 1024 || !['image/jpeg', 'image/png'].includes(file.type)
                );
                if (invalidFile) {
                  announce('Each photo must be a JPG or PNG file no larger than 2 MB.', 'error');
                  event.target.value = '';
                  return;
                }
                setRoomImages((prev) => [...prev, ...selected]);
                event.target.value = '';
              }}
            />

            {(existingImages.length > 0 || imagePreviews.length > 0) && (
              <div className="room-photo-preview">
                <div className="room-photo-header">
                  <p className="hint-text" style={{ margin: 0 }}>
                    Room Photos
                  </p>
                  <span className="room-photo-counter">
                    {existingImages.length + roomImages.length} / 8 photos
                  </span>
                </div>

                <div className="room-photo-preview-grid">
                  {existingImages.map((image, index) => (
                    <div className="room-photo-preview-item" key={`existing-${image.id}`}>
                      <img src={image.url} alt={`Saved room photo ${index + 1}`} />
                      <span className="room-photo-badge">Saved</span>
                      <button
                        type="button"
                        className="button danger-outline sm"
                        aria-label={`Delete saved photo ${index + 1}`}
                        disabled={deletingImageId === image.id || isSaving}
                        onClick={() => handleDeleteExistingImage(image.id)}
                      >
                        {deletingImageId === image.id ? 'Deleting…' : 'Remove'}
                      </button>
                    </div>
                  ))}

                  {imagePreviews.map((url, index) => (
                    <div className="room-photo-preview-item" key={`new-${url}-${index}`}>
                      <img src={url} alt={`New room photo ${index + 1}`} />
                      <span className="room-photo-badge" style={{ background: 'rgba(34, 107, 67, 0.85)' }}>New</span>
                      <button
                        type="button"
                        className="button danger-outline sm"
                        aria-label={`Remove newly selected photo ${index + 1}`}
                        disabled={isSaving}
                        onClick={() => setRoomImages((files) => files.filter((_, fileIndex) => fileIndex !== index))}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Field>

          <div className="form-actions">
            <button type="submit" className="button primary" disabled={isSaving}>
              {isSaving ? 'Saving…' : editingRoom ? 'Update Room' : 'Create Room'}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(detailRoom)} onClose={() => { detailRequestId.current += 1; setDetailRoom(null); setShowRoomGallery(false); }} title={detailRoom?.title || 'Room details'} maxWidth="1040px">
        {detailLoading ? <LoadingState message="Loading room details..." /> : detailError ? <ErrorState error={detailError} retry={() => { if (detailRoom) void openRoomDetails(detailRoom); }} /> : detailRoom && (() => {
          const photos = detailRoom.images || [];
          const selectedPhoto = photos[detailPhotoIndex] || photos[0];
          const movePhoto = (direction: number) => setDetailPhotoIndex((index) => (index + direction + photos.length) % photos.length);
          return <div className="room-detail">
            <div className="room-detail-gallery">
              {selectedPhoto ? <div className="room-gallery-stage">
                <img src={selectedPhoto.url} alt={`${detailRoom.title} photo ${detailPhotoIndex + 1}`} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80'; }} />
                {photos.length > 1 && <>
                  <button type="button" className="room-gallery-arrow previous" onClick={() => movePhoto(-1)} aria-label="Previous room photo">‹</button>
                  <button type="button" className="room-gallery-arrow next" onClick={() => movePhoto(1)} aria-label="Next room photo">›</button>
                </>}
                <button type="button" className="room-gallery-count" onClick={() => setShowRoomGallery(true)}>▧ View gallery ({photos.length})</button>
              </div> : <div className="room-image-placeholder">No room photos uploaded</div>}
            </div>
            <div className="room-detail-copy"><StatusBadge status={detailRoom.status} /><h3>Room {detailRoom.room_number} · {detailRoom.location}</h3><div className="room-detail-meta"><p><strong>Room type</strong><span>{detailRoom.type || 'Not specified'}</span></p><p><strong>Capacity</strong><span>{detailRoom.capacity ? `Up to ${detailRoom.capacity} occupants` : 'Not specified'}</span></p><p><strong>Location</strong><span>{detailRoom.location}</span></p></div><strong className="room-price">{formatMoney(detailRoom.price)} <small>per month</small></strong>{detailRoom.description ? <p>{detailRoom.description}</p> : <p className="muted">No room description has been provided.</p>}{detailRoom.amenities?.length ? <div className="amenities-tags" aria-label="Available amenities">{detailRoom.amenities.map((item) => <span className="amenity-tag" key={item}>{item}</span>)}</div> : <p className="muted">No amenities have been listed.</p>}{detailRoom.landlord && <div className="room-detail-landlord"><strong>Landlord: {detailRoom.landlord.name}</strong>{detailRoom.landlord.phone && <span>{detailRoom.landlord.phone}</span>}{detailRoom.landlord.email && <span>{detailRoom.landlord.email}</span>}</div>}
              {user?.role === 'tenant' && (detailRoom.status === 'available' && tenantRentalStatus === 'none' ? <button type="button" className="button primary full" onClick={() => { detailRequestId.current += 1; setDetailRoom(null); openInquiryModal(detailRoom); }}>Request this room</button> : detailRoom.status === 'available' && tenantRentalStatus === 'active' ? null : detailRoom.status === 'available' && tenantRentalStatus === 'error' ? <div className="room-request-restricted detail-restricted"><p>Rental status could not be verified, so applications are paused.</p><button type="button" className="button secondary full" onClick={() => void refreshTenantRentalStatus()}>Retry status check</button></div> : detailRoom.status === 'available' ? <p className="muted">Checking rental status before enabling applications…</p> : <p className="muted not-available-text">This room is {detailRoom.status} and cannot receive a new inquiry.</p>)}
              <section className="room-reviews" aria-label="Room reviews"><h4>Guest reviews {Number(detailRoom.review_count || 0) > 0 && <span className="room-rating-summary"><span aria-hidden="true">★</span> {Number(detailRoom.average_rating || 0).toFixed(1)} ({detailRoom.review_count})</span>}</h4>{reviewsLoading ? <p className="muted">Loading reviews…</p> : roomReviews.length ? roomReviews.map((review) => <article className="room-review-item" key={review.id}><div className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div><p>{review.review}</p><small className="muted">{review.tenant?.name || 'Verified tenant'} · {formatBusinessDate(review.created_at)}</small></article>) : <p className="muted">No approved reviews yet.</p>}</section>
            </div>
            <section className="availability-calendar" aria-label="Room availability calendar">
              <h4>Availability · next 6 weeks</h4>
              <div className="availability-calendar-layout">
                <div className="availability-calendar-main">
                  {calendarLoading ? <p className="muted">Loading dates…</p> : <div className="availability-days">{calendarDays.map((day) => <span key={day.date} className={`availability-day ${day.available ? 'is-available' : 'is-unavailable'}`} title={day.reason || 'Available'}><strong>{getBusinessWeekday(day.date)}</strong><span>{getBusinessDayOfMonth(day.date)}</span></span>)}</div>}
                </div>
                {canManage && <form className="availability-block-form" onSubmit={addAvailabilityBlock}>
                  <strong className="availability-block-title">Block dates</strong>
                  <Field label="From"><input type="date" value={blockStartDate} onChange={(e) => setBlockStartDate(e.target.value)} required /></Field>
                  <Field label="Through"><input type="date" value={blockEndDate} onChange={(e) => setBlockEndDate(e.target.value)} min={blockStartDate} required /></Field>
                  <Field label="Reason"><input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} maxLength={255} placeholder="Optional" /></Field>
                  <button className="button secondary" type="submit">Save blocked dates</button>
                </form>}
              </div>
              {canManage && calendarBlocks.length > 0 && <div className="availability-blocks">{calendarBlocks.map((block) => <div className="availability-block-row" key={block.id}><span>{block.start_date} – {block.end_date}{block.reason ? ` · ${block.reason}` : ''}</span><button type="button" className="button secondary sm" onClick={() => void removeAvailabilityBlock(block.id)}>Reopen</button></div>)}</div>}
            </section>
            {showRoomGallery && <div className="room-gallery-lightbox" role="dialog" aria-modal="true" aria-label="Room photo gallery" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowRoomGallery(false); }}>
              <button type="button" className="room-gallery-lightbox-close" onClick={() => setShowRoomGallery(false)} aria-label="Close gallery">×</button>
              {photos.length > 1 && <button type="button" className="room-gallery-arrow previous" onClick={() => movePhoto(-1)} aria-label="Previous room photo">‹</button>}
              {selectedPhoto && <img src={selectedPhoto.url} alt={`${detailRoom.title} photo ${detailPhotoIndex + 1}`} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80'; }} />}
              {photos.length > 1 && <button type="button" className="room-gallery-arrow next" onClick={() => movePhoto(1)} aria-label="Next room photo">›</button>}
              <span className="room-gallery-lightbox-count">{detailPhotoIndex + 1} / {photos.length}</span>
            </div>}
          </div>;
        })()}
      </Modal>

      {/* Tenant Inquiry Modal */}
      <Modal
        isOpen={Boolean(inquiryRoom)}
        onClose={() => setInquiryRoom(null)}
        title={`Request Room ${inquiryRoom?.room_number}`}
        maxWidth="500px"
      >
        {inquiryRoom && (
          <form className="form-stack" onSubmit={handleSendInquiry}>
            <p className="muted">
              You are sending a rental application for <strong>{inquiryRoom.title}</strong> (
              {formatMoney(inquiryRoom.price)}/mo). If selected, you will have 24 hours to accept the offer before it expires.
            </p>

            <Field label="Your message to the landlord" required>
              <textarea
                rows={4}
                value={inquiryMessage}
                onChange={(e) => setInquiryMessage(e.target.value)}
                placeholder="Include your expected move-in date and questions…"
                required
              />
            </Field>
            <div className="form-grid"><Field label="Preferred move-in date"><input type="date" value={inquiryStartDate} onChange={(e) => setInquiryStartDate(e.target.value)} min={getTodayDateString()} /></Field><Field label="Preferred move-out date"><input type="date" value={inquiryEndDate} onChange={(e) => setInquiryEndDate(e.target.value)} min={inquiryStartDate || getTodayDateString()} /></Field></div>

            <div className="form-actions">
              <button type="submit" className="button primary" disabled={isSaving}>
                {isSaving ? 'Submitting…' : 'Submit Request'}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => setInquiryRoom(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

