import { Lease } from './lease';

export type ChargeCategory = 'CANTEEN' | 'APPLIANCE' | 'OTHER';
export type ChargeStatus = 'pending' | 'billed' | 'invoiced' | 'void' | 'voided';
export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';
export type PaymentTransactionStatus = 'succeeded' | 'failed';

export interface Charge {
  id: number;
  lease_id: number;
  category: ChargeCategory;
  description?: string | null;
  amount: number | string;
  status: ChargeStatus;
  invoice_id?: number | null;
  billing_period?: string | null;
  utility_type?: 'electricity' | 'water' | 'wifi' | null;
  created_at?: string;
  updated_at?: string;
  lease?: Lease;
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  description: string;
  category: string;
  amount: number | string;
}

export interface SimulatedPaymentResponse {
  payment: PaymentRecord;
  invoice: Invoice;
  idempotent: boolean;
}

export interface PaymentRecord {
  id: number;
  invoice_id: number;
  amount: number | string;
  method: string;
  reference_number?: string | null;
  transaction_status?: PaymentTransactionStatus;
  failure_reason?: string | null;
  notes?: string | null;
  recorded_by?: number;
  paid_at?: string | null;
  created_at?: string;
}

export interface Invoice {
  id: number;
  invoice_number?: string;
  lease_id: number;
  billing_period: string;
  base_rent: number | string;
  additional_charges_total: number | string;
  total_amount_due: number | string;
  amount_paid: number | string;
  balance: number | string;
  due_date: string;
  status: InvoiceStatus;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  lease?: Lease;
  items?: InvoiceItem[];
  charges?: Charge[];
  payments?: PaymentRecord[];
}

export interface ChargeFormData {
  lease_id: number;
  category: ChargeCategory;
  description: string;
  amount: number;
  billing_period?: string;
  utility_type?: 'electricity' | 'water' | 'wifi' | null;
}

export interface PaymentFormData {
  amount: number;
  method: string;
  notes?: string;
}

