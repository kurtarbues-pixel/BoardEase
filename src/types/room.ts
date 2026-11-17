export type RoomStatus = 'available' | 'reserved' | 'occupied' | 'maintenance';

export interface RoomImage {
  id: number;
  room_id: number;
  url: string;
  is_primary?: boolean;
}

export interface Room {
  id: number;
  room_number: string;
  title: string;
  type?: string | null;
  capacity?: number | null;
  description?: string | null;
  location: string;
  price: number | string;
  status: RoomStatus;
  is_reserved?: boolean;
  average_rating?: number | string;
  review_count?: number;
  amenities: string[];
  images?: RoomImage[];
  landlord_id?: number | null;
  landlord?: {
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  created_at?: string;
  updated_at?: string;
}

export interface RoomFormData {
  room_number: string;
  title: string;
  type?: string | null;
  capacity?: number | null;
  description?: string | null;
  location: string;
  price: number;
  status: RoomStatus;
  amenities: string[];
}

