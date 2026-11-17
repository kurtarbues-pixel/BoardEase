import { User, ActivityLog, Room, Lease, Invoice, Inquiry } from './index';

export interface LandlordDashboardData {
  occupancy: {
    occupied: number;
    total: number;
    percent: number;
  };
  available_rooms: number;
  reserved_rooms?: number;
  maintenance_rooms?: number;
  active_leases: number;
  tenant_count: number;
  pending_inquiries: number;
  open_offers?: number;
  monthly_revenue: number | string;
  overdue_invoices_count?: number;
  overdue_amount?: number | string;
}

export interface AdminWeeklyActivity {
  date: string;
  day: string;
  inquiries: number;
  payments: number;
  users: number;
}

export interface AdminDashboardData {
  users: {
    total: number;
    tenants: number;
    landlords: number;
    staff: number;
    admins: number;
  };
  rooms: {
    total: number;
    occupied: number;
    available: number;
    reserved: number;
    maintenance: number;
    occupancy_percent: number;
    avg_price: string | number;
    min_price: string | number;
    max_price: string | number;
    by_type: Record<string, number>;
  };
  finance: {
    monthly_billed: string | number;
    monthly_collected: string | number;
    overdue_count: number;
    overdue_amount: string | number;
  };
  operations: {
    active_leases: number;
    pending_inquiries: number;
    open_offers: number;
  };
  weekly_activity: AdminWeeklyActivity[];
  recent_users: User[];
  recent_activities: ActivityLog[];
}

export interface TenantDashboardData {
  rooms: Room[];
  leases: Lease[];
  invoices: Invoice[];
  inquiries: Inquiry[];
}
