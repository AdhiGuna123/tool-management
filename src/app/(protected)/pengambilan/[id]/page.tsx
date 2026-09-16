'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getTransactionById, getTransactionItems, cancelTransaction, uploadTTD, getAttachments } from '@/lib/actions/transactions';
import { getReturnEvents, getStockMovements } from '@/lib/actions/returns';
import { generateSOP } from '@/lib/actions/sop-generation';
import Button from '@/components/ui/button';
import Card from '@/components/ui/card';
import Badge from '@/components/ui/badge';
import Loading from '@/components/ui/loading';
import Modal from '@/components/ui/modal';
import { showToast } from '@/components/ui/toast';
import { 
  ArrowLeft, Printer, Upload, Plus, XCircle, 
  CheckCircle, FileText, AlertTriangle, History,
  ArrowDownToLine, ArrowUpFromLine, Wrench, Package, Clock,
} from 'lucide-react';
import Link from 'next/link';
import type { TransactionWithRelations, TransactionItem, Attachment, ReturnEvent, StockMovement } from '@/types';

const timelineTypeLabels: Record<string, string> = {
  BORROW: 'Peminjaman',
  RETURN: 'Pengembalian',
  DAMAGED: 'Kerusakan',
  LOST: 'Kehilangan',
  CONSUMABLE_USED: 'Habis Dipakai',
  TOOL_RETURNED: 'Alat Dikembalikan',
  TOOL_DAMAGED: 'Alat Rusak',
  TOOL_LOST: 'Alat Hilang',
  CONSUMABLE_RETURNED: 'Sisa Dikembalikan',
  STOCK_OPNAME_INCREASE: 'Stok Opname +',
  STOCK_OPNAME_DECREASE: 'Stok Opname -',
  MANUAL_ADJUSTMENT: 'Penyesuaian Manual',
};

