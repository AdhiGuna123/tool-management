'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/button';
import Card from '@/components/ui/card';
import Badge from '@/components/ui/badge';
import Loading from '@/components/ui/loading';
import { CheckCircle, Eye, ArrowLeft, AlertTriangle, Package } from 'lucide-react';
import Link from 'next/link';
import type { TransactionWithRelations, TransactionItem } from '@/types';

export default function PengembalianSuksesPage() {
  const searchParams = useSearchParams();
  const transactionId = searchParams.get('id');
  const status = searchParams.get('status');
  const supabase = createClient();

  const [transaction, setTransaction] = useState<TransactionWithRelations | null>(null);
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (transactionId) {
      loadData();
    }
  }, [transactionId]);

  async function loadData() {
    if (!transactionId) return;

    const [txData, itemsData] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, technicians(name, technician_code), projects(project_name, project_code)')
        .eq('id', transactionId)
        .single(),
      supabase
        .from('transaction_items')
        .select('*')
        .eq('transaction_id', transactionId),
    ]);

    setTransaction(txData.data as TransactionWithRelations);
    setItems(itemsData.data as TransactionItem[]);
    setLoading(false);
  }

  const getStatusVariant = (s: string) => {
    switch (s) {
      case 'SELESAI': return 'success';
      case 'PENGEMBALIAN_BELUM_LENGKAP': return 'warning';
      case 'BERMASALAH': return 'danger';
      default: return 'default';
    }
  };

  const getStatusLabel = (s: string) => {
    switch (s) {
      case 'SELESAI': return 'SELESAI';
      case 'PENGEMBALIAN_BELUM_LENGKAP': return 'PENGEMBELIAN BELUM LENGKAP';
      case 'BERMASALAH': return 'BERMASALAH';
      default: return s;
    }
  };

  if (loading) {
    return <Loading />;
  }

  // Calculate summary
  const totalBrought = items.length;
  const returnedGood = items.filter((i) => i.return_status === 'KEMBALI_BAIK').length;
  const usedConsumable = items.filter((i) => i.return_status === 'HABIS_DIPAKAI').length;
  const outstanding = items.filter((i) => {
    const total = (i.returned_qty || 0) + (i.used_qty || 0) + (i.damaged_qty || 0) + (i.lost_qty || 0);
    return total < i.borrow_qty;
  }).length;
  const damaged = items.filter((i) => (i.damaged_qty || 0) > 0).length;
  const lost = items.filter((i) => (i.lost_qty || 0) > 0).length;

  const outstandingItems = items.filter((i) => {
    const total = (i.returned_qty || 0) + (i.used_qty || 0) + (i.damaged_qty || 0) + (i.lost_qty || 0);
    return total < i.borrow_qty;
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Success Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">PENGEMBALIAN TERSIMPAN</h1>
      </div>

      {/* Transaction Info */}
      <Card>
        <div className="text-center space-y-2">
          <p className="font-mono text-lg font-medium text-gray-900">
            {transaction?.transaction_number}
          </p>
          <p className="text-gray-600">{transaction?.technicians?.name}</p>
          <Badge variant={getStatusVariant(status || '')} className="mt-2">
            {getStatusLabel(status || '')}
          </Badge>
        </div>
      </Card>

      {/* Summary */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Ringkasan</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900">{totalBrought}</p>
              <p className="text-xs text-gray-500">Jenis Barang Dibawa</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900">{returnedGood + usedConsumable}</p>
              <p className="text-xs text-gray-500">Selesai</p>
            </div>
          </div>
          {outstanding > 0 && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-lg font-medium text-orange-600">{outstanding}</p>
                <p className="text-xs text-gray-500">Belum Kembali</p>
              </div>
            </div>
          )}
          {damaged > 0 && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-lg font-medium text-red-600">{damaged}</p>
                <p className="text-xs text-gray-500">Rusak</p>
              </div>
            </div>
          )}
          {lost > 0 && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-lg font-medium text-red-600">{lost}</p>
                <p className="text-xs text-gray-500">Hilang</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Outstanding Items */}
      {outstandingItems.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold mb-4 text-orange-600">Barang Belum Kembali</h2>
          <div className="space-y-2">
            {outstandingItems.map((item) => {
              const total = (item.returned_qty || 0) + (item.used_qty || 0) + (item.damaged_qty || 0) + (item.lost_qty || 0);
              const remaining = item.borrow_qty - total;
              return (
                <div key={item.id} className="flex items-center justify-between p-2 bg-orange-50 rounded">
                  <span className="text-sm font-medium text-gray-900">{item.item_name_snapshot}</span>
                  <span className="text-sm text-orange-600">×{remaining}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href={`/pengambilan/${transactionId}`} className="flex-1">
          <Button variant="secondary" className="w-full">
            <Eye className="w-4 h-4 mr-2" />
            Lihat Transaksi
          </Button>
        </Link>
        <Link href="/pengembalian" className="flex-1">
          <Button className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke Pengembalian
          </Button>
        </Link>
      </div>
    </div>
  );
}
