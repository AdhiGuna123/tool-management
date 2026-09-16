'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Card from '@/components/ui/card';
import Badge from '@/components/ui/badge';
import Button from '@/components/ui/button';
import Select from '@/components/ui/select';
import Input from '@/components/ui/input';
import Loading from '@/components/ui/loading';
import {
  BookOpen,
  Filter,
  ChevronLeft,
  ChevronRight,
  User,
  Calendar,
  Search,
  Shield,
  AlertTriangle,
} from 'lucide-react';

interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  reason: string | null;
  ip_address: string | null;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

const actionLabels: Record<string, string> = {
  TRANSACTION_CREATED: 'Transaksi Dibuat',
  TRANSACTION_COMPLETED: 'Transaksi Selesai',
  TRANSACTION_CANCELLED: 'Transaksi Dibatalkan',
  TRANSACTION_BORROWED: 'Barang Dipinjam',
  TRANSACTION_RETURNED: 'Barang Dikembalikan',
  RETURN_PROCESSED: 'Pengembalian Diproses',
  STOCK_DEDUCTED: 'Stok Dikurangi',
  STOCK_RETURNED: 'Stok Dikembalikan',
  STOCK_ADJUSTMENT: 'Penyesuaian Stok',
  STOCK_OPNAME: 'Stock Opname',
  MANUAL_ITEM_TO_MASTER: 'Barang Manual → Master',
  ITEM_CREATED: 'Barang Dibuat',
  ITEM_UPDATED: 'Barang Diubah',
  TECHNICIAN_CREATED: 'Teknisi Dibuat',
  TECHNICIAN_UPDATED: 'Teknisi Diubah',
  PROJECT_CREATED: 'Proyek Dibuat',
  PROJECT_UPDATED: 'Proyek Diubah',
  DEFAULT_ITEM_ADDED: 'Alat Bawaan Ditambah',
  DEFAULT_ITEM_REMOVED: 'Alat Bawaan Dihapus',
  DEFAULT_ITEM_UPDATED: 'Alat Bawaan Diubah',
  TTD_UPLOADED: 'TTD Diupload',
  DAMAGE_PHOTO_UPLOADED: 'Foto Kerusakan Diupload',
};

