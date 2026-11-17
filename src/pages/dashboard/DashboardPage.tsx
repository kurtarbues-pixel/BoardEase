import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, fetchAll } from '../../api/client';
import {
  AdminDashboardData,
  LandlordDashboardData,
  Room,
  Lease,
  Invoice,
  Inquiry,
} from '../../types';
import { LoadingState, ErrorState } from '../../components/Common/States';
import { AdminDashboard } from './AdminDashboard';
import { LandlordDashboard } from './LandlordDashboard';
import { TenantDashboard } from './TenantDashboard';

interface DashboardPageProps {
  onNavigate: (pageId: string) => void;
  onContactLandlord: (leaseId: number) => void;
  announce?: (message: string, kind?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, onContactLandlord, announce }) => {
  const { user } = useAuth();

  const isAdmin = user?.role === 'admin';
  const isTenant = user?.role === 'tenant';
  const isLandlordOrStaff = user?.role === 'landlord' || user?.role === 'staff';

  // State containers
  const [adminData, setAdminData] = useState<AdminDashboardData | null>(null);
  const [landlordData, setLandlordData] = useState<LandlordDashboardData | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingInquiryId, setProcessingInquiryId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isAdmin) {
        // Fetch Admin-specific dashboard statistics & audit overview
        const data = await api<AdminDashboardData>('/admin/dashboard');
        setAdminData(data);
      } else if (isTenant) {
        // Fetch Tenant-specific room browsing, leases, inquiries & financial statements
        const [allRooms, userLeases, userInvoices, userInquiries] = await Promise.all([
          fetchAll<Room>('/rooms?per_page=50'),
          fetchAll<Lease>('/leases'),
          fetchAll<Invoice>('/invoices'),
          fetchAll<Inquiry>('/inquiries'),
        ]);
        setRooms(allRooms);
        setLeases(userLeases);
        setInvoices(userInvoices);
        setInquiries(userInquiries);
      } else {
        // Landlord or Staff: Fetch operational summary, owned rooms, leases, and pending inquiries
        const [dashMetrics, allRooms, allInquiries, allLeases, allInvoices] = await Promise.all([
          api<LandlordDashboardData>('/landlord/dashboard'),
          fetchAll<Room>('/rooms?per_page=50'),
          fetchAll<Inquiry>('/inquiries'),
          fetchAll<Lease>('/leases'),
          fetchAll<Invoice>('/invoices'),
        ]);
        setLandlordData(dashMetrics);
        setRooms(allRooms);
        setInquiries(allInquiries);
        setLeases(allLeases);
        setInvoices(allInvoices);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isTenant, isLandlordOrStaff]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Landlord action: Offer room to applicant (24-hour hold safeguard)
  const handleApproveInquiry = async (inquiry: Inquiry) => {
    if (!window.confirm(`Offer Room ${inquiry.room?.room_number} to ${inquiry.tenant?.name || 'tenant'}? They will have 24 hours to confirm reservation.`)) {
      return;
    }

    setProcessingInquiryId(inquiry.id);
    try {
      await api(`/inquiries/${inquiry.id}/approve`, { method: 'POST' });
      announce?.(`24-hour room offer sent to ${inquiry.tenant?.name || 'applicant'}. Room held temporarily.`, 'success');
      await loadData();
    } catch (err: any) {
      announce?.(err.message || 'Action could not be completed.', 'error');
    } finally {
      setProcessingInquiryId(null);
    }
  };

  // Landlord action: Reject inquiry
  const handleRejectInquiry = async (inquiry: Inquiry) => {
    if (!window.confirm(`Decline inquiry for Room ${inquiry.room?.room_number} from ${inquiry.tenant?.name || 'applicant'}?`)) {
      return;
    }

    setProcessingInquiryId(inquiry.id);
    try {
      await api(`/inquiries/${inquiry.id}/reject`, { method: 'POST' });
      announce?.('Inquiry declined.', 'info');
      await loadData();
    } catch (err: any) {
      announce?.(err.message || 'Action could not be completed.', 'error');
    } finally {
      setProcessingInquiryId(null);
    }
  };

  // Landlord action: Toggle room availability
  const handleToggleRoomAvailability = async (room: Room) => {
    const nextStatus = room.status === 'available' ? 'maintenance' : 'available';
    try {
      await api(`/rooms/${room.id}/availability`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      announce?.(`Room ${room.room_number} status updated to ${nextStatus}.`, 'success');
      await loadData();
    } catch (err: any) {
      announce?.(err.message || 'Failed to update room availability.', 'error');
    }
  };

  if (loading) return <LoadingState message="Connecting to BoardEase services and loading your dashboard…" />;
  if (error) return <ErrorState error={error} retry={loadData} />;

  /* =======================================
     1. Admin Dashboard (Sunny Admin style)
     ======================================= */
  if (isAdmin && adminData) {
    return (
      <AdminDashboard
        data={adminData}
        onNavigate={onNavigate}
        onRefresh={loadData}
      />
    );
  }

  /* =======================================
     2. Tenant Dashboard (PropertyPro style)
     ======================================= */
  if (isTenant) {
    return (
      <TenantDashboard
        rooms={rooms}
        leases={leases}
        invoices={invoices}
        inquiries={inquiries}
        onNavigate={onNavigate}
        onContactLandlord={onContactLandlord}
        onRefresh={loadData}
        announce={announce}
      />
    );
  }

  /* =======================================
     3. Landlord / Staff Dashboard (Rumaya style)
     ======================================= */
  if (landlordData) {
    return (
      <LandlordDashboard
        data={landlordData}
        rooms={rooms}
        inquiries={inquiries}
        leases={leases}
        invoices={invoices}
        onNavigate={onNavigate}
        onRefresh={loadData}
        onApproveInquiry={handleApproveInquiry}
        onRejectInquiry={handleRejectInquiry}
        onToggleRoomAvailability={handleToggleRoomAvailability}
        processingInquiryId={processingInquiryId}
      />
    );
  }

  return null;
};
