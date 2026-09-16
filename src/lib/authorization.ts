import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/types';

export type Permission = 
  | 'manage_technicians'
  | 'manage_items'
  | 'manage_projects'
  | 'manage_users'
  | 'view_audit_logs'
  | 'adjust_stock'
  | 'create_transactions'
  | 'process_returns'
  | 'view_stock'
  | 'input_manual_items'
  | 'upload_attachments'
  | 'print_reports'
  | 'correct_transactions';

const rolePermissions: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    'manage_technicians',
    'manage_items',
    'manage_projects',
    'manage_users',
    'view_audit_logs',
    'adjust_stock',
    'create_transactions',
    'process_returns',
    'view_stock',
    'input_manual_items',
    'upload_attachments',
    'print_reports',
    'correct_transactions',
  ],
  ADMIN: [
    'create_transactions',
    'process_returns',
    'view_stock',
    'input_manual_items',
    'upload_attachments',
    'print_reports',
  ],
};

export async function getUserProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile;
}

export async function checkPermission(permission: Permission): Promise<boolean> {
  const profile = await getUserProfile();
  if (!profile || !profile.active) return false;
  
  const permissions = rolePermissions[profile.role as UserRole] || [];
  return permissions.includes(permission);
}

export async function requirePermission(permission: Permission) {
  const hasPermission = await checkPermission(permission);
  if (!hasPermission) {
    throw new Error('Anda tidak memiliki akses untuk melakukan operasi ini.');
  }
}

export async function getRolePermissions(role: UserRole): Promise<Permission[]> {
  return rolePermissions[role] || [];
}