const actionColors: Record<string, string> = {
  TRANSACTION_CREATED: 'text-blue-600',
  TRANSACTION_COMPLETED: 'text-green-600',
  TRANSACTION_CANCELLED: 'text-red-600',
  TRANSACTION_BORROWED: 'text-amber-600',
  TRANSACTION_RETURNED: 'text-green-600',
  RETURN_PROCESSED: 'text-green-600',
  STOCK_DEDUCTED: 'text-amber-600',
  STOCK_RETURNED: 'text-green-600',
  STOCK_ADJUSTMENT: 'text-purple-600',
  STOCK_OPNAME: 'text-purple-600',
  MANUAL_ITEM_TO_MASTER: 'text-indigo-600',
  ITEM_CREATED: 'text-green-600',
  ITEM_UPDATED: 'text-amber-600',
  TECHNICIAN_CREATED: 'text-green-600',
  TECHNICIAN_UPDATED: 'text-amber-600',
  PROJECT_CREATED: 'text-green-600',
  PROJECT_UPDATED: 'text-amber-600',
  DEFAULT_ITEM_ADDED: 'text-blue-600',
  DEFAULT_ITEM_REMOVED: 'text-red-600',
  DEFAULT_ITEM_UPDATED: 'text-amber-600',
  TTD_UPLOADED: 'text-gray-600',
  DAMAGE_PHOTO_UPLOADED: 'text-red-600',
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [users, setUsers] = useState<{ id: string; full_name: string; email: string }[]>([]);

  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    user_id: '',
    action: '',
    entity_type: '',
    search: '',
  });

  const supabase = createClient();

  const loadUsers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name');
    setUsers(data || []);
  }, [supabase]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('audit_logs')
      .select('*, profiles(full_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filters.dateFrom) {
      query = query.gte('created_at', filters.dateFrom);
    }
    if (filters.dateTo) {
      const endDate = new Date(filters.dateTo);
      endDate.setDate(endDate.getDate() + 1);
      query = query.lt('created_at', endDate.toISOString());
    }
    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id);
    }
    if (filters.action) {
      query = query.eq('action', filters.action);
    }
    if (filters.entity_type) {
      query = query.eq('entity_type', filters.entity_type);
    }

    const limit = 30;
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, count } = await query;
    setTotal(count || 0);
    setTotalPages(Math.ceil((count || 0) / limit));

    let filteredData = (data || []) as AuditLogEntry[];
    if (filters.search) {
      const s = filters.search.toLowerCase();
      filteredData = filteredData.filter((log) =>
        log.profiles?.full_name?.toLowerCase().includes(s) ||
        log.profiles?.email?.toLowerCase().includes(s) ||
        log.action?.toLowerCase().includes(s) ||
        log.entity_type?.toLowerCase().includes(s) ||
        log.reason?.toLowerCase().includes(s)
      );
    }

    setLogs(filteredData);
    setLoading(false);
  }, [supabase, filters, page]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      user_id: '',
      action: '',
      entity_type: '',
      search: '',
    });
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  const formatJson = (data: Record<string, unknown> | null): string => {
    if (!data) return '-';
    return Object.entries(data)
      .map(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          return `${key}: ${JSON.stringify(value)}`;
        }
        return `${key}: ${value}`;
      })
      .join(', ');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Log Aktivitas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} aktivitas tercatat
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filter
          {hasActiveFilters && (
            <span className="ml-1 w-2 h-2 bg-blue-500 rounded-full" />
          )}
        </Button>
      </div>

      {showFilters && (
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="Dari Tanggal"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
            <Input
              label="Sampai Tanggal"
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
            <Select
              label="User"
              value={filters.user_id}
              onChange={(e) => handleFilterChange('user_id', e.target.value)}
              options={[
                { value: '', label: 'Semua User' },
                ...users.map((u) => ({ value: u.id, label: u.full_name || u.email })),
              ]}
            />
            <Select
              label="Tipe Aktivitas"
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              options={[
                { value: '', label: 'Semua Aktivitas' },
                ...Object.entries(actionLabels).map(([value, label]) => ({ value, label })),
              ]}
            />
            <Select
              label="Tipe Entitas"
              value={filters.entity_type}
              onChange={(e) => handleFilterChange('entity_type', e.target.value)}
              options={[
                { value: '', label: 'Semua Entitas' },
                { value: 'transaction', label: 'Transaksi' },
                { value: 'item', label: 'Barang' },
                { value: 'technician', label: 'Teknisi' },
                { value: 'project', label: 'Proyek' },
                { value: 'attachment', label: 'Lampiran' },
                { value: 'return_event', label: 'Pengembalian' },
              ]}
            />
            <Input
              label="Cari"
              placeholder="Cari di data..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>
          {hasActiveFilters && (
            <div className="mt-4 pt-4 border-t">
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Hapus Semua Filter
              </Button>
            </div>
          )}
        </Card>
      )}

      {loading ? (
        <Loading />
      ) : logs.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12">
            <BookOpen className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-gray-500">Tidak ada log aktivitas ditemukan.</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {logs.map((log) => (
              <Card key={log.id} className="py-3">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${actionColors[log.action] || 'text-gray-600'}`}>
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900">
                        {actionLabels[log.action] || log.action}
                      </span>
                      <Badge variant="info" className="text-xs">
                        {log.entity_type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {log.profiles?.full_name || log.profiles?.email || 'System'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(log.created_at).toLocaleString('id-ID')}
                      </span>
                    </div>
                    {log.reason && (
                      <p className="text-xs text-gray-600 mt-1">
                        Alasan: {log.reason}
                      </p>
                    )}
                    {log.old_data && Object.keys(log.old_data).length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        <span className="font-medium">Lama:</span> {formatJson(log.old_data)}
                      </p>
                    )}
                    {log.new_data && Object.keys(log.new_data).length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        <span className="font-medium">Baru:</span> {formatJson(log.new_data)}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Halaman {page} dari {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
