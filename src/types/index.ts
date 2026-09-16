export type UserRole = 'ADMIN' | 'SUPER_ADMIN';

export type ItemCategory = string;
export type ItemType = 'TOOL' | 'CONSUMABLE';
export type ProjectStatus = 'AKTIF' | 'SELESAI' | 'ARSIP';
export type StockStatus = 'DIKETAHUI' | 'BELUM_DIKETAHUI';

export type ReturnStatus = 'KEMBALI_BAIK' | 'BELUM_KEMBALI' | 'RUSAK' | 'HILANG' | 'HABIS_DIPAKAI' | 'SEBAGIAN_KEMBALI';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Technician {
  id: string;
  technician_code: string;
  name: string;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface TechnicianWithItemCount extends Technician {
  item_count: number;
}

export interface Project {
  id: string;
  project_code: string;
  project_name: string;
  location: string | null;
  status: ProjectStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Item {
  id: string;
  item_code: string | null;
  item_name: string;
  category: string | null;
  item_type: ItemType;
  unit: string | null;
  current_stock: number | null;
  stock_known: boolean;
  storage_location: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface TechnicianDefaultItem {
  id: string;
  technician_id: string;
  item_id: string;
  default_qty: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TechnicianDefaultItemWithItem extends TechnicianDefaultItem {
  items: Item;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
}

// Transaction types
export type TransactionStatus = 'DRAFT' | 'SEDANG_DIPINJAM' | 'PENGEMBALIAN_BELUM_LENGKAP' | 'SELESAI' | 'BERMASALAH' | 'DIBATALKAN';

export interface Transaction {
  id: string;
  transaction_number: string;
  technician_id: string;
  project_id: string | null;
  manual_project_name: string | null;
  transaction_date: string;
  location: string | null;
  borrowed_at: string | null;
  returned_at: string | null;
  status: TransactionStatus;
  has_damage: boolean;
  has_loss: boolean;
  return_processed_at: string | null;
  return_processed_by: string | null;
  sop_generated_at: string | null;
  sop_generated_by: string | null;
  sop_template_version: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionWithRelations extends Transaction {
  technicians: Technician;
  projects: Project | null;
  item_count?: number;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  item_id: string | null;
  item_name_snapshot: string;
  unit_snapshot: string | null;
  item_type_snapshot: ItemType;
  is_default_item: boolean;
  is_manual_item: boolean;
  borrow_qty: number;
  returned_qty: number | null;
  used_qty: number | null;
  damaged_qty: number | null;
  lost_qty: number | null;
  return_status: ReturnStatus;
  expected_return_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface StockMovement {
  id: string;
  item_id: string | null;
  transaction_id: string | null;
  technician_id: string | null;
  movement_type: string;
  quantity: number;
  stock_before: number | null;
  stock_after: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Attachment {
  id: string;
  transaction_id: string | null;
  transaction_item_id: string | null;
  attachment_type: string;
  file_path: string;
  file_name: string;
  uploaded_by: string | null;
  created_at: string;
}

// Dashboard stats
export interface DashboardStats {
  totalTechnicians: number;
  totalItems: number;
  unknownStockItems: number;
  activeProjects: number;
}

// Part 2: Transaction form types
export interface TransactionItemForm {
  id: string; // client-side unique id
  item_id: string | null;
  item_name: string;
  unit: string | null;
  item_type: ItemType;
  is_default_item: boolean;
  is_manual_item: boolean;
  borrow_qty: number;
  notes: string;
  stock_known: boolean;
  current_stock: number | null;
  save_to_master: boolean;
  category: string | null;
}

export interface TransactionForm {
  technician_id: string;
  project_id: string | null;
  manual_project_name: string;
  location: string;
  transaction_date: string;
  notes: string;
  items: TransactionItemForm[];
}

// Part 3: Return event types
export interface ReturnEvent {
  id: string;
  transaction_id: string;
  processed_by: string | null;
  processed_at: string;
  notes: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
}

export interface ReturnEventItem {
  id: string;
  return_event_id: string;
  transaction_item_id: string;
  returned_qty: number;
  used_qty: number;
  damaged_qty: number;
  lost_qty: number;
  notes: string | null;
  created_at: string;
}

export interface ReturnEventWithRelations extends ReturnEvent {
  profiles: { full_name: string } | null;
  return_event_items: (ReturnEventItem & {
    transaction_items: { item_name_snapshot: string; unit_snapshot: string | null };
  })[];
}

// Part 3: Return form types
export interface ReturnItemForm {
  id: string; // transaction_item id
  item_name: string;
  unit: string | null;
  item_type: ItemType;
  is_default_item: boolean;
  is_manual_item: boolean;
  stock_known: boolean;
  item_id: string | null;
  borrow_qty: number;
  returned_qty: number;
  used_qty: number;
  damaged_qty: number;
  lost_qty: number;
  return_status: ReturnStatus;
  notes: string;
  damage_notes: string;
  damage_attachment: File | null;
}