export default function PengambilanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [transaction, setTransaction] = useState<TransactionWithRelations | null>(null);
  const [transactionItems, setTransactionItems] = useState<TransactionItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [returnEvents, setReturnEvents] = useState<ReturnEvent[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatingSOP, setGeneratingSOP] = useState(false);
  const [activeTab, setActiveTab] = useState<'items' | 'timeline'>('items');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    loadTransaction();
  }, []);

  async function loadTransaction() {
    setLoading(true);
    const resolvedParams = await params;
    const txId = resolvedParams.id;
    try {
      const [txData, itemsData, attData, returnData, stockData] = await Promise.all([
        getTransactionById(txId),
        getTransactionItems(txId),
        getAttachments(txId),
        getReturnEvents(txId),
        getStockMovements(txId),
      ]);
      setTransaction(txData as TransactionWithRelations);
      setTransactionItems(itemsData as TransactionItem[]);
      setAttachments(attData as Attachment[]);
      setReturnEvents(returnData as unknown as ReturnEvent[]);
      setStockMovements(stockData as unknown as StockMovement[]);

      // Fetch return event profiles
      if (returnData && (returnData as unknown as ReturnEvent[]).length > 0) {
        const userIds = (returnData as unknown as ReturnEvent[]).map(e => e.processed_by).filter(Boolean);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);
          if (profiles) {
            setReturnEvents((returnData as unknown as ReturnEvent[]).map(e => ({
              ...e,
              profiles: profiles.find(p => p.id === e.processed_by) || null,
            })));
          }
        }
      }
    } catch (error) {
      console.error('Error loading transaction:', error);
    }
    setLoading(false);
  }

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      showToast('error', 'Alasan pembatalan wajib diisi.');
      return;
    }

    setCancelling(true);
    const result = await cancelTransaction(transaction!.id, cancelReason);
    
    if (result.success) {
      showToast('success', 'Transaksi berhasil dibatalkan.');
      setShowCancelModal(false);
      loadTransaction();
    } else {
      showToast('error', result.error || 'Gagal membatalkan transaksi.');
    }
    setCancelling(false);
  };

  const handleUploadTTD = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const result = await uploadTTD(transaction!.id, file);
    
    if (result.success) {
      showToast('success', 'TTD berhasil diupload.');
      loadTransaction();
    } else {
      showToast('error', result.error || 'Gagal mengupload TTD.');
    }
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleGenerateSOP = async () => {
    if (!transaction) return;
    setGeneratingSOP(true);
    try {
      const result = await generateSOP(transaction.id);
      if (result.success && result.buffer && result.fileName) {
        const blob = new Blob([new Uint8Array(result.buffer)], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('success', 'SOP berhasil dibuat dan diunduh.');
        loadTransaction();
      } else {
        showToast('error', result.error || 'Gagal membuat SOP.');
      }
    } catch {
      showToast('error', 'Gagal membuat SOP. Silakan coba lagi.');
    }
    setGeneratingSOP(false);
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'SEDANG_DIPINJAM':
        return 'info';
      case 'SELESAI':
        return 'success';
      case 'DIBATALKAN':
        return 'danger';
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
      default:
        return status;
    }
  };

  if (loading) {
    return <Loading />;
  }

  if (!transaction) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-gray-500">Transaksi tidak ditemukan.</p>
          <Link href="/pengambilan">
            <Button variant="secondary" className="mt-4">
              Kembali ke Daftar
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  const defaultItems = transactionItems.filter((i) => i.is_default_item);
  const additionalItems = transactionItems.filter((i) => !i.is_default_item && !i.is_manual_item);
  const manualItems = transactionItems.filter((i) => i.is_manual_item);
  const hasTTD = attachments.some((a) => a.attachment_type === 'TTD');

  return (
    <div className="max-w-4xl mx-auto space-y-6 print:space-y-0">
      {/* Header - Hidden on print */}
      <div className="flex items-center gap-4 print:hidden">
        <Link href="/pengambilan">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{transaction.transaction_number}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {transaction.technicians?.name} • {new Date(transaction.transaction_date).toLocaleDateString('id-ID')}
          </p>
        </div>
        <Badge variant={getStatusVariant(transaction.status)} className="print:hidden">
          {getStatusLabel(transaction.status)}
        </Badge>
      </div>

      {/* Print Header */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-xl font-bold">LEMBAR TANDA TANGAN</h1>
        <p className="text-sm text-gray-600">Sistem Manajemen Alat</p>
      </div>

      {/* Transaction Info */}
      <Card className="print:shadow-none print:border-0">
        <h2 className="text-lg font-semibold mb-4 print:text-base">Informasi Transaksi</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-500">No. Transaksi</dt>
            <dd className="text-sm font-medium text-gray-900 font-mono">{transaction.transaction_number}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Tanggal</dt>
            <dd className="text-sm font-medium text-gray-900">
              {new Date(transaction.transaction_date).toLocaleDateString('id-ID', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Teknisi</dt>
            <dd className="text-sm font-medium text-gray-900">
              {transaction.technicians?.name} ({transaction.technicians?.technician_code})
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Proyek</dt>
            <dd className="text-sm font-medium text-gray-900">
              {transaction.projects?.project_name || transaction.manual_project_name || '-'}
            </dd>
          </div>
          {transaction.location && (
            <div>
              <dt className="text-sm text-gray-500">Lokasi</dt>
              <dd className="text-sm font-medium text-gray-900">{transaction.location}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-gray-500">Status</dt>
            <dd>
              <Badge variant={getStatusVariant(transaction.status)}>
                {getStatusLabel(transaction.status)}
              </Badge>
            </dd>
          </div>
        </dl>
      </Card>

      {/* Tabs - Hidden on print */}
      <div className="flex gap-1 border-b print:hidden">
        {[
          { id: 'items', label: 'Barang', icon: Package },
          { id: 'timeline', label: 'Timeline', icon: History },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Items */}
      {activeTab === 'items' && (
        <>
          {/* Default Tools */}
          {defaultItems.length > 0 && (
            <Card className="print:shadow-none print:border-0">
              <h2 className="text-lg font-semibold mb-4 print:text-base">Alat Bawaan Wajib</h2>
              <div className="space-y-2">
                {defaultItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{item.item_name_snapshot}</p>
                      <p className="text-xs text-gray-500">{item.unit_snapshot || 'Pcs'}</p>
                    </div>
                    <span className="font-medium text-gray-900">{item.borrow_qty}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Additional Items */}
          {additionalItems.length > 0 && (
            <Card className="print:shadow-none print:border-0">
              <h2 className="text-lg font-semibold mb-4 print:text-base">Alat / Barang Tambahan</h2>
              <div className="space-y-2">
                {additionalItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{item.item_name_snapshot}</p>
                      <p className="text-xs text-gray-500">{item.unit_snapshot || 'Pcs'}</p>
                    </div>
                    <span className="font-medium text-gray-900">{item.borrow_qty}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Manual Items */}
          {manualItems.length > 0 && (
            <Card className="print:shadow-none print:border-0">
              <h2 className="text-lg font-semibold mb-4 print:text-base">Barang Manual</h2>
              <div className="space-y-2">
                {manualItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{item.item_name_snapshot}</p>
                        <Badge variant="warning" className="print:hidden">BELUM TERDAFTAR</Badge>
                      </div>
                      <p className="text-xs text-gray-500">{item.unit_snapshot || '-'}</p>
                    </div>
                    <span className="font-medium text-gray-900">{item.borrow_qty}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Tab: Timeline */}
      {activeTab === 'timeline' && (
        <Card className="print:shadow-none print:border-0">
          <h2 className="text-lg font-semibold mb-4">Riwayat Aktivitas</h2>
          {returnEvents.length === 0 && stockMovements.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Belum ada riwayat aktivitas.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Transaction Created */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <ArrowDownToLine className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Transaksi dibuat</p>
                  <p className="text-xs text-gray-500">
                    {new Date(transaction!.created_at).toLocaleString('id-ID')}
                  </p>
                </div>
              </div>

              {/* Return Events */}
              {returnEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <ArrowUpFromLine className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Pengembalian diproses</p>
                    <p className="text-xs text-gray-500">
                      {event.notes || `Oleh ${event.profiles?.full_name || 'Admin'}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(event.processed_at).toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
              ))}

              {/* Stock Movements */}
              {stockMovements.map((movement) => (
                <div key={movement.id} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    (movement.quantity || 0) > 0 ? 'bg-green-100' :
                    (movement.quantity || 0) < 0 ? 'bg-red-100' : 'bg-gray-100'
                  }`}>
                    {(movement.quantity || 0) > 0 ? (
                      <ArrowDownToLine className="w-4 h-4 text-green-600" />
                    ) : (movement.quantity || 0) < 0 ? (
                      <ArrowUpFromLine className="w-4 h-4 text-red-600" />
                    ) : (
                      <Package className="w-4 h-4 text-gray-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {timelineTypeLabels[movement.movement_type] || movement.movement_type}
                    </p>
                    <p className="text-xs text-gray-500">
                      {movement.notes || '-'}
                      {(movement as unknown as { technicians?: { name: string } }).technicians?.name &&
                        ` • ${(movement as unknown as { technicians?: { name: string } }).technicians?.name}`
                      }
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(movement.created_at).toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
              ))}

      {/* Document Status */}
      <Card className="print:shadow-none print:border-0">
        <h2 className="text-lg font-semibold mb-4 print:text-base">Status Dokumen</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Pengambilan</span>
            <Badge variant="success">✓ Dibuat</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">TTD Fisik</span>
            <span className="text-xs text-gray-500">Manual / ditangani di luar sistem</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Backup TTD</span>
            {hasTTD ? (
              <Badge variant="success">✓ Uploaded</Badge>
            ) : (
              <Badge variant="warning">Belum Upload</Badge>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Pengembalian</span>
            {transaction.status === 'SELESAI' ? (
              <Badge variant="success">✓ Selesai</Badge>
            ) : transaction.status === 'PENGEMBALIAN_BELUM_LENGKAP' ? (
              <Badge variant="warning">Belum Lengkap</Badge>
            ) : (
              <Badge variant="info">Dipinjam</Badge>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">SOP Final</span>
            {transaction.sop_generated_at ? (
              <Badge variant="success">✓ Dibuat</Badge>
            ) : (
              <Badge variant="warning">Belum Dibuat</Badge>
            )}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t">
          {transaction.sop_generated_at ? (
            <Button variant="secondary" className="w-full" onClick={handleGenerateSOP} loading={generatingSOP}>
              <FileText className="w-4 h-4 mr-2" />
              DOWNLOAD SOP EXCEL
            </Button>
          ) : (
            <Button className="w-full" onClick={handleGenerateSOP} loading={generatingSOP}>
              <FileText className="w-4 h-4 mr-2" />
              BUAT SOP FINAL
            </Button>
          )}
        </div>
      </Card>

      {/* TTD Status */}
              {hasTTD && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">TTD diupload</p>
                    <p className="text-xs text-gray-500">
                      {attachments.filter(a => a.attachment_type === 'TTD').map(a => 
                        new Date(a.created_at).toLocaleString('id-ID')
                      ).join(', ')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* TTD Status */}
      <Card className="print:shadow-none print:border-0">
        <h2 className="text-lg font-semibold mb-4 print:text-base">Tanda Tangan</h2>
        {hasTTD ? (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Sudah diupload</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-500">
            <AlertTriangle className="w-5 h-5" />
            <span>Belum upload</span>
          </div>
        )}
      </Card>

      {/* Signature Section - Print Only */}
      <div className="hidden print:block mt-8">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="text-sm font-medium mb-2">TEKNISI</p>
            <p className="text-sm mb-1">Nama: {transaction.technicians?.name}</p>
            <div className="h-20 border-b"></div>
            <p className="text-xs text-gray-500 mt-1">Tanda Tangan</p>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">ADMIN</p>
            <p className="text-sm mb-1">Nama: _________________</p>
            <div className="h-20 border-b"></div>
            <p className="text-xs text-gray-500 mt-1">Tanda Tangan</p>
          </div>
        </div>
      </div>

      {/* Action Buttons - Hidden on print */}
      <div className="flex flex-col sm:flex-row gap-3 print:hidden">
        <Button variant="secondary" className="flex-1" onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2" />
          PRINT LEMBAR TTD
        </Button>
        
        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleUploadTTD}
            className="hidden"
            id="ttd-upload"
          />
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? 'Mengupload...' : 'UPLOAD / FOTO TTD'}
          </Button>
        </div>

        {transaction.status === 'SEDANG_DIPINJAM' && (
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => setShowCancelModal(true)}
          >
            <XCircle className="w-4 h-4 mr-2" />
            BATALKAN
          </Button>
        )}
      </div>

      {/* Cancel Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Batalkan Transaksi"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Batalkan transaksi {transaction.transaction_number}?
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Alasan Pembatalan
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Masukkan alasan pembatalan..."
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowCancelModal(false)}
            >
              BATAL
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              loading={cancelling}
              onClick={handleCancel}
            >
              BATALKAN TRANSAKSI
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
