'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Card from '@/components/ui/card';
import Badge from '@/components/ui/badge';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import Loading from '@/components/ui/loading';
import {
  Search,
  Filter,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertTriangle,
  Wrench,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import type {} from '@/types';

const statusColors: Record<string, 'info' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'info',
  SEDANG_DIPINJAM: 'warning',
  PENGEMBALIAN_BELUM_LENGKAP: 'danger',
  SELESAI: 'success',
  BERMASALAH: 'danger',
  DIBATALKAN: 'danger',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Draf',
  SEDANG_DIPINJAM: 'Sedang Dipinjam',
  PENGEMBALIAN_BELUM_LENGKAP: 'Belum Lengkap',
  SELESAI: 'Selesai',
  BERMASALAH: 'Bermasalah',
  DIBATALKAN: 'Dibatalkan',
};

const statusIcons: Record<string, typeof Clock> = {
  DRAFT: Clock,
  SEDANG_DIPINJAM: Clock,
  PENGEMBALIAN_BELUM_LENGKAP: AlertTriangle,
  SELESAI: CheckCircle,
  BERMASALAH: XCircle,
  DIBATALKAN: XCircle,
};

interface Transaction {
  id: string;
  transaction_number: string;
  transaction_date: string;
  status: string;
  has_damage: boolean;
  has_loss: boolean;
  location?: string;
  technicians?: { name: string; technician_code: string };
  projects?: { project_name: string };
  transaction_items?: { item_name_snapshot: string; is_manual_item: boolean }[];
}

interface FilterTechnician {
  id: string;
  name: string;
  technician_code: string;
}

interface FilterProject {
  id: string;
  project_name: string;
  project_code: string;
}

