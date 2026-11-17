export interface AppNotification {
  id: number;
  user_id?: number;
  type?: string | null;
  title: string;
  body: string;
  data?: Record<string, any> | null;
  read_at: string | null;
  created_at: string;
  updated_at?: string;
}
