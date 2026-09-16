'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getOpenTransactions } from '@/lib/actions/returns';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Card from '@/components/ui/card';
import Badge from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import Loading from '@/components/ui/loading';
import { ArrowUpFromLine, Search, Eye, AlertTriangle, Clock } from 'lucide-react';
import type { TransactionWithRelations } from '@/types';

export default function PengembalianPage() {
  const [transactions, setTransactions] = useState<TransactionWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadTransactions();
  }, []);

  async function loadTransactions() {
    setLoading(true);
    try {
      const data = await getOpenTransactions();
      setTransactions(data as TransactionWithRelations[]);
    } catch (error) {
      console.error('Error loading transactions:', error);
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
      case 'PENGEMBALIAN_BELUM_LENGKAP':
        return 'warning';
      case 'BERMASALAH':
        return 'danger';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'SEDANG_DIPINJAM':
        return 'SEDANG DIPINJAM';
      case 'PENGEMBALIAN_BELUM_LENGKAP':
        return 'PENGEMBALIAN BELUM LENGKAP';
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
          <h1 className="text-2xl font-bold text-gray-900">Pengembalian Alat</h1>
          <p className="text-sm text-gray-500 mt-1">
            Proses pengembalian alat dari teknisi
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Cari transaksi, teknisi, atau proyek..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredTransactions.length === 0 ? (
        <Card>
          <EmptyState
            title="TIDAK ADA PENGEMBALIAN TERBUTA"
            description="Semua alat sudah dikembalikan atau belum ada pengambilan hari ini."
            icon={<ArrowUpFromLine className="w-12 h-12" />}
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
                      Tanggal
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Teknisi
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Proyek
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Waktu Ambil
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                      Status
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
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(tx.transaction_date).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{tx.technicians?.name}</p>
                        <p className="text-xs text-gray-500">{tx.technicians?.technician_code}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {tx.projects?.project_name || tx.manual_project_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {tx.borrowed_at ? new Date(tx.borrowed_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={getStatusVariant(tx.status)}>
                            {getStatusLabel(tx.status)}
                          </Badge>
                          {tx.has_damage && (
                            <Badge variant="danger">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              RUSAK
                            </Badge>
                          )}
                          {tx.has_loss && (
                            <Badge variant="danger">
                              HILANG
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/pengembalian/${tx.id}`}>
                            <Button variant="primary" size="sm">
                              <Eye className="w-4 h-4 mr-1" />
                              Periksa
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
                    <p className="text-xs text-gray-500 mt-1">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {tx.borrowed_at ? new Date(tx.borrowed_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                  <Badge variant={getStatusVariant(tx.status)}>
                    {getStatusLabel(tx.status)}
                  </Badge>
                </div>
                {(tx.has_damage || tx.has_loss) && (
                  <div className="flex gap-2 mt-2">
                    {tx.has_damage && <Badge variant="danger">RUSAK</Badge>}
                    {tx.has_loss && <Badge variant="danger">HILANG</Badge>}
                  </div>
                )}
                <div className="mt-4">
                  <Link href={`/pengembalian/${tx.id}`}>
                    <Button variant="primary" size="sm" className="w-full">
                      <Eye className="w-4 h-4 mr-2" />
                      Periksa Pengembalian
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