export default function TransaksiPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [technicians, setTechnicians] = useState<FilterTechnician[]>([]);
  const [projects, setProjects] = useState<FilterProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
    technician_id: '',
    project_id: '',
    status: '',
    issue: '',
  });

  const supabase = createClient();

  const loadFilters = useCallback(async () => {
    const [techResult, projResult] = await Promise.all([
      supabase.from('technicians').select('id, name, technician_code').eq('active', true).order('name'),
      supabase.from('projects').select('id, project_name, project_code').order('project_name'),
    ]);
    setTechnicians(techResult.data || []);
    setProjects(projResult.data || []);
  }, [supabase]);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('transactions')
      .select(`
        *,
        technicians(name, technician_code),
        projects(project_name),
        transaction_items(item_name_snapshot, is_manual_item)
      `, { count: 'exact' })
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters.dateFrom) query = query.gte('transaction_date', filters.dateFrom);
    if (filters.dateTo) query = query.lte('transaction_date', filters.dateTo);
    if (filters.technician_id) query = query.eq('technician_id', filters.technician_id);
    if (filters.project_id) query = query.eq('project_id', filters.project_id);
    if (filters.status) query = query.eq('status', filters.status);

    const limit = 15;
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, count } = await query;
    setTotal(count || 0);
    setTotalPages(Math.ceil((count || 0) / limit));

    let filteredData = (data || []) as Transaction[];
    if (filters.search) {
      const s = filters.search.toLowerCase();
      filteredData = filteredData.filter((tx) =>
        tx.transaction_number?.toLowerCase().includes(s) ||
        (tx as unknown as { technicians?: { name: string } }).technicians?.name?.toLowerCase().includes(s) ||
        (tx as unknown as { projects?: { project_name: string } }).projects?.project_name?.toLowerCase().includes(s)
      );
    }
    if (filters.issue) {
      filteredData = filteredData.filter((tx) => {
        if (filters.issue === 'has_damage') return tx.has_damage;
        if (filters.issue === 'has_loss') return tx.has_loss;
        if (filters.issue === 'has_outstanding') return tx.status === 'PENGEMBALIAN_BELUM_LENGKAP';
        if (filters.issue === 'has_manual') return (tx as unknown as { transaction_items?: { is_manual_item: boolean }[] }).transaction_items?.some((item: { is_manual_item: boolean }) => item.is_manual_item);
        if (filters.issue === 'no_issue') return !tx.has_damage && !tx.has_loss && tx.status === 'SELESAI';
        return true;
      });
    }

    setTransactions(filteredData);
    setLoading(false);
  }, [supabase, filters, page]);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      dateFrom: '',
      dateTo: '',
      technician_id: '',
      project_id: '',
      status: '',
      issue: '',
    });
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Riwayat Transaksi</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} transaksi ditemukan
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

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Cari nomor transaksi, teknisi, proyek..."
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Filters Panel */}
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
              label="Teknisi"
              value={filters.technician_id}
              onChange={(e) => handleFilterChange('technician_id', e.target.value)}
              options={[
                { value: '', label: 'Semua Teknisi' },
                ...technicians.map((t) => ({ value: t.id, label: `${t.name} (${t.technician_code})` })),
              ]}
            />
            <Select
              label="Proyek"
              value={filters.project_id}
              onChange={(e) => handleFilterChange('project_id', e.target.value)}
              options={[
                { value: '', label: 'Semua Proyek' },
                ...projects.map((p) => ({ value: p.id, label: p.project_name })),
              ]}
            />
            <Select
              label="Status"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              options={[
                { value: '', label: 'Semua Status' },
                { value: 'SEDANG_DIPINJAM', label: 'Sedang Dipinjam' },
                { value: 'PENGEMBALIAN_BELUM_LENGKAP', label: 'Belum Lengkap' },
                { value: 'SELESAI', label: 'Selesai' },
                { value: 'BERMASALAH', label: 'Bermasalah' },
                { value: 'DIBATALKAN', label: 'Dibatalkan' },
              ]}
            />
            <Select
              label="Masalah"
              value={filters.issue}
              onChange={(e) => handleFilterChange('issue', e.target.value)}
              options={[
                { value: '', label: 'Semua' },
                { value: 'has_damage', label: 'Ada Kerusakan' },
                { value: 'has_loss', label: 'Ada Kehilangan' },
                { value: 'has_outstanding', label: 'Belum Lengkap' },
                { value: 'has_manual', label: 'Ada Barang Manual' },
                { value: 'no_issue', label: 'Tanpa Masalah' },
              ]}
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

      {/* Transaction List */}
      {loading ? (
        <Loading />
      ) : transactions.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-gray-500">Tidak ada transaksi ditemukan.</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {transactions.map((tx) => {
              const StatusIcon = statusIcons[tx.status] || Clock;
              return (
                <Link key={tx.id} href={`/pengambilan/${tx.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <StatusIcon className={`w-5 h-5 ${
                          tx.status === 'SELESAI' ? 'text-green-600' :
                          tx.status === 'PENGEMBALIAN_BELUM_LENGKAP' || tx.status === 'BERMASALAH' ? 'text-red-600' :
                          'text-amber-600'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 text-sm">
                            {tx.transaction_number}
                          </p>
                          <Badge variant={statusColors[tx.status] || 'info'} className="text-xs">
                            {statusLabels[tx.status] || tx.status}
                          </Badge>
                          {tx.has_damage && (
                            <Badge variant="danger" className="text-xs">
                              <Wrench className="w-3 h-3 mr-1" />
                              Rusak
                            </Badge>
                          )}
                          {tx.has_loss && (
                            <Badge variant="danger" className="text-xs">
                              Hilang
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1 truncate">
                          {(tx as unknown as { technicians?: { name: string } }).technicians?.name}
                          {(tx as unknown as { projects?: { project_name: string } }).projects?.project_name && (
                            <> - {(tx as unknown as { projects?: { project_name: string } }).projects?.project_name}</>
                          )}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>{tx.transaction_date}</span>
                          {tx.location && <span>📍 {tx.location}</span>}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
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
