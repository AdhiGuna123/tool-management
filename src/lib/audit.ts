import { createClient } from '@/lib/supabase/server';

export type AuditAction = 
  | 'CREATE_TECHNICIAN'
  | 'EDIT_TECHNICIAN'
  | 'DEACTIVATE_TECHNICIAN'
  | 'CREATE_ITEM'
  | 'EDIT_ITEM'
  | 'DEACTIVATE_ITEM'
  | 'CREATE_PROJECT'
  | 'EDIT_PROJECT'
  | 'ARCHIVE_PROJECT'
  | 'ADD_DEFAULT_TOOL'
  | 'EDIT_DEFAULT_TOOL'
  | 'REMOVE_DEFAULT_TOOL'
  | 'CREATE_TRANSACTION'
  | 'CANCEL_TRANSACTION'
  | 'UPLOAD_TTD'
  | 'MANUAL_ITEM_ADDED'
  | 'MASTER_ITEM_CREATED_FROM_TRANSACTION'
  | 'RETURN_PROCESSED'
  | 'PARTIAL_RETURN'
  | 'ITEM_MARKED_DAMAGED'
  | 'ITEM_MARKED_LOST'
  | 'OUTSTANDING_ITEM_RESOLVED'
  | 'RETURN_ATTACHMENT_UPLOADED'
  | 'TRANSACTION_COMPLETED'
  | 'STOCK_ADJUSTMENT'
  | 'MANUAL_ITEM_TO_MASTER';

export type EntityType = 'technician' | 'item' | 'project' | 'default_tool' | 'transaction' | 'attachment' | 'return_event';

interface AuditLogParams {
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  reason?: string;
}

export async function logAuditEvent({
  action,
  entityType,
  entityId,
  oldData = null,
  newData = null,
  reason,
}: AuditLogParams) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from('audit_logs').insert({
    user_id: user?.id || null,
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_data: oldData,
    new_data: newData,
    reason: reason || null,
  });

  if (error) {
    console.error('Failed to log audit event:', error);
  }
}
