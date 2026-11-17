import { Room } from './room';
import { User } from './auth';
import { Charge } from './billing';

export type LeaseStatus = 'active' | 'ended' | 'terminated';

export interface Lease {
  id: number;
  room_id: number;
  tenant_id: number;
  monthly_rent: number | string;
  outstanding_balance?: number | string;
  start_date: string;
  end_date?: string | null;
  status: LeaseStatus;
  agreement_status?: 'legacy' | 'pending' | 'accepted';
  agreement_accepted_at?: string | null;
  agreement_snapshot?: Record<string, string | null>;
  inspections?: LeaseInspection[];
  created_at?: string;
  updated_at?: string;
  tenant?: User;
  landlord?: User;
  room?: Room;
  charges?: Charge[];
}

export interface LeaseInspection {
  id: number;
  kind: 'move_in' | 'move_out';
  inspection_date: string;
  condition: string;
  notes?: string | null;
  damages_amount: number | string;
  damage_description?: string | null;
  status: 'pending' | 'completed';
  completed_at?: string | null;
}

export interface LeaseFormData {
  room_id: number;
  tenant_id: number;
  start_date: string;
  end_date?: string | null;
  monthly_rent?: number | null;
}

export interface UpdateLeaseFormData {
  start_date?: string;
  end_date?: string | null;
  monthly_rent?: number | null;
}

