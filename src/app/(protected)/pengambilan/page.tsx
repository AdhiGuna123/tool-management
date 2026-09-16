'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Card from '@/components/ui/card';
import Badge from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import Loading from '@/components/ui/loading';
import { ArrowDownToLine, Plus, Search, Eye, XCircle, Calendar } from 'lucide-react';
import type { TransactionWithRelations } from '@/types';

export default function PengambilanPage() {
  const [transactions, setTransactions] = useState<TransactionWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const supabase = createClient();

  useEffect(() => {
    loadTransactions();
  }, [selectedDate]);

  async function loadTransactions() {
    setLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*, technicians(name, technician_code), projects(project_name, project_code)')
      .eq('transaction_date', selectedDate)
      .order('created_at', { ascending: false });

    if (data) {
      setTransactions(data as TransactionWithRelations[]);
    }
    setLoading(false);
  }

  const filteredTransactions = transactions.filter(
    (t) =>
      t.transaction_number.toLowerCase().includes(search.toLowerCase()) ||
      t.technicians?.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.projects?.project_name && t.projects.project_name.toLowerCase().includes(search.toLowerCase())) ||
      (t.manual_project_name && t.manual_project_name.toLowerCase().includes(search.toLowerCase()))
  );

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'SEDANG_DIPINJAM':
        return 'info';
      case 'SELESAI':
        return 'success';
      case 'DIBATALKAN':
        return 'danger';
      case 'BERMASALAH':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'SEDANG_DIPINJAM':
        return 'SEDANG DIPINJAM';
      case 'SELESAI':
        return 'SELESAI';
      case 'DIBATALKAN':
        return 'DIBATALKAN';
      case 'BERMASALAH':
        return 'BERMASALAH';
      default:
        return status;
    }
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pengambilan Alat</h1>
          <p className="text-sm text-gray-500 mt-1">
            Pengambilan alat pagi oleh teknisi
          </p>
        </div>
        <Link href="/pengambilan/baru">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Pengambilan Baru
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full sm:w-40"
          />
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Cari transaksi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {filteredTransactions.length === 0 ? (
        <Card>
          <EmptyState
            title="BELUM ADA PENGAMBILAN HARI INI"
            description="Buat pengambilan alat baru untuk teknisi."
            icon={<ArrowDownToLine className="w-12 h-12" />}
            action={
              <Link href="/pengambilan/baru">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Pengambilan Baru
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <Card padding={false} className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      No. Transaksi
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Teknisi
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Proyek
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Item
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Waktu
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono text-gray-900 font-medium">
                        {tx.transaction_number}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{tx.technicians?.name}</p>
                        <p className="text-xs text-gray-500">{tx.technicians?.technician_code}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {tx.projects?.project_name || tx.manual_project_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {tx.item_count || '-'} Item
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={getStatusVariant(tx.status)}>
                          {getStatusLabel(tx.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {tx.borrowed_at ? new Date(tx.borrowed_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/pengambilan/${tx.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredTransactions.map((tx) => (
              <Card key={tx.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-sm font-medium text-gray-900">{tx.transaction_number}</p>
                    <p className="text-sm text-gray-600 mt-1">{tx.technicians?.name}</p>
                    <p className="text-xs text-gray-500">
                      {tx.projects?.project_name || tx.manual_project_name || '-'}
                    </p>
                  </div>
                  <Badge variant={getStatusVariant(tx.status)}>
                    {getStatusLabel(tx.status)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <span className="text-xs text-gray-500">
                    {tx.borrowed_at ? new Date(tx.borrowed_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                  <Link href={`/pengambilan/${tx.id}`}>
                    <Button variant="secondary" size="sm">
                      <Eye className="w-4 h-4 mr-2" />
                      Lihat
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
