import { Room } from './room';
import { User } from './auth';

export type InquiryStatus = 'pending' | 'approved' | 'rejected' | 'converted';

export interface Inquiry {
  id: number;
  room_id: number;
  tenant_id: number;
  message?: string | null;
  desired_start_date?: string | null;
  desired_end_date?: string | null;
  status: InquiryStatus;
  created_at?: string;
  updated_at?: string;
  offer_expires_at?: string | null;
  decision_reason?: string | null;
  room?: Room;
  tenant?: User;
}

